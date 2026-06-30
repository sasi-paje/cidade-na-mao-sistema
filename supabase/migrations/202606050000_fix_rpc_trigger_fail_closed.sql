-- =====================================================
-- FIX: fail-closed em update_route_from_assign_notes e trigger rel_route_invoice
--
-- Problema: ambos usavam `= false` para checar allows_route_edition.
-- Isso NÃO é fail-closed: quando o status não é encontrado (NULL),
-- `NULL = false` retorna NULL (falso), e a edição era permitida.
--
-- Correção: usar `IS NOT TRUE` — bloqueia se NULL ou false.
-- Regra: somente allows_route_edition = true libera edição.
-- =====================================================

-- =====================================================
-- 1. update_route_from_assign_notes (8 params — versão chamada pelo frontend)
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_route_from_assign_notes(
  p_route_id            bigint,
  p_departure_date      date       DEFAULT NULL,
  p_id_route_responsible bigint    DEFAULT NULL,
  p_id_driver           bigint     DEFAULT NULL,
  p_area                text       DEFAULT NULL,
  p_assistant           text[]     DEFAULT NULL,
  p_invoice_ids         bigint[]   DEFAULT NULL,
  p_is_test             boolean    DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status_id     bigint;
  v_allows_edition        boolean;
  v_has_history_event_type boolean;
  v_route_code            text;
BEGIN
  SELECT id_route_delivery_status, route_code
  INTO   v_current_status_id, v_route_code
  FROM   public.trx_route
  WHERE  id = p_route_id
    AND  is_active = true
    AND  is_test   = p_is_test;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rota nao encontrada';
  END IF;

  SELECT allows_route_edition
  INTO   v_allows_edition
  FROM   public.ref_route_delivery_status
  WHERE  id = v_current_status_id;

  -- fail-closed: NULL (status não encontrado) ou false bloqueiam
  IF v_allows_edition IS NOT TRUE THEN
    RAISE EXCEPTION 'Rota em andamento. A montagem não pode mais ser alterada.'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.trx_route
  SET
    departure_date         = COALESCE(p_departure_date,       departure_date),
    id_route_responsible   = COALESCE(p_id_route_responsible, id_route_responsible),
    id_driver              = COALESCE(p_id_driver,            id_driver),
    area                   = COALESCE(p_area,                 area),
    assistant              = COALESCE(p_assistant,            assistant),
    updated_at             = now()
  WHERE id = p_route_id;

  IF p_invoice_ids IS NOT NULL THEN
    PERFORM public.sync_route_invoices(p_route_id, to_jsonb(p_invoice_ids::text[]), NULL);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'trx_route_history'
      AND  column_name  = 'event_type'
  ) INTO v_has_history_event_type;

  IF v_has_history_event_type THEN
    INSERT INTO public.trx_route_history (
      id_route, event_type, event_label, event_description, event_at, is_test, is_active
    ) VALUES (
      p_route_id, 'ROUTE_UPDATED', 'Rota Atualizada',
      'Rota ' || v_route_code || ' atualizada',
      now(), p_is_test, true
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_route_from_assign_notes(bigint, date, bigint, bigint, text, text[], bigint[], boolean)
  TO authenticated, anon;

-- =====================================================
-- 2. update_route_from_assign_notes (6 params — versão legada de 202606010001)
--    Corrigida por segurança, mas NÃO é a chamada pelo frontend.
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_route_from_assign_notes(
  p_route_id    bigint,
  p_id_driver   bigint   DEFAULT NULL,
  p_area        text     DEFAULT NULL,
  p_assistant   text[]   DEFAULT NULL,
  p_invoice_ids bigint[] DEFAULT NULL,
  p_is_test     boolean  DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status_id bigint;
  v_allows_edition    boolean;
BEGIN
  SELECT id_route_delivery_status
  INTO   v_current_status_id
  FROM   public.trx_route
  WHERE  id = p_route_id AND is_active = true AND is_test = p_is_test;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rota não encontrada';
  END IF;

  SELECT allows_route_edition
  INTO   v_allows_edition
  FROM   public.ref_route_delivery_status
  WHERE  id = v_current_status_id;

  IF v_allows_edition IS NOT TRUE THEN
    RAISE EXCEPTION 'Rota em andamento. A montagem não pode mais ser alterada.'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.trx_route
  SET
    id_driver   = COALESCE(p_id_driver,  id_driver),
    area        = COALESCE(p_area,       area),
    assistant   = COALESCE(p_assistant,  assistant),
    updated_at  = now()
  WHERE id = p_route_id;

  IF p_invoice_ids IS NOT NULL THEN
    PERFORM public.sync_route_invoices(p_route_id, to_jsonb(p_invoice_ids::text[]), NULL);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_route_from_assign_notes(bigint, bigint, text, text[], bigint[], boolean)
  TO authenticated, anon;

-- =====================================================
-- 3. check_route_invoice_edition_allowed (trigger em rel_route_invoice)
-- =====================================================
CREATE OR REPLACE FUNCTION public.check_route_invoice_edition_allowed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status_id      bigint;
  v_allows_edition boolean;
  v_route_id       bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_route_id := OLD.id_route;
  ELSE
    v_route_id := NEW.id_route;
  END IF;

  SELECT id_route_delivery_status
  INTO   v_status_id
  FROM   public.trx_route
  WHERE  id = v_route_id
    AND  is_active = true;

  IF NOT FOUND THEN
    -- Rota não encontrada ou inativa — não é rota de montagem ativa, permite
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT allows_route_edition
  INTO   v_allows_edition
  FROM   public.ref_route_delivery_status
  WHERE  id = v_status_id;

  -- fail-closed: NULL (status não encontrado) ou false bloqueiam
  IF v_allows_edition IS NOT TRUE THEN
    RAISE EXCEPTION 'Rota em andamento. A montagem não pode mais ser alterada.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_rel_route_invoice ON public.rel_route_invoice;

CREATE TRIGGER trg_lock_rel_route_invoice
  BEFORE INSERT OR UPDATE OR DELETE ON public.rel_route_invoice
  FOR EACH ROW
  EXECUTE FUNCTION public.check_route_invoice_edition_allowed();
