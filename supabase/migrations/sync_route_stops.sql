-- Sync route stops based on invoices assigned to route
-- Creates trx_route_stop entries for each unique company/destination in the route's invoices
-- Updates rel_route_invoice.id_route_stop to link each invoice to its stop

CREATE OR REPLACE FUNCTION sync_route_stops(
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
  v_company_ids BIGINT[];
  v_stop_id BIGINT;
  v_invoice_id BIGINT;
  v_count_stops_created BIGINT := 0;
  v_count_stops_existing BIGINT := 0;
  v_count_invoices_linked BIGINT := 0;
  v_route_stop RECORD;
BEGIN
  -- Get is_test from route
  SELECT is_test INTO v_is_test FROM trx_route WHERE id = p_route_id LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rota não encontrada: %', p_route_id;
  END IF;

  -- Get all unique company IDs from active invoices in this route
  SELECT COALESCE(array_agg(DISTINCT fi.id_customer_company), ARRAY[]::BIGINT[])
  INTO v_company_ids
  FROM rel_route_invoice ri
  JOIN trx_fiscal_invoice fi ON fi.id = ri.id_fiscal_invoice
  WHERE ri.id_route = p_route_id
    AND ri.is_active = true
    AND fi.id_customer_company IS NOT NULL
    AND fi.id_customer_company <> 0;

  -- Create or find stops for each company
  FOREACH v_company_id IN ARRAY v_company_ids
  LOOP
    -- Check if stop already exists
    SELECT id INTO v_stop_id
    FROM trx_route_stop
    WHERE id_route = p_route_id
      AND id_company = v_company_id
      AND is_test = v_is_test
    LIMIT 1;

    IF v_stop_id IS NULL THEN
      -- Create new stop
      INSERT INTO trx_route_stop (
        id_route,
        id_company,
        stop_sequence,
        is_active,
        is_test,
        created_by,
        updated_by
      )
      VALUES (
        p_route_id,
        v_company_id,
        (
          SELECT COALESCE(MAX(stop_sequence), 0) + 1
          FROM trx_route_stop
          WHERE id_route = p_route_id AND is_test = v_is_test
        ),
        true,
        v_is_test,
        p_user_id,
        p_user_id
      )
      RETURNING id INTO v_stop_id;

      v_count_stops_created := v_count_stops_created + 1;
    ELSE
      v_count_stops_existing := v_count_stops_existing + 1;
    END IF;

    -- Link all invoices for this company+route to this stop
    UPDATE rel_route_invoice
    SET id_route_stop = v_stop_id,
        updated_at = NOW(),
        updated_by = p_user_id
    WHERE id_route = p_route_id
      AND is_active = true
      AND id_fiscal_invoice IN (
        SELECT id FROM trx_fiscal_invoice
        WHERE id_customer_company = v_company_id
      );

    GET DIAGNOSTICS v_count_invoices_linked = ROW_COUNT;
  END LOOP;

  RETURN QUERY SELECT
    v_count_stops_created,
    v_count_stops_existing,
    v_count_invoices_linked;
END;
$$;

-- Add id_route_stop column to rel_route_invoice if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rel_route_invoice'
      AND column_name = 'id_route_stop'
  ) THEN
    ALTER TABLE public.rel_route_invoice
    ADD COLUMN id_route_stop BIGINT NULL;

    COMMENT ON COLUMN public.rel_route_invoice.id_route_stop IS 'FK para trx_route_stop - indica a parada/destino desta nota na rota';
  END IF;
END;
$$;