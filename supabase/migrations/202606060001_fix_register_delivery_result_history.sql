-- =====================================================
-- FIX: register_invoice_delivery_result fails when
-- trx_route_history does not have event_type column.
--
-- The table was created with the old schema:
--   (id_route, id_history_type, event_at, description, ...)
-- The RPC was written expecting the new schema:
--   (id_route, event_type, event_label, event_description, ...)
--
-- Fix: check at runtime (same pattern as other RPCs),
-- branch to old INSERT if event_type column is absent.
-- =====================================================

CREATE OR REPLACE FUNCTION public.register_invoice_delivery_result(
  p_id_route_invoice    bigint,
  p_id_delivery_type    bigint,
  p_id_reason           bigint          DEFAULT NULL,
  p_receipt_image_path  text            DEFAULT NULL,
  p_nfd_image_path      text            DEFAULT NULL,
  p_nfd_number          text            DEFAULT NULL,
  p_returned_box_quantity integer        DEFAULT NULL,
  p_returned_amount     numeric(12, 2)  DEFAULT NULL,
  p_observation         text            DEFAULT NULL,
  p_is_test             boolean         DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_route_id                bigint;
  v_invoice_id              bigint;
  v_result_status_id        bigint;
  v_releases_to_available   boolean;
  v_has_history_event_type  boolean;
BEGIN
  -- 1. Resolve route + invoice from the junction record
  SELECT id_route, id_fiscal_invoice
  INTO   v_route_id, v_invoice_id
  FROM   public.rel_route_invoice
  WHERE  id = p_id_route_invoice;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tentativa não encontrada';
  END IF;

  -- 2. Resolve delivery type metadata
  SELECT id_result_invoice_status, releases_to_available
  INTO   v_result_status_id, v_releases_to_available
  FROM   public.ref_delivery_reason_type
  WHERE  id = p_id_delivery_type;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tipo de entrega não encontrado';
  END IF;

  -- 3. Save delivery result
  INSERT INTO public.trx_route_invoice_delivery (
    id_route, id_fiscal_invoice, id_route_invoice,
    id_delivery_type, id_reason,
    receipt_image_path, nfd_image_path, nfd_number,
    returned_box_quantity, returned_amount, observation,
    delivered_at, is_test, is_active
  ) VALUES (
    v_route_id, v_invoice_id, p_id_route_invoice,
    p_id_delivery_type, p_id_reason,
    p_receipt_image_path, p_nfd_image_path, p_nfd_number,
    p_returned_box_quantity, p_returned_amount, p_observation,
    now(), p_is_test, true
  );

  -- 4. Update invoice status if applicable
  IF v_result_status_id IS NOT NULL THEN
    UPDATE public.trx_fiscal_invoice
    SET    id_fiscal_invoice_status = v_result_status_id,
           updated_at               = now()
    WHERE  id = v_invoice_id;
  END IF;

  -- 5. Release invoice from route if applicable
  IF v_releases_to_available THEN
    UPDATE public.rel_route_invoice
    SET    is_active       = false,
           released_at     = now(),
           release_reason  = 'DELIVERY_REGISTERED'
    WHERE  id = p_id_route_invoice;
  END IF;

  -- 6. Write history — conditional on which schema the table has
  SELECT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'trx_route_history'
      AND  column_name  = 'event_type'
  ) INTO v_has_history_event_type;

  IF v_has_history_event_type THEN
    INSERT INTO public.trx_route_history (
      id_route, event_type, event_label, event_description,
      event_at, metadata, is_test, is_active
    ) VALUES (
      v_route_id,
      'DELIVERY_REGISTERED',
      'Entrega Registrada',
      'Entrega registrada',
      now(),
      jsonb_build_object(
        'route_invoice_id', p_id_route_invoice,
        'invoice_id',       v_invoice_id
      ),
      p_is_test,
      true
    );
  ELSE
    INSERT INTO public.trx_route_history (
      id_route, id_history_type, event_at, description, is_test, is_active
    ) VALUES (
      v_route_id, NULL, now(), 'Entrega registrada', p_is_test, true
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_invoice_delivery_result TO authenticated, anon;
