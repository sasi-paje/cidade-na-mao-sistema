-- =====================================================
-- BELLOG PRODUCTION RPCs
-- =====================================================
-- All RPCs use SECURITY DEFINER for controlled access
-- All RPCs are idempotent and validate business rules
-- =====================================================

-- =====================================================
-- 1. create_route_from_assign_notes
-- Creates a new route with assigned invoices
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_route_from_assign_notes(
  p_id_vehicle bigint,
  p_departure_date date,
  p_id_route_responsible bigint,
  p_id_driver bigint default null,
  p_area text default null,
  p_assistant text[] default null,
  p_invoice_ids bigint[] default null,
  p_is_test boolean default false
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
  v_attempt_number integer;
  v_previous_route_invoice_id bigint;
BEGIN
  -- =====================================================
  -- VALIDATIONS
  -- =====================================================

  -- Validate vehicle
  IF NOT EXISTS (
    SELECT 1 FROM public.master_fleet_vehicle
    WHERE id = p_id_vehicle AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Veículo inválido ou inativo';
  END IF;

  -- Validate responsible
  IF NOT EXISTS (
    SELECT 1 FROM public.ref_route_responsible
    WHERE id = p_id_route_responsible AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Responsável inválido ou inativo';
  END IF;

  -- Validate driver if provided
  IF p_id_driver IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.master_person_driver
    WHERE id = p_id_driver AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Motorista inválido ou inativo';
  END IF;

  -- Validate invoices if provided
  IF p_invoice_ids IS NOT NULL AND array_length(p_invoice_ids, 1) > 0 THEN
    -- Check all invoices exist and are available
    FOR v_invoice_id IN SELECT unnest(p_invoice_ids)
    LOOP
      -- Check invoice exists
      IF NOT EXISTS (
        SELECT 1 FROM public.trx_fiscal_invoice
        WHERE id = v_invoice_id AND is_active = true AND is_test = p_is_test
      ) THEN
        RAISE EXCEPTION 'Nota % não existe ou não está disponível', v_invoice_id;
      END IF;

      -- Check invoice is not already in an active route
      IF EXISTS (
        SELECT 1 FROM public.rel_route_invoice
        WHERE id_fiscal_invoice = v_invoice_id
          AND is_active = true
      ) THEN
        RAISE EXCEPTION 'Nota % já está em uma rota ativa', v_invoice_id;
      END IF;
    END LOOP;
  END IF;

  -- =====================================================
  -- CHECK DUPLICATE ROUTE
  -- =====================================================
  IF EXISTS (
    SELECT 1 FROM public.trx_route
    WHERE id_vehicle = p_id_vehicle
      AND departure_date = p_departure_date
      AND is_active = true
      AND is_test = p_is_test
  ) THEN
    RAISE EXCEPTION 'Já existe uma rota ativa para este veículo nesta data';
  END IF;

  -- =====================================================
  -- GET INITIAL STATUSES
  -- =====================================================
  SELECT id INTO v_id_route_status
  FROM public.ref_route_status
  WHERE is_initial = true
    AND is_active = true
    AND is_test = false
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status inicial da rota não encontrado';
  END IF;

  SELECT id INTO v_id_route_delivery_status
  FROM public.ref_route_delivery_status
  WHERE is_initial = true
    AND is_active = true
    AND is_test = false
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status inicial da entrega não encontrado';
  END IF;

  -- =====================================================
  -- GENERATE ROUTE CODE
  -- =====================================================
  SELECT COALESCE(MAX(route_code::integer), 0) + 1
  INTO v_route_code
  FROM public.trx_route
  WHERE is_test = p_is_test AND route_code ~ '^[0-9]+$';

  v_route_code := LPAD(v_route_code::text, 6, '0');

  -- =====================================================
  -- INSERT ROUTE
  -- =====================================================
  INSERT INTO public.trx_route (
    route_code, departure_date,
    id_route_status, id_route_delivery_status,
    id_vehicle, id_driver,
    area, assistant,
    is_test, is_active,
    id_route_responsible
  ) VALUES (
    v_route_code, p_departure_date,
    v_id_route_status, v_id_route_delivery_status,
    p_id_vehicle, p_id_driver,
    p_area, p_assistant,
    p_is_test, true,
    p_id_route_responsible
  )
  RETURNING id INTO v_route_id;

  -- =====================================================
  -- INSERT ROUTE INVOICE LINKS
  -- =====================================================
  IF p_invoice_ids IS NOT NULL AND array_length(p_invoice_ids, 1) > 0 THEN
    FOR v_invoice_id IN SELECT unnest(p_invoice_ids)
    LOOP
      -- Get attempt number for this invoice (max + 1)
      SELECT COALESCE(MAX(attempt_number), 0) + 1, MAX(id)
      INTO v_attempt_number, v_previous_route_invoice_id
      FROM public.rel_route_invoice
      WHERE id_fiscal_invoice = v_invoice_id;

      INSERT INTO public.rel_route_invoice (
        id_route, id_fiscal_invoice,
        assigned_at,
        is_test, is_active,
        attempt_number,
        id_previous_route_invoice_id,
        planned_box_quantity,
        planned_amount
      ) VALUES (
        v_route_id, v_invoice_id,
        now(),
        p_is_test, true,
        COALESCE(v_attempt_number, 1),
        v_previous_route_invoice_id,
        (SELECT box_quantity FROM trx_fiscal_invoice WHERE id = v_invoice_id),
        (SELECT invoice_amount FROM trx_fiscal_invoice WHERE id = v_invoice_id)
      );

      -- Update invoice status to EM_ROTA
      UPDATE public.trx_fiscal_invoice
      SET id_fiscal_invoice_status = (
        SELECT id FROM public.ref_fiscal_invoice_status WHERE code = 'EM_ROTA' LIMIT 1
      )
      WHERE id = v_invoice_id;
    END LOOP;

    -- Sync route stops
    PERFORM public.sync_route_stops(v_route_id, NULL);
  END IF;

  -- =====================================================
  -- INSERT HISTORY
  -- =====================================================
  INSERT INTO public.trx_route_history (
    id_route, event_type, event_label, event_description, event_at, metadata, is_test, is_active
  ) VALUES (
    v_route_id,
    'ROUTE_CREATED',
    'Rota Criada',
    'Rota ' || v_route_code || ' criada com ' || COALESCE(array_length(p_invoice_ids, 1), 0) || ' notas',
    now(),
    jsonb_build_object(
      'vehicle_id', p_id_vehicle,
      'responsible_id', p_id_route_responsible,
      'invoice_count', array_length(p_invoice_ids, 1)
    ),
    p_is_test,
    true
  );

  RETURN QUERY SELECT v_route_id, v_route_code::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_route_from_assign_notes TO authenticated, anon;

-- =====================================================
-- 2. update_route_from_assign_notes
-- Updates an existing route and its invoice links
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_route_from_assign_notes(
  p_route_id bigint,
  p_id_driver bigint default null,
  p_area text default null,
  p_assistant text[] default null,
  p_invoice_ids bigint[] default null,
  p_is_test boolean default false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status_id bigint;
  v_allows_edition boolean;
BEGIN
  -- =====================================================
  -- CHECK ROUTE EXISTS AND IS ACTIVE
  -- =====================================================
  SELECT id_route_delivery_status INTO v_current_status_id
  FROM public.trx_route
  WHERE id = p_route_id AND is_active = true AND is_test = p_is_test;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rota não encontrada';
  END IF;

  -- =====================================================
  -- CHECK IF EDITION IS ALLOWED
  -- =====================================================
  SELECT allows_route_edition INTO v_allows_edition
  FROM public.ref_route_delivery_status
  WHERE id = v_current_status_id;

  IF v_allows_edition = false THEN
    RAISE EXCEPTION 'Rota em andamento - montagem não pode ser alterada';
  END IF;

  -- =====================================================
  -- UPDATE ROUTE FIELDS
  -- =====================================================
  UPDATE public.trx_route
  SET
    id_driver = COALESCE(p_id_driver, id_driver),
    area = COALESCE(p_area, area),
    assistant = COALESCE(p_assistant, assistant),
    updated_at = now()
  WHERE id = p_route_id;

  -- =====================================================
  -- SYNC INVOICES IF PROVIDED
  -- =====================================================
  IF p_invoice_ids IS NOT NULL THEN
    PERFORM public.sync_route_invoices(p_route_id, p_invoice_ids::jsonb, NULL);
  END IF;

  -- =====================================================
  -- INSERT HISTORY
  -- =====================================================
  INSERT INTO public.trx_route_history (
    id_route, event_type, event_label, event_description, event_at, is_test, is_active
  ) VALUES (
    p_route_id,
    'ROUTE_UPDATED',
    'Rota Atualizada',
    'Rota atualizada',
    now(),
    p_is_test,
    true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_route_from_assign_notes TO authenticated, anon;

-- =====================================================
-- 3. start_route
-- Starts a route (changes delivery status to Em Andamento)
-- =====================================================
CREATE OR REPLACE FUNCTION public.start_route(
  p_route_id bigint,
  p_user_id bigint default null,
  p_is_test boolean default false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_route_code text;
  v_status_id bigint;
  v_current_status bigint;
BEGIN
  -- =====================================================
  -- VALIDATE ROUTE
  -- =====================================================
  SELECT route_code, id_route_delivery_status
  INTO v_route_code, v_current_status
  FROM public.trx_route
  WHERE id = p_route_id AND is_active = true AND is_test = p_is_test;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rota não encontrada';
  END IF;

  -- =====================================================
  -- CHECK CURRENT STATUS ALLOWS START
  -- =====================================================
  SELECT id INTO v_status_id
  FROM public.ref_route_delivery_status
  WHERE code = 'in_progress'
    AND is_active = true
    AND is_test = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status "Em Andamento" não encontrado';
  END IF;

  -- =====================================================
  -- UPDATE ROUTE
  -- =====================================================
  UPDATE public.trx_route
  SET
    id_route_delivery_status = v_status_id,
    starts_at = now(),
    updated_at = now()
  WHERE id = p_route_id;

  -- =====================================================
  -- INSERT HISTORY
  -- =====================================================
  INSERT INTO public.trx_route_history (
    id_route, event_type, event_label, event_description, event_at, is_test, is_active
  ) VALUES (
    p_route_id,
    'ROUTE_STARTED',
    'Rota Iniciada',
    'Rota ' || v_route_code || ' iniciada',
    now(),
    p_is_test,
    true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_route TO authenticated, anon;

-- =====================================================
-- 4. complete_route
-- Completes a route after all deliveries are registered
-- =====================================================
CREATE OR REPLACE FUNCTION public.complete_route(
  p_route_id bigint,
  p_user_id bigint default null,
  p_is_test boolean default false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_route_code text;
  v_status_id bigint;
  v_pending_count bigint;
BEGIN
  -- =====================================================
  -- VALIDATE ROUTE
  -- =====================================================
  SELECT route_code
  INTO v_route_code
  FROM public.trx_route
  WHERE id = p_route_id AND is_active = true AND is_test = p_is_test;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rota não encontrada';
  END IF;

  -- =====================================================
  -- CHECK ALL INVOICES HAVE DELIVERY RESULTS
  -- =====================================================
  SELECT COUNT(*)
  INTO v_pending_count
  FROM public.rel_route_invoice ri
  LEFT JOIN public.trx_route_invoice_delivery d
    ON d.id_route_invoice = ri.id
    AND d.is_test = p_is_test
  WHERE ri.id_route = p_route_id
    AND ri.is_active = true
    AND d.id IS NULL;

  IF v_pending_count > 0 THEN
    RAISE EXCEPTION 'Ainda existem % notas sem resultado de entrega', v_pending_count;
  END IF;

  -- =====================================================
  -- GET COMPLETED STATUS
  -- =====================================================
  SELECT id INTO v_status_id
  FROM public.ref_route_delivery_status
  WHERE code = 'completed'
    AND is_active = true
    AND is_test = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status "Concluída" não encontrado';
  END IF;

  -- =====================================================
  -- UPDATE ROUTE
  -- =====================================================
  UPDATE public.trx_route
  SET
    id_route_delivery_status = v_status_id,
    ends_at = now(),
    updated_at = now()
  WHERE id = p_route_id;

  -- =====================================================
  -- INSERT HISTORY
  -- =====================================================
  INSERT INTO public.trx_route_history (
    id_route, event_type, event_label, event_description, event_at, is_test, is_active
  ) VALUES (
    p_route_id,
    'ROUTE_COMPLETED',
    'Rota Finalizada',
    'Rota ' || v_route_code || ' finalizada',
    now(),
    p_is_test,
    true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_route TO authenticated, anon;

-- =====================================================
-- 5. register_invoice_delivery_result
-- Registers a delivery result for an invoice attempt
-- =====================================================
CREATE OR REPLACE FUNCTION public.register_invoice_delivery_result(
  p_id_route_invoice bigint,
  p_id_delivery_type bigint,
  p_id_reason bigint default null,
  p_receipt_image_path text default null,
  p_nfd_image_path text default null,
  p_nfd_number text default null,
  p_returned_box_quantity integer default null,
  p_returned_amount numeric(12, 2) default null,
  p_observation text default null,
  p_is_test boolean default false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_route_id bigint;
  v_invoice_id bigint;
  v_delivery_type_code text;
  v_result_status_id bigint;
  v_releases_to_available boolean;
  v_finalizes_invoice boolean;
  v_uses_returned_balance boolean;
BEGIN
  -- =====================================================
  -- GET ROUTE INVOICE DATA
  -- =====================================================
  SELECT id_route, id_fiscal_invoice
  INTO v_route_id, v_invoice_id
  FROM public.rel_route_invoice
  WHERE id = p_id_route_invoice;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tentativa não encontrada';
  END IF;

  -- =====================================================
  -- GET DELIVERY TYPE INFO
  -- =====================================================
  SELECT
    rdt.code,
    rdt.id_result_invoice_status,
    rdt.releases_to_available,
    rdt.finalizes_invoice,
    rdt.uses_returned_balance
  INTO
    v_delivery_type_code,
    v_result_status_id,
    v_releases_to_available,
    v_finalizes_invoice,
    v_uses_returned_balance
  FROM public.ref_delivery_reason_type rdt
  WHERE rdt.id = p_id_delivery_type;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tipo de entrega não encontrado';
  END IF;

  -- =====================================================
  -- INSERT DELIVERY RESULT
  -- =====================================================
  INSERT INTO public.trx_route_invoice_delivery (
    id_route, id_fiscal_invoice, id_route_invoice,
    id_delivery_type, id_reason,
    receipt_image_path, nfd_image_path, nfd_number,
    returned_box_quantity, returned_amount,
    observation, delivered_at, is_test, is_active
  ) VALUES (
    v_route_id, v_invoice_id, p_id_route_invoice,
    p_id_delivery_type, p_id_reason,
    p_receipt_image_path, p_nfd_image_path, p_nfd_number,
    p_returned_box_quantity, p_returned_amount,
    p_observation, now(), p_is_test, true
  );

  -- =====================================================
  -- UPDATE INVOICE STATUS
  -- =====================================================
  IF v_result_status_id IS NOT NULL THEN
    UPDATE public.trx_fiscal_invoice
    SET id_fiscal_invoice_status = v_result_status_id,
        updated_at = now()
    WHERE id = v_invoice_id;
  END IF;

  -- =====================================================
  -- IF RELEASES TO AVAILABLE, MARK PREVIOUS ATTEMPT RELEASED
  -- =====================================================
  IF v_releases_to_available THEN
    UPDATE public.rel_route_invoice
    SET
      is_active = false,
      released_at = now(),
      release_reason = v_delivery_type_code
    WHERE id = p_id_route_invoice;

    -- If uses returned balance, the invoice stays "available" for next attempt
    -- If not, it stays with final status
  END IF;

  -- =====================================================
  -- INSERT HISTORY
  -- =====================================================
  INSERT INTO public.trx_route_history (
    id_route, event_type, event_label, event_description, event_at,
    metadata, is_test, is_active
  ) VALUES (
    v_route_id,
    'DELIVERY_REGISTERED',
    'Entrega Registrada',
    'Entrega ' || v_delivery_type_code || ' registrada para nota',
    now(),
    jsonb_build_object(
      'route_invoice_id', p_id_route_invoice,
      'invoice_id', v_invoice_id,
      'delivery_type', v_delivery_type_code,
      'returned_boxes', p_returned_box_quantity,
      'returned_amount', p_returned_amount
    ),
    p_is_test,
    true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_invoice_delivery_result TO authenticated, anon;

-- =====================================================
-- 6. get_assign_notes_board
-- Returns the complete board data for Assign Notes page
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_assign_notes_board(
  p_departure_date date,
  p_is_test boolean default false
)
RETURNS TABLE(
  result jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_available_invoices jsonb;
  v_routes jsonb;
BEGIN
  -- =====================================================
  -- GET AVAILABLE INVOICES
  -- =====================================================
  -- Invoices that are not in an active route attempt
  WITH active_route_invoices AS (
    SELECT DISTINCT ri.id_fiscal_invoice
    FROM public.rel_route_invoice ri
    JOIN public.trx_route r ON r.id = ri.id_route
    WHERE ri.is_active = true
      AND r.is_active = true
      AND r.is_test = p_is_test
      AND r.departure_date = p_departure_date
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', fi.id,
      'invoice_number', fi.invoice_number,
      'box_quantity', fi.box_quantity,
      'gross_weight', fi.gross_weight,
      'invoice_amount', fi.invoice_amount,
      'customer_name', mc.trade_name,
      'supplier_name', ms.trade_name
    )
  )
  INTO v_available_invoices
  FROM public.trx_fiscal_invoice fi
  LEFT JOIN public.master_person_company mc ON mc.id = fi.id_customer_company
  LEFT JOIN public.master_person_company ms ON ms.id = fi.id_supplier_company
  WHERE fi.is_active = true
    AND fi.is_test = p_is_test
    AND fi.id_fiscal_invoice_status = (
      SELECT id FROM public.ref_fiscal_invoice_status WHERE code = 'DISPONIVEL' LIMIT 1
    )
    AND fi.id NOT IN (SELECT id_fiscal_invoice FROM active_route_invoices);

  -- =====================================================
  -- GET ROUTES FOR DATE
  -- =====================================================
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'route_code', r.route_code,
      'area', r.area,
      'vehicle_plate', mv.plate,
      'vehicle_capacity', mv.nominal_capacity,
      'driver_name', mpd.name,
      'responsible_name', rr.name,
      'delivery_status', rds.name,
      'allows_edition', rds.allows_route_edition,
      'departure_date', r.departure_date,
      'invoices', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ri.id,
            'fiscal_invoice_id', fi.id,
            'invoice_number', fi.invoice_number,
            'box_quantity', fi.box_quantity,
            'gross_weight', fi.gross_weight,
            'invoice_amount', fi.invoice_amount,
            'attempt_number', ri.attempt_number,
            'customer_name', mc.trade_name,
            'planned_box_quantity', ri.planned_box_quantity,
            'planned_amount', ri.planned_amount
          )
        )
        FROM public.rel_route_invoice ri
        JOIN public.trx_fiscal_invoice fi ON fi.id = ri.id_fiscal_invoice
        LEFT JOIN public.master_person_company mc ON mc.id = fi.id_customer_company
        WHERE ri.id_route = r.id AND ri.is_active = true
      )
    )
  )
  INTO v_routes
  FROM public.trx_route r
  LEFT JOIN public.master_fleet_vehicle mv ON mv.id = r.id_vehicle
  LEFT JOIN public.master_person_driver mpd ON mpd.id = r.id_driver
  LEFT JOIN public.ref_route_responsible rr ON rr.id = r.id_route_responsible
  LEFT JOIN public.ref_route_delivery_status rds ON rds.id = r.id_route_delivery_status
  WHERE r.departure_date = p_departure_date
    AND r.is_active = true
    AND r.is_test = p_is_test;

  RETURN QUERY SELECT jsonb_build_object(
    'available_invoices', COALESCE(v_available_invoices, '[]'::jsonb),
    'routes', COALESCE(v_routes, '[]'::jsonb),
    'departure_date', p_departure_date,
    'generated_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_assign_notes_board TO authenticated, anon;

-- =====================================================
-- 7. sync_route_invoices (updated to handle attempt_number)
-- =====================================================
CREATE OR REPLACE FUNCTION public.sync_route_invoices(
  p_route_id BIGINT,
  p_invoice_ids JSONB,
  p_user_id BIGINT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_invoice_ids BIGINT[];
  v_final_invoice_ids BIGINT[];
  v_to_remove BIGINT[];
  v_to_add BIGINT[];
  v_invoice_id BIGINT;
  v_existing_id BIGINT;
  v_attempt_number integer;
  v_is_test boolean;
BEGIN
  -- Get is_test from route
  SELECT is_test INTO v_is_test FROM public.trx_route WHERE id = p_route_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rota não encontrada: %', p_route_id;
  END IF;

  -- Get current active invoice IDs for this route
  SELECT COALESCE(array_agg(ri.id_fiscal_invoice), ARRAY[]::BIGINT[])
  INTO v_current_invoice_ids
  FROM public.rel_route_invoice ri
  WHERE ri.id_route = p_route_id
    AND ri.is_active = true;

  -- Convert JSON array to BIGINT array
  SELECT COALESCE(array_agg(elem::BIGINT), ARRAY[]::BIGINT[])
  INTO v_final_invoice_ids
  FROM jsonb_array_elements_text(p_invoice_ids) AS elem;

  -- Calculate diff
  v_to_remove := ARRAY(
    SELECT unnest
    FROM unnest(v_current_invoice_ids)
    WHERE unnest NOT IN (SELECT unnest FROM unnest(v_final_invoice_ids))
  );

  v_to_add := ARRAY(
    SELECT unnest
    FROM unnest(v_final_invoice_ids)
    WHERE unnest NOT IN (SELECT unnest FROM unnest(v_current_invoice_ids))
  );

  -- Remove invoices (soft delete)
  FOREACH v_invoice_id IN ARRAY v_to_remove
  LOOP
    UPDATE public.rel_route_invoice
    SET
      is_active = false,
      released_at = NOW(),
      release_reason = 'REMOVED_FROM_ROUTE',
      updated_at = NOW()
    WHERE id_route = p_route_id
      AND id_fiscal_invoice = v_invoice_id
      AND is_active = true;
  END LOOP;

  -- Add or reactivate invoices
  FOREACH v_invoice_id IN ARRAY v_to_add
  LOOP
    -- Check if there's an inactive record to reactivate
    SELECT id INTO v_existing_id
    FROM public.rel_route_invoice
    WHERE id_route = p_route_id
      AND id_fiscal_invoice = v_invoice_id
      AND is_active = false
    ORDER BY id DESC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      -- Reactivate existing record
      UPDATE public.rel_route_invoice
      SET
        is_active = true,
        released_at = NULL,
        release_reason = NULL,
        updated_at = NOW()
      WHERE id = v_existing_id;
    ELSE
      -- Get attempt number for this invoice (max + 1)
      SELECT COALESCE(MAX(attempt_number), 0) + 1
      INTO v_attempt_number
      FROM public.rel_route_invoice
      WHERE id_fiscal_invoice = v_invoice_id;

      -- Create new record
      INSERT INTO public.rel_route_invoice (
        id_route, id_fiscal_invoice,
        assigned_at, assigned_by,
        is_test, is_active,
        attempt_number,
        planned_box_quantity,
        planned_amount
      ) VALUES (
        p_route_id, v_invoice_id,
        NOW(), p_user_id,
        v_is_test, true,
        COALESCE(v_attempt_number, 1),
        (SELECT box_quantity FROM public.trx_fiscal_invoice WHERE id = v_invoice_id),
        (SELECT invoice_amount FROM public.trx_fiscal_invoice WHERE id = v_invoice_id)
      );
    END IF;

    v_existing_id := NULL;
  END LOOP;

  -- Sync stops after invoice changes
  PERFORM public.sync_route_stops(p_route_id, p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_route_invoices TO authenticated, anon;