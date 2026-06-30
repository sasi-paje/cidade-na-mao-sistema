-- ============================================================
-- RPC: inactivate_user_role
-- Inativa um cargo com validação transacional.
-- Usa master_system_user para detectar usuários ativos vinculados.
-- ============================================================

CREATE OR REPLACE FUNCTION public.inactivate_user_role(
  p_role_id integer,
  p_is_test boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validar que o cargo existe no ambiente correto
  IF NOT EXISTS (
    SELECT 1
    FROM public.master_user_role r
    WHERE r.id      = p_role_id
      AND r.is_test = p_is_test
  ) THEN
    RAISE EXCEPTION 'Cargo não encontrado.';
  END IF;

  -- Validar que o cargo está ativo
  IF NOT EXISTS (
    SELECT 1
    FROM public.master_user_role r
    WHERE r.id       = p_role_id
      AND r.is_test  = p_is_test
      AND r.is_active = true
  ) THEN
    RAISE EXCEPTION 'Cargo já está inativo.';
  END IF;

  -- Bloquear se houver usuário ativo vinculado ao cargo
  IF EXISTS (
    SELECT 1
    FROM public.master_system_user u
    WHERE u.id_user_role = p_role_id
      AND u.is_active    = true
      AND u.is_test      = p_is_test
  ) THEN
    RAISE EXCEPTION 'Este cargo possui usuários ativos vinculados e não pode ser inativado.';
  END IF;

  -- Inativar o cargo (sem apagar permissões)
  UPDATE public.master_user_role
  SET    is_active  = false,
         updated_at = now()
  WHERE  id      = p_role_id
    AND  is_test = p_is_test;

END;
$$;

GRANT EXECUTE ON FUNCTION public.inactivate_user_role(integer, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.inactivate_user_role(integer, boolean) TO authenticated;

-- Recarregar schema cache do PostgREST
SELECT pg_notify('pgrst', 'reload schema');
