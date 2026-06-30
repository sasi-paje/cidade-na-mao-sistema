-- Function to sync route invoices
-- Adds new invoices, removes inactive ones, and reactivates previously removed ones
CREATE OR REPLACE FUNCTION sync_route_invoices(
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
  v_to_add BIGINT[];
  v_to_remove BIGINT[];
  v_invoice_id BIGINT;
  v_existing_id BIGINT;
BEGIN
  -- Get current active invoice IDs for this route (using is_test from route)
  SELECT COALESCE(array_agg(ri.id_fiscal_invoice), ARRAY[]::BIGINT[])
  INTO v_current_invoice_ids
  FROM rel_route_invoice ri
  WHERE ri.id_route = p_route_id
    AND ri.is_active = true
    AND ri.is_test = COALESCE((SELECT is_test FROM trx_route WHERE id = p_route_id LIMIT 1), false);

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
    UPDATE rel_route_invoice
    SET
      is_active = false,
      unassigned_at = NOW(),
      unassigned_by = p_user_id,
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
    FROM rel_route_invoice
    WHERE id_route = p_route_id
      AND id_fiscal_invoice = v_invoice_id
      AND is_active = false
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      -- Reactivate existing record
      UPDATE rel_route_invoice
      SET
        is_active = true,
        unassigned_at = NULL,
        unassigned_by = NULL,
        updated_at = NOW()
      WHERE id = v_existing_id;
    ELSE
      -- Create new record
      INSERT INTO rel_route_invoice (
        id_route,
        id_fiscal_invoice,
        assigned_at,
        assigned_by,
        is_test,
        is_active
      )
      VALUES (
        p_route_id,
        v_invoice_id,
        NOW(),
        p_user_id,
        (SELECT is_test FROM trx_route WHERE id = p_route_id LIMIT 1),
        true
      );
    END IF;

    v_existing_id := NULL;
  END LOOP;
END;
$$;
