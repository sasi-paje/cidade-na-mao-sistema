-- =====================================================
-- FIX: attempt_number deve respeitar is_test e ser
--      calculado corretamente em ambas as RPCs:
--
-- 1. create_route_from_assign_notes: faltava
--    AND is_test = p_is_test no SELECT de attempt_number
--
-- 2. sync_route_invoices (update_route_from_assign_notes):
--    INSERT em rel_route_invoice não definia
--    attempt_number nem id_previous_route_invoice.
--    Também corrige reativação: registros liberados por
--    entrega (released_at IS NOT NULL) não devem ser
--    reativados — devem gerar nova linha com tentativa + 1.
-- =====================================================

-- ── 1. create_route_from_assign_notes ─────────────────
CREATE OR REPLACE FUNCTION public.create_route_from_assign_notes(
  p_id_vehicle            bigint,
  p_departure_date        date,
  p_id_route_responsible  bigint,
  p_id_driver             bigint    DEFAULT NULL,
  p_area                  text      DEFAULT NULL,
  p_assistant             text[]    DEFAULT NULL,
  p_invoice_ids           bigint[]  DEFAULT NULL,
  p_is_test               boolean   DEFAULT false
)
RETURNS TABLE(p_id bigint, p_route_code text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_route_id                  bigint;
  v_route_code                text;
  v_id_route_status           bigint;
  v_id_route_delivery_status  bigint;
  v_invoice_id                bigint;
  v_attempt_number            integer;
  v_previous_route_invoice_id bigint;
  v_assistant_is_array        boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.master_fleet_vehicle
    WHERE id = p_id_vehicle AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Veiculo invalido ou inativo';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ref_route_responsible
    WHERE id = p_id_route_responsible AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Responsavel invalido ou inativo';
  END IF;

  IF p_id_driver IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.master_person_driver
    WHERE id = p_id_driver AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Motorista invalido ou inativo';
  END IF;

  IF p_invoice_ids IS NOT NULL AND array_length(p_invoice_ids, 1) > 0 THEN
    FOREACH v_invoice_id IN ARRAY p_invoice_ids
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.trx_fiscal_invoice
        WHERE id = v_invoice_id AND is_active = true AND is_test = p_is_test
      ) THEN
        RAISE EXCEPTION 'Nota % nao existe ou nao esta disponivel', v_invoice_id;
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.rel_route_invoice
        WHERE id_fiscal_invoice = v_invoice_id AND is_active = true
      ) THEN
        RAISE EXCEPTION 'Nota % ja esta em uma rota ativa', v_invoice_id;
      END IF;
    END LOOP;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.trx_route
    WHERE id_vehicle = p_id_vehicle
      AND departure_date = p_departure_date
      AND is_active = true
      AND is_test = p_is_test
  ) THEN
    RAISE EXCEPTION 'Ja existe uma rota ativa para este veiculo nesta data';
  END IF;

  SELECT id INTO v_id_route_status
  FROM public.ref_route_status
  WHERE is_initial = true AND is_active = true
  ORDER BY id LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status inicial da rota nao encontrado';
  END IF;

  SELECT id INTO v_id_route_delivery_status
  FROM public.ref_route_delivery_status
  WHERE is_initial = true AND is_active = true
  ORDER BY id LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status inicial da entrega nao encontrado';
  END IF;

  SELECT coalesce(max(route_code::integer), 0) + 1
  INTO v_route_code
  FROM public.trx_route
  WHERE is_test = p_is_test AND route_code ~ '^[0-9]+$';

  v_route_code := lpad(v_route_code::text, 6, '0');

  SELECT data_type = 'ARRAY'
  INTO v_assistant_is_array
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'trx_route'
    AND column_name  = 'assistant';

  IF coalesce(v_assistant_is_array, false) THEN
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
  ELSE
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
      p_area, array_to_string(p_assistant, ', '),
      p_is_test, true,
      p_id_route_responsible
    )
    RETURNING id INTO v_route_id;
  END IF;

  IF p_invoice_ids IS NOT NULL AND array_length(p_invoice_ids, 1) > 0 THEN
    FOREACH v_invoice_id IN ARRAY p_invoice_ids
    LOOP
      -- FIXED: filter by is_test so test and prod attempts don't mix
      SELECT coalesce(max(attempt_number), 0) + 1, max(id)
      INTO v_attempt_number, v_previous_route_invoice_id
      FROM public.rel_route_invoice
      WHERE id_fiscal_invoice = v_invoice_id
        AND is_test = p_is_test;

      INSERT INTO public.rel_route_invoice (
        id_route, id_fiscal_invoice,
        assigned_at,
        is_test, is_active,
        attempt_number,
        id_previous_route_invoice,
        planned_box_quantity,
        planned_amount
      ) VALUES (
        v_route_id, v_invoice_id,
        now(),
        p_is_test, true,
        coalesce(v_attempt_number, 1),
        v_previous_route_invoice_id,
        (SELECT box_quantity    FROM public.trx_fiscal_invoice WHERE id = v_invoice_id),
        (SELECT invoice_amount  FROM public.trx_fiscal_invoice WHERE id = v_invoice_id)
      );

      UPDATE public.trx_fiscal_invoice
      SET id_fiscal_invoice_status = (
        SELECT id FROM public.ref_fiscal_invoice_status
        WHERE code = 'EM_ROTA' LIMIT 1
      )
      WHERE id = v_invoice_id;
    END LOOP;

    PERFORM public.sync_route_stops(v_route_id, NULL);
  END IF;

  RETURN QUERY SELECT v_route_id, v_route_code::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_route_from_assign_notes TO authenticated, anon;

