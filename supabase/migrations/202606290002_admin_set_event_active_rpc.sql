-- =====================================================================
-- admin_set_event_active — ativar/inativar evento pelo admin (web)
-- Projeto: tfupwytzrkpzocfxheeq (TESTE/HOMOLOGAÇÃO) — NÃO aplicar em produção.
-- APLICADA em homologação via MCP apply_migration (2026-06-29).
--
-- Soft-toggle de master_event.is_active. Admin-only, tenant via contexto.
-- Padrão: SECURITY DEFINER + search_path fixo; EXECUTE só authenticated.
-- =====================================================================

create or replace function public.admin_set_event_active(p_id_event uuid, p_is_active boolean)
  returns jsonb
  language plpgsql security definer set search_path = public
as $$
declare
  v_uid    uuid := current_user_id();
  v_tenant uuid := current_tenant_id();
  v_role   text := current_user_role();
begin
  if v_uid is null or v_tenant is null then
    raise exception using message = 'Usuário não autenticado.';
  end if;
  if v_role is distinct from 'admin' then
    raise exception using message = 'Apenas admin pode ativar/inativar evento.';
  end if;
  if p_is_active is null then
    raise exception using message = 'is_active é obrigatório.';
  end if;
  if not exists (select 1 from master_event e where e.id = p_id_event and e.id_tenant = v_tenant) then
    raise exception using message = 'Evento não encontrado no tenant atual.';
  end if;

  update master_event set is_active = p_is_active, updated_by = v_uid where id = p_id_event;

  return jsonb_build_object('id_event', p_id_event, 'is_active', p_is_active);
end;
$$;

revoke all on function public.admin_set_event_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_event_active(uuid, boolean) to authenticated;

-- rollback:
-- drop function if exists public.admin_set_event_active(uuid, boolean);
