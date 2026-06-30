-- =====================================================
-- PRODUCTION ROUTE NOTE RPCs FIX
-- =====================================================
-- Fix: Create all RPCs needed for Assign Notes screen and route/note lifecycle
-- Date: 2026-05-26
-- =====================================================

-- =====================================================
-- 1. sync_route_stops
-- Creates trx_route_stop entries for each unique company/destination
-- =====================================================
CREATE OR REPLACE FUNCTION public.sync_route_stops(
  p_route_id BIGINT,
  p_user_id BIGINT DEFAULT NULL
)
RETURNS TABLE(
  stops_created BIGINT,
  stops_existing BIGINT,
  invoices_linked BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_test BOOLEAN;
  v_count_stops_created BIGINT := 0;
  v_count_stops_existing BIGINT := 0;
  v_count_invoices_linked BIGINT := 0;
BEGIN
  SELECT is_test INTO v_is_test FROM public.trx_route WHERE id = p_route_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rota não encontrada: %', p_route_id;
  END IF;

  -- Create stops for each unique company
  INSERT INTO public.trx_route_stop (
    id_route, id_company, stop_sequence, is_active, is_test, created_by, updated_by
  )
  SELECT
    p_route_id,
    fi.id_customer_company,
    COALESCE(MAX(rs.stop_sequence), 0) + row_number() OVER (ORDER BY fi.id_customer_company),
    true,
    v_is_test,
    p_user_id,
    p_user_id
  FROM public.rel_route_invoice ri
  JOIN public.trx_fiscal_invoice fi ON fi.id = ri.id_fiscal_invoice
  LEFT JOIN public.trx_route_stop rs ON rs.id_route = p_route_id AND rs.is_test = v_is_test
  WHERE ri.id_route = p_route_id
    AND ri.is_active = true
    AND fi.id_customer_company IS NOT NULL
    AND fi.id_customer_company <> 0
    AND NOT EXISTS (
      SELECT 1 FROM public.trx_route_stop existing
      WHERE existing.id_route = p_route_id
        AND existing.id_company = fi.id_customer_company
        AND existing.is_test = v_is_test
    )
  GROUP BY fi.id_customer_company
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count_stops_created = ROW_COUNT;

  -- Get total stops count
  SELECT COUNT(*) INTO v_count_stops_existing
  FROM public.trx_route_stop
  WHERE id_route = p_route_id AND is_test = v_is_test;

  -- Update invoices with stop references
  UPDATE public.rel_route_invoice ri
  SET id_route_stop = (
    SELECT id FROM public.trx_route_stop
    WHERE id_route = p_route_id
      AND id_company = (
        SELECT id_customer_company FROM public.trx_fiscal_invoice WHERE id = ri.id_fiscal_invoice
      )
      AND is_test = v_is_test
    LIMIT 1
  ),
  updated_at = NOW(),
  updated_by = p_user_id
  WHERE ri.id_route = p_route_id AND ri.is_active = true;

  GET DIAGNOSTICS v_count_invoices_linked = ROW_COUNT;

  RETURN QUERY SELECT v_count_stops_created, v_count_stops_existing, v_count_invoices_linked;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_route_stops TO authenticated, anon;

-- =====================================================
-- 2. create_route_from_assign_notes
-- Creates a new route with assigned invoices
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_route_from_assign_notes(
  p_id_vehicle bigint,
  p_departure_date date,
  p_id_route_responsible bigint,
  p_id_driver bigint DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_assistant text[] DEFAULT NULL,
  p_invoice_ids bigint[] DEFAULT NULL,
  p_is_test boolean DEFAULT false
)
RETURNS TABLE(p_id bigint, p_route_code text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_route_id bigint;
  v_route_code text;
  v_id_route_status bigint;
  v_id_route_delivery_status bigint;
  v_invoice_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.master_fleet_vehicle WHERE id = p_id_vehicle AND is_active = true) THEN
    RAISE EXCEPTION 'Veículo inválido ou inativo';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ref_route_responsible WHERE id = p_id_route_responsible AND is_active = true) THEN
    RAISE EXCEPTION 'Responsável inválido ou inativo';
  END IF;

  IF p_id_driver IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.master_person_driver WHERE id = p_id_driver AND is_active = true) THEN
    RAISE EXCEPTION 'Motorista inválido ou inativo';
  END IF;

  IF p_invoice_ids IS NOT NULL AND array_length(p_invoice_ids, 1) > 0 THEN
    FOREACH v_invoice_id IN ARRAY p_invoice_ids
    LOOP
      IF NOT EXISTS (SELECT 1 FROM public.trx_fiscal_invoice WHERE id = v_invoice_id AND is_active = true AND is_test = p_is_test) THEN
        RAISE EXCEPTION 'Nota % não existe ou não está disponível', v_invoice_id;
      END IF;
      IF EXISTS (SELECT 1 FROM public.rel_route_invoice WHERE id_fiscal_invoice = v_invoice_id AND is_active = true) THEN
        RAISE EXCEPTION 'Nota % já está em uma rota ativa', v_invoice_id;
      END IF;
    END LOOP;
  END IF;

  IF EXISTS (SELECT 1 FROM public.trx_route WHERE id_vehicle = p_id_vehicle AND departure_date = p_departure_date AND is_active = true AND is_test = p_is_test) THEN
    RAISE EXCEPTION 'Já existe uma rota ativa para este veículo nesta data';
  END IF;

  SELECT id INTO v_id_route_status FROM public.ref_route_status WHERE is_initial = true AND is_active = true AND is_test = p_is_test LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Status inicial da rota não encontrado'; END IF;

  SELECT id INTO v_id_route_delivery_status FROM public.ref_route_delivery_status WHERE is_initial = true AND is_active = true AND is_test = p_is_test LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Status inicial da entrega não encontrado'; END IF;

  SELECT COALESCE(MAX(route_code::integer), 0) + 1 INTO v_route_code FROM public.trx_route WHERE is_test = p_is_test AND route_code ~ '^[0-9]+$';
  v_route_code := LPAD(v_route_code::text, 6, '0');

  INSERT INTO public.trx_route (
    route_code, departure_date, id_route_status, id_route_delivery_status,
    id_vehicle, id_driver, area, assistant, is_test, is_active, id_route_responsible
  ) VALUES (
    v_route_code, p_departure_date, v_id_route_status, v_id_route_delivery_status,
    p_id_vehicle, p_id_driver, p_area, p_assistant, p_is_test, true, p_id_route_responsible
  )
  RETURNING id INTO v_route_id;

  IF p_invoice_ids IS NOT NULL AND array_length(p_invoice_ids, 1) > 0 THEN
    FOREACH v_invoice_id IN ARRAY p_invoice_ids
    LOOP
      INSERT INTO public.rel_route_invoice (
        id_route, id_fiscal_invoice, assigned_at, is_test, is_active, attempt_number,
        planned_box_quantity, planned_amount
      ) VALUES (
        v_route_id, v_invoice_id, now(), p_is_test, true, 1,
        (SELECT box_quantity FROM public.trx_fiscal_invoice WHERE id = v_invoice_id),
        (SELECT invoice_amount FROM public.trx_fiscal_invoice WHERE id = v_invoice_id)
      );
      UPDATE public.trx_fiscal_invoice SET id_fiscal_invoice_status = (SELECT id FROM public.ref_fiscal_invoice_status WHERE code = 'EM_ROTA' LIMIT 1) WHERE id = v_invoice_id;
    END LOOP;
    PERFORM public.sync_route_stops(v_route_id, NULL);
  END IF;

  INSERT INTO public.trx_route_history (id_route, event_type, event_label, event_description, event_at, is_test, is_active)
  VALUES (v_route_id, 'ROUTE_CREATED', 'Rota Criada', 'Rota ' || v_route_code || ' criada', now(), p_is_test, true);

  RETURN QUERY SELECT v_route_id, v_route_code::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_route_from_assign_notes TO authenticated, anon;

