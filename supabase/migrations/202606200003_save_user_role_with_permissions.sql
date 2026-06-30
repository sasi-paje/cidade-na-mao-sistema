-- ============================================================
-- RPC: save_user_role_with_permissions
-- Cria ou atualiza cargo + permissões numa única transação.
-- Elimina a janela de inconsistência entre INSERT/UPDATE e
-- o DELETE/INSERT de permissões em master_user_role_permission.
--
-- p_role_id = null  → criar novo cargo
-- p_role_id = <id>  → atualizar cargo existente
-- ============================================================

CREATE OR REPLACE FUNCTION public.save_user_role_with_permissions(
  p_role_id        integer,
  p_name           text,
  p_code           text,
  p_is_test        boolean,
  p_permission_ids integer[]
)
RETURNS TABLE(id bigint, name text, code text, is_active boolean, is_test boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cargo_id     bigint;
  v_trimmed_name text;
  v_view_id      integer;
  v_final_ids    integer[];
  v_invalid_cnt  integer;
BEGIN
  -- Normalizar nome
  v_trimmed_name := trim(p_name);

  IF v_trimmed_name = '' OR v_trimmed_name IS NULL THEN
    RAISE EXCEPTION 'Informe o nome do cargo.';
  END IF;

  -- Validar unicidade do nome no mesmo ambiente
  IF p_role_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.master_user_role
      WHERE  name    = v_trimmed_name
        AND  is_test = p_is_test
    ) THEN
      RAISE EXCEPTION 'Já existe um cargo cadastrado com este nome.';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.master_user_role
      WHERE  name    = v_trimmed_name
        AND  is_test = p_is_test
        AND  id      != p_role_id
    ) THEN
      RAISE EXCEPTION 'Já existe outro cargo cadastrado com este nome.';
    END IF;
  END IF;

  -- Buscar permissão VIEW sem hardcode de ID
  SELECT id INTO v_view_id
  FROM   public.master_system_permission
  WHERE  code      = 'VIEW'
    AND  is_active = true
    AND  is_test   = false
  LIMIT 1;

  IF v_view_id IS NULL THEN
    RAISE EXCEPTION 'Permissão padrão Visualizar não encontrada.';
  END IF;

  -- Montar array final: VIEW sempre incluído, sem duplicatas
  SELECT ARRAY(
    SELECT DISTINCT unnest(COALESCE(p_permission_ids, ARRAY[]::integer[]) || ARRAY[v_view_id])
  ) INTO v_final_ids;

  -- Validar que todas as permissões existem, estão ativas e não são de teste
  SELECT COUNT(*) INTO v_invalid_cnt
  FROM   unnest(v_final_ids) AS pid
  WHERE  pid NOT IN (
    SELECT id FROM public.master_system_permission
    WHERE  is_active = true AND is_test = false
  );

  IF v_invalid_cnt > 0 THEN
    RAISE EXCEPTION 'Uma ou mais permissões inválidas ou inativas foram enviadas.';
  END IF;

  -- Criar ou atualizar cargo
  IF p_role_id IS NULL THEN
    INSERT INTO public.master_user_role (name, code, is_active, is_test)
    VALUES (v_trimmed_name, p_code, true, p_is_test)
    RETURNING id INTO v_cargo_id;
  ELSE
    UPDATE public.master_user_role
    SET    name       = v_trimmed_name,
           updated_at = now()
    WHERE  id      = p_role_id
      AND  is_test = p_is_test
    RETURNING id INTO v_cargo_id;

    IF v_cargo_id IS NULL THEN
      RAISE EXCEPTION 'Cargo não encontrado.';
    END IF;
  END IF;

  -- Substituir permissões atomicamente (sem is_active/is_test — colunas não existem)
  DELETE FROM public.master_user_role_permission WHERE role_id = v_cargo_id;

  INSERT INTO public.master_user_role_permission (role_id, permission_id)
  SELECT v_cargo_id, pid FROM unnest(v_final_ids) AS pid;

  -- Retornar cargo salvo
  RETURN QUERY
    SELECT r.id, r.name, r.code, r.is_active, r.is_test
    FROM   public.master_user_role r
    WHERE  r.id = v_cargo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_user_role_with_permissions(integer, text, text, boolean, integer[]) TO anon;
GRANT EXECUTE ON FUNCTION public.save_user_role_with_permissions(integer, text, text, boolean, integer[]) TO authenticated;

-- Recarregar schema cache do PostgREST
SELECT pg_notify('pgrst', 'reload schema');
