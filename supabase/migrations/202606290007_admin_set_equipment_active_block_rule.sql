-- =====================================================================
-- Regra de negócio na inativação de equipamento — Projeto tfupwytzrkpzocfxheeq
-- (HOMOLOGAÇÃO). APLICADA via MCP apply_migration (2026-06-29).
--
-- Substitui admin_set_equipment_active adicionando bloqueio de INATIVAÇÃO
-- quando o equipamento está vinculado a evento ativo/futuro/relevante:
--   vínculo relevante = trx_event_equipment_request -> master_event (is_active)
--   -> trx_event_slot cujo ref_slot_status.code ∈ (pending, approved, counter_proposed).
-- rejected/inactive (e eventos inativos) NÃO bloqueiam. Ativação sempre liberada.
-- Admin-only, tenant via contexto. SECURITY DEFINER + search_path fixo;
-- EXECUTE só authenticated.
-- =====================================================================

create or replace function public.admin_set_equipment_active(p_id uuid, p_is_active boolean)
  returns jsonb
  language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := current_user_id();
  v_tenant uuid := current_tenant_id();
  v_role text := current_user_role();
  v_blockers integer;
begin
  if v_uid is null or v_tenant is null then
    raise exception using message = 'Usuário não autenticado.';
  end if;
  if v_role is distinct from 'admin' then
    raise exception using message = 'Apenas admin pode ativar/inativar equipamento.';
  end if;
  if p_is_active is null then
    raise exception using message = 'is_active é obrigatório.';
  end if;
  if not exists (select 1 from master_equipment where id = p_id and id_tenant = v_tenant) then
    raise exception using message = 'Equipamento não encontrado no tenant atual.';
  end if;

  if p_is_active = false then
    select count(distinct e.id) into v_blockers
    from trx_event_equipment_request r
    join master_event e on e.id = r.id_event
    join trx_event_slot s on s.id_event = e.id
    join ref_slot_status ss on ss.id = s.id_slot_status
    where r.id_equipment = p_id
      and e.id_tenant = v_tenant
      and e.is_active = true
      and ss.code in ('pending', 'approved', 'counter_proposed');

    if v_blockers > 0 then
      raise exception using message = format(
        'Este equipamento não pode ser inativado porque está vinculado a %s evento(s) ativo(s) ou futuro(s). Remova o vínculo ou conclua/cancele esses eventos antes de inativar.',
        v_blockers);
    end if;
  end if;

  update master_equipment set is_active = p_is_active, updated_by = v_uid where id = p_id;

  return (
    select jsonb_build_object('id', e.id, 'id_tenant', e.id_tenant, 'name', e.name,
      'description', e.description, 'quantity', e.quantity, 'is_active', e.is_active, 'created_at', e.created_at)
    from master_equipment e where e.id = p_id
  );
end;
$$;

revoke all on function public.admin_set_equipment_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_equipment_active(uuid, boolean) to authenticated;
