-- ============================================================
-- Fase 2 — Controle de ações por Cargo nas páginas do Usuário
--
-- 1. sync_users_actions_by_role: recalcula can_* para todos
--    os usuários ativos de um cargo, preservando páginas.
-- 2. save_user_page_access_from_role: salva páginas + ações
--    derivadas do cargo para um usuário específico.
-- 3. Atualiza save_user_role_with_permissions para chamar
--    sync_users_actions_by_role após alterar permissões.
--
-- Mapeamento de código de permissão → can_* campos:
--   VIEW       → can_view
--   CREATE     → can_create + can_view
--   UPDATE     → can_update + can_edit + can_view
--   ACTIVATE   → can_activate + can_view
--   INACTIVATE → can_inactivate + can_view
-- ============================================================

-- ── 1. sync_users_actions_by_role ───────────────────────────
-- Recalcula apenas as colunas can_* em rel_user_role_page para
-- todos os usuários ativos que pertencem ao cargo informado.
-- Não adiciona nem remove páginas — só atualiza ações.

CREATE OR REPLACE FUNCTION public.sync_users_actions_by_role(
  p_role_id integer,
  p_is_test boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_view       boolean;
  v_can_create     boolean;
  v_can_edit       boolean;
  v_can_update     boolean;
  v_can_activate   boolean;
  v_can_inactivate boolean;
BEGIN
  -- Calcular can_* das permissões atuais do Cargo
  SELECT
    bool_or(p.code IN ('VIEW', 'CREATE', 'UPDATE', 'ACTIVATE', 'INACTIVATE')),
    bool_or(p.code = 'CREATE'),
    bool_or(p.code = 'UPDATE'),
    bool_or(p.code = 'UPDATE'),
    bool_or(p.code = 'ACTIVATE'),
    bool_or(p.code = 'INACTIVATE')
  INTO v_can_view, v_can_create, v_can_edit, v_can_update, v_can_activate, v_can_inactivate
  FROM   public.master_user_role_permission rup
  JOIN   public.master_system_permission p
    ON   p.id        = rup.permission_id
    AND  p.is_active = true
    AND  p.is_test   = false
  WHERE  rup.role_id = p_role_id;

  v_can_view       := COALESCE(v_can_view,       false);
  v_can_create     := COALESCE(v_can_create,     false);
  v_can_edit       := COALESCE(v_can_edit,       false);
  v_can_update     := COALESCE(v_can_update,     false);
  v_can_activate   := COALESCE(v_can_activate,   false);
  v_can_inactivate := COALESCE(v_can_inactivate, false);

  -- Atualizar apenas ações; páginas do usuário são preservadas
  UPDATE public.rel_user_role_page rup_page
  SET    can_view       = v_can_view,
         can_create     = v_can_create,
         can_edit       = v_can_edit,
         can_update     = v_can_update,
         can_activate   = v_can_activate,
         can_inactivate = v_can_inactivate
  WHERE  rup_page.id_user IN (
           SELECT u.id
           FROM   public.master_system_user u
           WHERE  u.id_user_role = p_role_id
             AND  u.is_active    = true
             AND  u.is_test      = p_is_test
         )
    AND  rup_page.is_active = true
    AND  rup_page.is_test   = p_is_test;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_users_actions_by_role(integer, boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.sync_users_actions_by_role(integer, boolean) TO authenticated;

-- ── 2. save_user_page_access_from_role ──────────────────────
-- Substitui todas as entradas de rel_user_role_page do usuário
-- no ambiente informado e insere as páginas selecionadas com
-- can_* derivados das permissões do cargo.

CREATE OR REPLACE FUNCTION public.save_user_page_access_from_role(
  p_user_id  text,
  p_role_id  integer,
  p_page_ids integer[],
  p_is_test  boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_view       boolean;
  v_can_create     boolean;
  v_can_edit       boolean;
  v_can_update     boolean;
  v_can_activate   boolean;
  v_can_inactivate boolean;
  v_invalid_pages  integer;
BEGIN
  -- Validar usuário no mesmo ambiente
  IF NOT EXISTS (
    SELECT 1 FROM public.master_system_user
    WHERE  id      = p_user_id
      AND  is_test = p_is_test
  ) THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  -- Validar cargo (existe, ativo, mesmo ambiente)
  IF NOT EXISTS (
    SELECT 1 FROM public.master_user_role
    WHERE  id        = p_role_id
      AND  is_test   = p_is_test
      AND  is_active = true
  ) THEN
    RAISE EXCEPTION 'Cargo não encontrado ou inativo.';
  END IF;

  -- Validar páginas somente quando o array não está vazio
  IF cardinality(COALESCE(p_page_ids, ARRAY[]::integer[])) > 0 THEN
    SELECT COUNT(*) INTO v_invalid_pages
    FROM   unnest(p_page_ids) AS pid
    WHERE  pid NOT IN (
      SELECT id FROM public.master_system_page
      WHERE  is_active = true
        AND  is_test   = p_is_test
    );

    IF v_invalid_pages > 0 THEN
      RAISE EXCEPTION 'Uma ou mais páginas inválidas ou inativas foram enviadas.';
    END IF;
  END IF;

  -- Calcular can_* das permissões do Cargo
  SELECT
    bool_or(p.code IN ('VIEW', 'CREATE', 'UPDATE', 'ACTIVATE', 'INACTIVATE')),
    bool_or(p.code = 'CREATE'),
    bool_or(p.code = 'UPDATE'),
    bool_or(p.code = 'UPDATE'),
    bool_or(p.code = 'ACTIVATE'),
    bool_or(p.code = 'INACTIVATE')
  INTO v_can_view, v_can_create, v_can_edit, v_can_update, v_can_activate, v_can_inactivate
  FROM   public.master_user_role_permission rup
  JOIN   public.master_system_permission p
    ON   p.id        = rup.permission_id
    AND  p.is_active = true
    AND  p.is_test   = false
  WHERE  rup.role_id = p_role_id;

  v_can_view       := COALESCE(v_can_view,       false);
  v_can_create     := COALESCE(v_can_create,     false);
  v_can_edit       := COALESCE(v_can_edit,       false);
  v_can_update     := COALESCE(v_can_update,     false);
  v_can_activate   := COALESCE(v_can_activate,   false);
  v_can_inactivate := COALESCE(v_can_inactivate, false);

  -- Substituir acesso anterior do usuário neste ambiente
  DELETE FROM public.rel_user_role_page
  WHERE  id_user = p_user_id
    AND  is_test = p_is_test;

  -- Inserir páginas com ações calculadas (nada a inserir se array vazio)
  IF cardinality(COALESCE(p_page_ids, ARRAY[]::integer[])) > 0 THEN
    INSERT INTO public.rel_user_role_page (
      id_user, id_system_page,
      can_view, can_create, can_edit, can_update, can_activate, can_inactivate,
      is_active, is_test
    )
    SELECT
      p_user_id,
      pid,
      v_can_view, v_can_create, v_can_edit, v_can_update, v_can_activate, v_can_inactivate,
      true,
      p_is_test
    FROM unnest(p_page_ids) AS pid;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_user_page_access_from_role(text, integer, integer[], boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.save_user_page_access_from_role(text, integer, integer[], boolean) TO authenticated;

-- ── 3. Atualizar save_user_role_with_permissions ─────────────
-- Adiciona chamada a sync_users_actions_by_role após salvar as
-- permissões do cargo, propagando as ações para todos os
-- usuários ativos vinculados a esse cargo.

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
  v_trimmed_name := trim(p_name);

  IF v_trimmed_name = '' OR v_trimmed_name IS NULL THEN
    RAISE EXCEPTION 'Informe o nome do cargo.';
  END IF;

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

  SELECT id INTO v_view_id
  FROM   public.master_system_permission
  WHERE  code      = 'VIEW'
    AND  is_active = true
    AND  is_test   = false
  LIMIT 1;

  IF v_view_id IS NULL THEN
    RAISE EXCEPTION 'Permissão padrão Visualizar não encontrada.';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT unnest(COALESCE(p_permission_ids, ARRAY[]::integer[]) || ARRAY[v_view_id])
  ) INTO v_final_ids;

  SELECT COUNT(*) INTO v_invalid_cnt
  FROM   unnest(v_final_ids) AS pid
  WHERE  pid NOT IN (
    SELECT id FROM public.master_system_permission
    WHERE  is_active = true AND is_test = false
  );

  IF v_invalid_cnt > 0 THEN
    RAISE EXCEPTION 'Uma ou mais permissões inválidas ou inativas foram enviadas.';
  END IF;

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

  DELETE FROM public.master_user_role_permission WHERE role_id = v_cargo_id;

  INSERT INTO public.master_user_role_permission (role_id, permission_id)
  SELECT v_cargo_id, pid FROM unnest(v_final_ids) AS pid;

  -- Propagar ações para todos os usuários ativos deste Cargo
  PERFORM public.sync_users_actions_by_role(v_cargo_id::integer, p_is_test);

  RETURN QUERY
    SELECT r.id, r.name, r.code, r.is_active, r.is_test
    FROM   public.master_user_role r
    WHERE  r.id = v_cargo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_user_role_with_permissions(integer, text, text, boolean, integer[]) TO anon;
GRANT EXECUTE ON FUNCTION public.save_user_role_with_permissions(integer, text, text, boolean, integer[]) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
