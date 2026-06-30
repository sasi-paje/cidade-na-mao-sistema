-- =====================================================
-- FIX: trx_route.is_active nasce false em rotas criadas
--      pela tela Atribuir Notas.
--
-- Causa provável: versão mais antiga de
-- create_route_from_assign_notes implantada no banco
-- (sem is_active = true explícito) + DEFAULT da coluna
-- possivelmente false.
--
-- Correção:
-- 1. Garantir DEFAULT true na coluna.
-- 2. Re-implantar create_route_from_assign_notes com
--    is_active = true em ambos os branches do INSERT.
-- =====================================================

-- 1. Corrigir DEFAULT da coluna ----------------------
ALTER TABLE public.trx_route
  ALTER COLUMN is_active SET DEFAULT true;

-- 2. Re-implantar a RPC com is_active = true explícito
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
  -- Validações de entrada
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

  -- Buscar status inicial da rota
  SELECT id INTO v_id_route_status
  FROM public.ref_route_status
  WHERE is_initial = true AND is_active = true
  ORDER BY id LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status inicial da rota nao encontrado';
  END IF;

  -- Buscar status inicial de entrega
  SELECT id INTO v_id_route_delivery_status
  FROM public.ref_route_delivery_status
  WHERE is_initial = true AND is_active = true
  ORDER BY id LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Status inicial da entrega nao encontrado';
  END IF;

  -- Gerar código da rota
  SELECT coalesce(max(route_code::integer), 0) + 1
  INTO v_route_code
  FROM public.trx_route
  WHERE is_test = p_is_test AND route_code ~ '^[0-9]+$';

  v_route_code := lpad(v_route_code::text, 6, '0');

  -- Detectar tipo da coluna assistant (ARRAY vs TEXT)
  SELECT data_type = 'ARRAY'
  INTO v_assistant_is_array
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'trx_route'
    AND column_name  = 'assistant';

  -- Inserir rota — is_active = true explícito em ambos os branches
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
      p_is_test, true,           -- is_active = true
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
      p_is_test, true,           -- is_active = true
      p_id_route_responsible
    )
    RETURNING id INTO v_route_id;
  END IF;

  -- Vincular notas à rota
  IF p_invoice_ids IS NOT NULL AND array_length(p_invoice_ids, 1) > 0 THEN
    FOREACH v_invoice_id IN ARRAY p_invoice_ids
    LOOP
      SELECT coalesce(max(attempt_number), 0) + 1, max(id)
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

-- Verificação de sanidade (não bloqueia a migration em caso de falha)
DO $$
DECLARE
  v_default text;
BEGIN
  SELECT column_default INTO v_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'trx_route'
    AND column_name  = 'is_active';

  IF v_default IS DISTINCT FROM 'true' THEN
    RAISE WARNING
      'trx_route.is_active DEFAULT ainda nao é true (valor atual: %)', v_default;
  ELSE
    RAISE NOTICE 'trx_route.is_active DEFAULT = true — OK';
  END IF;
END $$;
