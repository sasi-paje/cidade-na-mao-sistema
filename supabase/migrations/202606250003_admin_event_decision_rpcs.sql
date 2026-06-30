-- =====================================================================
-- M5 (bloco admin) — RPCs transacionais de decisão do admin
-- Projeto: tfupwytzrkpzocfxheeq (TESTE/HOMOLOGAÇÃO)
-- Aplicada via MCP em 2026-06-25 (migrations `admin_event_decision_rpcs`
-- + `admin_event_decision_rpcs_revoke_public`).
--
-- RPCs: approve_event, reject_event, propose_counter_date.
-- Todas SECURITY DEFINER + search_path fixo; validam role admin + tenant via
-- current_user_role()/current_tenant_id()/current_user_id() (NÃO confiam em
-- params de tenant/user vindos do frontend).
--
-- NÃO inclui: create_event_request, accept/reject_counter_date,
-- confirm/cancel_attendance (próximos blocos). NÃO abre RLS. NÃO toca views.
-- Rollback no rodapé.
-- =====================================================================

-- 1) approve_event
create or replace function public.approve_event(p_id_event uuid, p_id_slot uuid)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := current_user_id();
  v_tenant uuid := current_tenant_id();
  v_role text := current_user_role();
  v_slot_code text; v_requested timestamptz; v_decision uuid; v_status uuid; v_approved_at timestamptz;
begin
  if v_uid is null then raise exception 'não autenticado'; end if;
  if v_role <> 'admin' then raise exception 'apenas admin pode aprovar'; end if;
  if not exists (select 1 from master_event e where e.id = p_id_event and e.id_tenant = v_tenant) then
    raise exception 'evento não encontrado no tenant atual';
  end if;
  select ss.code, s.requested_at into v_slot_code, v_requested
  from trx_event_slot s join ref_slot_status ss on ss.id = s.id_slot_status
  where s.id = p_id_slot and s.id_event = p_id_event;
  if v_slot_code is null then raise exception 'slot não encontrado para o evento'; end if;
  if v_slot_code not in ('pending', 'counter_proposed') then
    raise exception 'slot não pode ser aprovado (status atual: %)', v_slot_code;
  end if;
  select id into v_decision from ref_approval_decision where code = 'approved';
  select id into v_status   from ref_slot_status      where code = 'approved';
  insert into trx_event_approval (id_event, id_slot, id_reviewed_by, id_decision, reason, counter_date)
  values (p_id_event, p_id_slot, v_uid, v_decision, null, null);
  update trx_event_slot set id_slot_status = v_status, approved_at = coalesce(approved_at, requested_at)
   where id = p_id_slot returning approved_at into v_approved_at;
  insert into trx_equipment_availability (id_equipment, id_event, id_slot, quantity_used, allocated_at)
  select r.id_equipment, p_id_event, p_id_slot, r.quantity, v_requested
  from trx_event_equipment_request r
  where r.id_event = p_id_event
    and not exists (select 1 from trx_equipment_availability a
                    where a.id_slot = p_id_slot and a.id_equipment = r.id_equipment and a.released_at is null);
  return jsonb_build_object('id_event', p_id_event, 'id_slot', p_id_slot,
                            'slot_status', 'approved', 'approved_at', v_approved_at);
end;
$$;

-- 2) reject_event
create or replace function public.reject_event(p_id_event uuid, p_id_slot uuid, p_reason text)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := current_user_id(); v_tenant uuid := current_tenant_id(); v_role text := current_user_role();
  v_decision uuid; v_status uuid;
begin
  if v_uid is null then raise exception 'não autenticado'; end if;
  if v_role <> 'admin' then raise exception 'apenas admin pode reprovar'; end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'motivo (reason) é obrigatório'; end if;
  if not exists (select 1 from master_event e where e.id = p_id_event and e.id_tenant = v_tenant) then
    raise exception 'evento não encontrado no tenant atual';
  end if;
  if not exists (select 1 from trx_event_slot s where s.id = p_id_slot and s.id_event = p_id_event) then
    raise exception 'slot não encontrado para o evento';
  end if;
  select id into v_decision from ref_approval_decision where code = 'rejected';
  select id into v_status   from ref_slot_status      where code = 'rejected';
  insert into trx_event_approval (id_event, id_slot, id_reviewed_by, id_decision, reason, counter_date)
  values (p_id_event, p_id_slot, v_uid, v_decision, p_reason, null);
  update trx_event_slot set id_slot_status = v_status where id = p_id_slot;
  return jsonb_build_object('id_event', p_id_event, 'id_slot', p_id_slot, 'slot_status', 'rejected');
end;
$$;

-- 3) propose_counter_date
create or replace function public.propose_counter_date(
  p_id_event uuid, p_id_slot uuid, p_counter_date timestamptz, p_reason text)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := current_user_id(); v_tenant uuid := current_tenant_id(); v_role text := current_user_role();
  v_decision uuid; v_status uuid;
begin
  if v_uid is null then raise exception 'não autenticado'; end if;
  if v_role <> 'admin' then raise exception 'apenas admin pode propor nova data'; end if;
  if p_counter_date is null then raise exception 'nova data (counter_date) é obrigatória'; end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'motivo (reason) é obrigatório'; end if;
  if not exists (select 1 from master_event e where e.id = p_id_event and e.id_tenant = v_tenant) then
    raise exception 'evento não encontrado no tenant atual';
  end if;
  if not exists (select 1 from trx_event_slot s where s.id = p_id_slot and s.id_event = p_id_event) then
    raise exception 'slot não encontrado para o evento';
  end if;
  select id into v_decision from ref_approval_decision where code = 'counter_proposed';
  select id into v_status   from ref_slot_status      where code = 'counter_proposed';
  insert into trx_event_approval (id_event, id_slot, id_reviewed_by, id_decision, reason, counter_date)
  values (p_id_event, p_id_slot, v_uid, v_decision, p_reason, p_counter_date);
  update trx_event_slot set id_slot_status = v_status, approved_at = p_counter_date where id = p_id_slot;
  return jsonb_build_object('id_event', p_id_event, 'id_slot', p_id_slot,
                            'slot_status', 'counter_proposed', 'counter_date', p_counter_date);
end;
$$;

-- Grants: apenas authenticated (remove EXECUTE default de PUBLIC/anon)
revoke execute on function public.approve_event(uuid, uuid) from public, anon;
revoke execute on function public.reject_event(uuid, uuid, text) from public, anon;
revoke execute on function public.propose_counter_date(uuid, uuid, timestamptz, text) from public, anon;
grant execute on function public.approve_event(uuid, uuid) to authenticated;
grant execute on function public.reject_event(uuid, uuid, text) to authenticated;
grant execute on function public.propose_counter_date(uuid, uuid, timestamptz, text) to authenticated;

-- =====================================================================
-- ROLLBACK (executar manualmente se necessário)
-- =====================================================================
-- drop function if exists public.approve_event(uuid, uuid);
-- drop function if exists public.reject_event(uuid, uuid, text);
-- drop function if exists public.propose_counter_date(uuid, uuid, timestamptz, text);
