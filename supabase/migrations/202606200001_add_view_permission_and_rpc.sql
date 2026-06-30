-- ============================================================
-- Fase 1: Permissão VIEW + RPC transacional para cargo × permissão
-- Aplicar via: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Garantir colunas necessárias em master_system_permission
-- (seguro rodar múltiplas vezes — ADD COLUMN IF NOT EXISTS é idempotente)
ALTER TABLE public.master_system_permission
  ADD COLUMN IF NOT EXISTS code      TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_test   BOOLEAN DEFAULT false;

-- 2. Criar permissão VIEW/Visualizar se ainda não existir
INSERT INTO public.master_system_permission (name, code, is_active, is_test)
SELECT 'Visualizar', 'VIEW', true, false
WHERE NOT EXISTS (
  SELECT 1
  FROM   public.master_system_permission
  WHERE  code = 'VIEW'
     OR  lower(name) = 'visualizar'
);

-- 3. RPC transacional para salvar permissões de um cargo
--    Parâmetros:
--      p_role_id       — ID do cargo (integer)
--      p_permission_ids — IDs das permissões selecionadas (pode ser array vazio)
--    Comportamento:
--      • Valida que o cargo existe
--      • Busca VIEW pelo code (sem ID fixo)
--      • Sempre inclui VIEW no conjunto final
--      • Deleta permissões antigas e insere novas em uma única transação
--      • Rejeita permissões inativas ou de teste
CREATE OR REPLACE FUNCTION public.save_user_role_permissions(
  p_role_id        integer,
  p_permission_ids integer[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_view_id       integer;
  v_final_ids     integer[];
  v_invalid_count integer;
BEGIN
  -- Validar que o cargo existe
  IF NOT EXISTS (
    SELECT 1 FROM public.master_user_role WHERE id = p_role_id
  ) THEN
    RAISE EXCEPTION 'Cargo % não encontrado.', p_role_id;
  END IF;

  -- Buscar ID da permissão VIEW (sem hardcode de ID)
  SELECT id INTO v_view_id
  FROM   public.master_system_permission
  WHERE  code = 'VIEW'
    AND  is_active = true
    AND  is_test   = false
  LIMIT 1;

  IF v_view_id IS NULL THEN
    RAISE EXCEPTION 'Permissão padrão Visualizar não encontrada.';
  END IF;

  -- Construir array final: VIEW + selecionadas, sem duplicatas
  SELECT ARRAY(
    SELECT DISTINCT unnest(p_permission_ids || ARRAY[v_view_id])
  ) INTO v_final_ids;

  -- Validar que todas as permissões existem, estão ativas e não são de teste
  SELECT COUNT(*) INTO v_invalid_count
  FROM   unnest(v_final_ids) AS pid
  WHERE  pid NOT IN (
    SELECT id
    FROM   public.master_system_permission
    WHERE  is_active = true
      AND  is_test   = false
  );

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'Uma ou mais permissões inválidas ou inativas foram enviadas.';
  END IF;

  -- Deletar permissões antigas do cargo
  DELETE FROM public.master_user_role_permission
  WHERE  role_id = p_role_id;

  -- Inserir novas permissões
  INSERT INTO public.master_user_role_permission (role_id, permission_id)
  SELECT p_role_id, pid
  FROM   unnest(v_final_ids) AS pid;

END;
$$;

-- 4. Conceder execução às roles usadas pelo frontend (anon key)
GRANT EXECUTE ON FUNCTION public.save_user_role_permissions(integer, integer[]) TO anon;
GRANT EXECUTE ON FUNCTION public.save_user_role_permissions(integer, integer[]) TO authenticated;