-- ── 2. sync_route_invoices ─────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_route_invoices(
  p_route_id   bigint,
  p_invoice_ids jsonb,
  p_user_id    bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_invoice_ids   bigint[];
  v_final_invoice_ids     bigint[];
  v_to_add                bigint[];
  v_to_remove             bigint[];
  v_invoice_id            bigint;
  v_existing_id           bigint;
  v_attempt_number        integer;
  v_prev_route_invoice_id bigint;
  v_route_is_test         boolean;
BEGIN
  -- Cache is_test from route once
  SELECT is_test INTO v_route_is_test
  FROM public.trx_route
  WHERE id = p_route_id
  LIMIT 1;

  -- Current active invoices for this route
  SELECT coalesce(array_agg(ri.id_fiscal_invoice), array[]::bigint[])
  INTO v_current_invoice_ids
  FROM public.rel_route_invoice ri
  WHERE ri.id_route  = p_route_id
    AND ri.is_active = true
    AND ri.is_test   = coalesce(v_route_is_test, false);

  -- Desired invoice list from JSON input
  SELECT coalesce(array_agg(elem::bigint), array[]::bigint[])
  INTO v_final_invoice_ids
  FROM jsonb_array_elements_text(p_invoice_ids) AS elem;

  -- Diff
  v_to_remove := array(
    SELECT unnest FROM unnest(v_current_invoice_ids)
    WHERE unnest NOT IN (SELECT unnest FROM unnest(v_final_invoice_ids))
  );

  v_to_add := array(
    SELECT unnest FROM unnest(v_final_invoice_ids)
    WHERE unnest NOT IN (SELECT unnest FROM unnest(v_current_invoice_ids))
  );

  -- Soft-delete removed invoices
  FOREACH v_invoice_id IN ARRAY v_to_remove
  LOOP
    UPDATE public.rel_route_invoice
    SET is_active     = false,
        unassigned_at = now(),
        unassigned_by = p_user_id,
        updated_at    = now()
    WHERE id_route          = p_route_id
      AND id_fiscal_invoice = v_invoice_id
      AND is_active         = true;
  END LOOP;

  -- Add invoices: reactivate if unassigned from same route, else insert new
  FOREACH v_invoice_id IN ARRAY v_to_add
  LOOP
    -- Only reactivate if the record was manually unassigned (released_at IS NULL).
    -- A released record (released_at IS NOT NULL) means delivery failed on a
    -- previous route; it must become a new attempt, not a reactivation.
    SELECT id INTO v_existing_id
    FROM public.rel_route_invoice
    WHERE id_route          = p_route_id
      AND id_fiscal_invoice = v_invoice_id
      AND is_active         = false
      AND released_at       IS NULL
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.rel_route_invoice
      SET is_active     = true,
          unassigned_at = NULL,
          unassigned_by = NULL,
          updated_at    = now()
      WHERE id = v_existing_id;
    ELSE
      -- New assignment: calculate attempt_number = MAX(existing) + 1
      SELECT coalesce(max(rri.attempt_number), 0) + 1, max(rri.id)
      INTO v_attempt_number, v_prev_route_invoice_id
      FROM public.rel_route_invoice rri
      WHERE rri.id_fiscal_invoice = v_invoice_id
        AND rri.is_test           = coalesce(v_route_is_test, false);

      INSERT INTO public.rel_route_invoice (
        id_route,
        id_fiscal_invoice,
        assigned_at,
        assigned_by,
        is_test,
        is_active,
        attempt_number,
        id_previous_route_invoice
      ) VALUES (
        p_route_id,
        v_invoice_id,
        now(),
        p_user_id,
        v_route_is_test,
        true,
        coalesce(v_attempt_number, 1),
        v_prev_route_invoice_id
      );
    END IF;

    v_existing_id           := NULL;
    v_attempt_number        := NULL;
    v_prev_route_invoice_id := NULL;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_route_invoices TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