-- =====================================================
-- 3. update_route_from_assign_notes
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_route_from_assign_notes(
  p_route_id bigint,
  p_id_driver bigint DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_assistant text[] DEFAULT NULL,
  p_invoice_ids bigint[] DEFAULT NULL,
  p_is_test boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status_id bigint;
  v_allows_edition boolean;
BEGIN
  SELECT id_route_delivery_status INTO v_current_status_id FROM public.trx_route WHERE id = p_route_id AND is_active = true AND is_test = p_is_test;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rota não encontrada'; END IF;

  SELECT allows_route_edition INTO v_allows_edition FROM public.ref_route_delivery_status WHERE id = v_current_status_id;
  IF v_allows_edition = false THEN RAISE EXCEPTION 'Rota em andamento - montagem não pode ser alterada'; END IF;

  UPDATE public.trx_route SET id_driver = COALESCE(p_id_driver, id_driver), area = COALESCE(p_area, area),
    assistant = COALESCE(p_assistant, assistant), updated_at = now() WHERE id = p_route_id;

  IF p_invoice_ids IS NOT NULL THEN PERFORM public.sync_route_invoices(p_route_id, p_invoice_ids::jsonb, NULL); END IF;

  INSERT INTO public.trx_route_history (id_route, event_type, event_label, event_description, event_at, is_test, is_active)
  VALUES (p_route_id, 'ROUTE_UPDATED', 'Rota Atualizada', 'Rota atualizada', now(), p_is_test, true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_route_from_assign_notes TO authenticated, anon;

-- =====================================================
-- 4. sync_route_invoices
-- =====================================================
CREATE OR REPLACE FUNCTION public.sync_route_invoices(p_route_id BIGINT, p_invoice_ids JSONB, p_user_id BIGINT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_test boolean;
  v_existing_id bigint;
  v_attempt_number integer;
  v_invoice_id bigint;
BEGIN
  SELECT is_test INTO v_is_test FROM public.trx_route WHERE id = p_route_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rota não encontrada: %', p_route_id; END IF;

  -- Remove invoices not in new list
  UPDATE public.rel_route_invoice SET is_active = false, released_at = NOW(), release_reason = 'REMOVED_FROM_ROUTE', updated_at = NOW()
  WHERE id_route = p_route_id AND is_active = true
    AND id_fiscal_invoice NOT IN (SELECT value::bigint FROM jsonb_array_elements_text(p_invoice_ids));

  -- Add new invoices
  FOR v_invoice_id IN SELECT value::bigint FROM jsonb_array_elements_text(p_invoice_ids)
  LOOP
    SELECT id INTO v_existing_id FROM public.rel_route_invoice WHERE id_route = p_route_id AND id_fiscal_invoice = v_invoice_id AND is_active = false ORDER BY id DESC LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      UPDATE public.rel_route_invoice SET is_active = true, released_at = NULL, release_reason = NULL, updated_at = NOW() WHERE id = v_existing_id;
    ELSE
      SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO v_attempt_number FROM public.rel_route_invoice WHERE id_fiscal_invoice = v_invoice_id;
      INSERT INTO public.rel_route_invoice (id_route, id_fiscal_invoice, assigned_at, assigned_by, is_test, is_active, attempt_number, planned_box_quantity, planned_amount)
      VALUES (p_route_id, v_invoice_id, NOW(), p_user_id, v_is_test, true, COALESCE(v_attempt_number, 1),
        (SELECT box_quantity FROM public.trx_fiscal_invoice WHERE id = v_invoice_id),
        (SELECT invoice_amount FROM public.trx_fiscal_invoice WHERE id = v_invoice_id));
    END IF;
  END LOOP;

  PERFORM public.sync_route_stops(p_route_id, p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_route_invoices TO authenticated, anon;

-- =====================================================
-- 5. get_assign_notes_board
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_assign_notes_board(p_departure_date date, p_is_test boolean DEFAULT false)
RETURNS TABLE(result jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_available_invoices jsonb;
  v_routes jsonb;
BEGIN
  WITH active_invoices AS (
    SELECT DISTINCT ri.id_fiscal_invoice FROM public.rel_route_invoice ri
    JOIN public.trx_route r ON r.id = ri.id_route
    WHERE ri.is_active = true AND r.is_active = true AND r.is_test = p_is_test AND r.departure_date = p_departure_date
  )
  SELECT jsonb_agg(jsonb_build_object('id', fi.id, 'invoice_number', fi.invoice_number, 'box_quantity', fi.box_quantity, 'gross_weight', fi.gross_weight, 'invoice_amount', fi.invoice_amount, 'customer_name', mc.trade_name, 'supplier_name', ms.trade_name))
  INTO v_available_invoices
  FROM public.trx_fiscal_invoice fi
  LEFT JOIN public.master_person_company mc ON mc.id = fi.id_customer_company
  LEFT JOIN public.master_person_company ms ON ms.id = fi.id_supplier_company
  WHERE fi.is_active = true AND fi.is_test = p_is_test
    AND fi.id_fiscal_invoice_status = (SELECT id FROM public.ref_fiscal_invoice_status WHERE code = 'DISPONIVEL' LIMIT 1)
    AND fi.id NOT IN (SELECT id_fiscal_invoice FROM active_invoices);

  SELECT jsonb_agg(jsonb_build_object('id', r.id, 'route_code', r.route_code, 'area', r.area, 'id_vehicle', r.id_vehicle, 'vehicle_plate', mv.plate, 'vehicle_capacity', mv.nominal_capacity, 'driver_name', mpd.name, 'responsible_name', rr.name, 'delivery_status', rds.name, 'allows_edition', rds.allows_route_edition, 'departure_date', r.departure_date))
  INTO v_routes
  FROM public.trx_route r
  LEFT JOIN public.master_fleet_vehicle mv ON mv.id = r.id_vehicle
  LEFT JOIN public.master_person_driver mpd ON mpd.id = r.id_driver
  LEFT JOIN public.ref_route_responsible rr ON rr.id = r.id_route_responsible
  LEFT JOIN public.ref_route_delivery_status rds ON r.id_route_delivery_status = rds.id
  WHERE r.departure_date = p_departure_date AND r.is_active = true AND r.is_test = p_is_test;

  RETURN QUERY SELECT jsonb_build_object('available_invoices', COALESCE(v_available_invoices, '[]'::jsonb), 'routes', COALESCE(v_routes, '[]'::jsonb), 'departure_date', p_departure_date, 'generated_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_assign_notes_board TO authenticated, anon;

-- =====================================================
-- 6. start_route
-- =====================================================
CREATE OR REPLACE FUNCTION public.start_route(p_route_id bigint, p_user_id bigint DEFAULT NULL, p_is_test boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_route_code text;
  v_status_id bigint;
BEGIN
  SELECT route_code INTO v_route_code FROM public.trx_route WHERE id = p_route_id AND is_active = true AND is_test = p_is_test;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rota não encontrada'; END IF;

  SELECT id INTO v_status_id FROM public.ref_route_delivery_status WHERE code = 'in_progress' AND is_active = true AND is_test = p_is_test;
  IF NOT FOUND THEN RAISE EXCEPTION 'Status "Em Andamento" não encontrado'; END IF;

  UPDATE public.trx_route SET id_route_delivery_status = v_status_id, starts_at = now(), updated_at = now() WHERE id = p_route_id;

  INSERT INTO public.trx_route_history (id_route, event_type, event_label, event_description, event_at, is_test, is_active)
  VALUES (p_route_id, 'ROUTE_STARTED', 'Rota Iniciada', 'Rota ' || v_route_code || ' iniciada', now(), p_is_test, true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_route TO authenticated, anon;

-- =====================================================
-- 7. complete_route
-- =====================================================
CREATE OR REPLACE FUNCTION public.complete_route(p_route_id bigint, p_user_id bigint DEFAULT NULL, p_is_test boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_route_code text;
  v_status_id bigint;
  v_pending_count bigint;
BEGIN
  SELECT route_code INTO v_route_code FROM public.trx_route WHERE id = p_route_id AND is_active = true AND is_test = p_is_test;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rota não encontrada'; END IF;

  SELECT COUNT(*) INTO v_pending_count FROM public.rel_route_invoice ri
  LEFT JOIN public.trx_route_invoice_delivery d ON d.id_route_invoice = ri.id AND d.is_test = p_is_test
  WHERE ri.id_route = p_route_id AND ri.is_active = true AND d.id IS NULL;

  IF v_pending_count > 0 THEN RAISE EXCEPTION 'Ainda existem % nota(s) sem resultado de entrega', v_pending_count; END IF;

  SELECT id INTO v_status_id FROM public.ref_route_delivery_status WHERE code = 'completed' AND is_active = true AND is_test = p_is_test;
  IF NOT FOUND THEN RAISE EXCEPTION 'Status "Concluída" não encontrado'; END IF;

  UPDATE public.trx_route SET id_route_delivery_status = v_status_id, ends_at = now(), updated_at = now() WHERE id = p_route_id;

  INSERT INTO public.trx_route_history (id_route, event_type, event_label, event_description, event_at, is_test, is_active)
  VALUES (p_route_id, 'ROUTE_COMPLETED', 'Rota Finalizada', 'Rota ' || v_route_code || ' finalizada', now(), p_is_test, true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_route TO authenticated, anon;

-- =====================================================
-- 8. register_invoice_delivery_result
-- =====================================================
CREATE OR REPLACE FUNCTION public.register_invoice_delivery_result(
  p_id_route_invoice bigint, p_id_delivery_type bigint, p_id_reason bigint DEFAULT NULL,
  p_receipt_image_path text DEFAULT NULL, p_nfd_image_path text DEFAULT NULL, p_nfd_number text DEFAULT NULL,
  p_returned_box_quantity integer DEFAULT NULL, p_returned_amount numeric(12, 2) DEFAULT NULL,
  p_observation text DEFAULT NULL, p_is_test boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_route_id bigint;
  v_invoice_id bigint;
  v_result_status_id bigint;
  v_releases_to_available boolean;
BEGIN
  SELECT id_route, id_fiscal_invoice INTO v_route_id, v_invoice_id FROM public.rel_route_invoice WHERE id = p_id_route_invoice;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tentativa não encontrada'; END IF;

  SELECT id_result_invoice_status, releases_to_available INTO v_result_status_id, v_releases_to_available FROM public.ref_delivery_reason_type WHERE id = p_id_delivery_type;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tipo de entrega não encontrado'; END IF;

  INSERT INTO public.trx_route_invoice_delivery (id_route, id_fiscal_invoice, id_route_invoice, id_delivery_type, id_reason, receipt_image_path, nfd_image_path, nfd_number, returned_box_quantity, returned_amount, observation, delivered_at, is_test, is_active)
  VALUES (v_route_id, v_invoice_id, p_id_route_invoice, p_id_delivery_type, p_id_reason, p_receipt_image_path, p_nfd_image_path, p_nfd_number, p_returned_box_quantity, p_returned_amount, p_observation, now(), p_is_test, true);

  IF v_result_status_id IS NOT NULL THEN UPDATE public.trx_fiscal_invoice SET id_fiscal_invoice_status = v_result_status_id, updated_at = now() WHERE id = v_invoice_id; END IF;

  IF v_releases_to_available THEN UPDATE public.rel_route_invoice SET is_active = false, released_at = now(), release_reason = 'DELIVERY_REGISTERED' WHERE id = p_id_route_invoice; END IF;

  INSERT INTO public.trx_route_history (id_route, event_type, event_label, event_description, event_at, metadata, is_test, is_active)
  VALUES (v_route_id, 'DELIVERY_REGISTERED', 'Entrega Registrada', 'Entrega registrada', now(), jsonb_build_object('route_invoice_id', p_id_route_invoice, 'invoice_id', v_invoice_id), p_is_test, true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_invoice_delivery_result TO authenticated, anon;

-- =====================================================
-- 9. Reload PostgREST schema cache
-- =====================================================
SELECT pg_notify('pgrst', 'reload schema');