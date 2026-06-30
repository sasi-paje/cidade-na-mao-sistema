-- =====================================================================
-- M5-B (público autenticado) — confirmar/cancelar presença
-- Projeto: tfupwytzrkpzocfxheeq (TESTE/HOMOLOGAÇÃO) — NÃO aplicar em produção.
-- APLICADA em homologação via MCP apply_migration (2026-06-29).
--
-- Modelo A (escolhido): presença por current_user_id() (sessão SASI), reusa
-- trx_event_attendance (id_user) — SEM mudança de schema, SEM anon write.
-- Valida: autenticado, evento ativo+tenant, slot 'approved', capacidade.
-- Dedup por (id_slot, id_user) (unique existente); reativa presença cancelada.
-- SECURITY DEFINER + search_path fixo; EXECUTE só authenticated.
-- =====================================================================

create or replace function public.confirm_attendance(p_id_event uuid, p_id_slot uuid)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := current_user_id();
  v_tenant uuid := current_tenant_id();
  v_slot_code text; v_capacity integer; v_status_confirmed uuid;
  v_att_id uuid; v_att_code text; v_confirmed_count integer;
  v_name text; v_email text; v_confirmed_at timestamptz;
begin
  if v_uid is null or v_tenant is null then
    raise exception using message = 'Usuário não autenticado.';
  end if;
  if not exists (select 1 from master_event e where e.id = p_id_event and e.id_tenant = v_tenant and e.is_active = true) then
    raise exception using message = 'Evento não encontrado, inativo, ou de outro tenant.';
  end if;
  select ss.code, s.capacity into v_slot_code, v_capacity
  from trx_event_slot s join ref_slot_status ss on ss.id = s.id_slot_status
  where s.id = p_id_slot and s.id_event = p_id_event;
  if v_slot_code is null then
    raise exception using message = 'Slot não encontrado para o evento.';
  end if;
  if v_slot_code is distinct from 'approved' then
    raise exception using message = 'Evento não está aprovado para confirmação de presença.';
  end if;

  select id into v_status_confirmed from ref_attendance_status where code = 'confirmed';
  select name, email into v_name, v_email from master_user where id = v_uid;

  select a.id, ras.code into v_att_id, v_att_code
  from trx_event_attendance a join ref_attendance_status ras on ras.id = a.id_attendance_status
  where a.id_slot = p_id_slot and a.id_user = v_uid;

  if v_att_id is not null and v_att_code = 'confirmed' then
    select confirmed_at into v_confirmed_at from trx_event_attendance where id = v_att_id;
    return jsonb_build_object('id_attendance', v_att_id, 'id_event', p_id_event, 'id_slot', p_id_slot,
      'attendee_name', v_name, 'attendee_email', v_email, 'status', 'confirmed',
      'confirmed_at', v_confirmed_at, 'cancelled_at', null, 'already', true);
  end if;

  select count(*) into v_confirmed_count
  from trx_event_attendance a join ref_attendance_status ras on ras.id = a.id_attendance_status
  where a.id_slot = p_id_slot and ras.code = 'confirmed' and a.id_user <> v_uid;
  if v_capacity is not null and v_confirmed_count >= v_capacity then
    raise exception using message = 'Capacidade do evento esgotada.';
  end if;

  if v_att_id is not null then
    update trx_event_attendance set id_attendance_status = v_status_confirmed, confirmed_at = now()
     where id = v_att_id returning confirmed_at into v_confirmed_at;
  else
    insert into trx_event_attendance (id_event, id_slot, id_user, id_attendance_status)
    values (p_id_event, p_id_slot, v_uid, v_status_confirmed)
    returning id, confirmed_at into v_att_id, v_confirmed_at;
  end if;

  return jsonb_build_object('id_attendance', v_att_id, 'id_event', p_id_event, 'id_slot', p_id_slot,
    'attendee_name', v_name, 'attendee_email', v_email, 'status', 'confirmed',
    'confirmed_at', v_confirmed_at, 'cancelled_at', null, 'already', false);
end;
$$;

create or replace function public.cancel_attendance(p_id_event uuid, p_id_slot uuid)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := current_user_id();
  v_status_cancelled uuid; v_att_id uuid; v_att_code text; v_name text; v_email text;
begin
  if v_uid is null then
    raise exception using message = 'Usuário não autenticado.';
  end if;
  select a.id, ras.code into v_att_id, v_att_code
  from trx_event_attendance a join ref_attendance_status ras on ras.id = a.id_attendance_status
  where a.id_slot = p_id_slot and a.id_event = p_id_event and a.id_user = v_uid;
  if v_att_id is null then
    raise exception using message = 'Presença não encontrada para o usuário neste evento.';
  end if;
  select id into v_status_cancelled from ref_attendance_status where code = 'cancelled';
  select name, email into v_name, v_email from master_user where id = v_uid;

  if v_att_code = 'cancelled' then
    return jsonb_build_object('id_attendance', v_att_id, 'id_event', p_id_event, 'id_slot', p_id_slot,
      'attendee_name', v_name, 'attendee_email', v_email, 'status', 'cancelled', 'already', true);
  end if;

  update trx_event_attendance set id_attendance_status = v_status_cancelled where id = v_att_id;
  return jsonb_build_object('id_attendance', v_att_id, 'id_event', p_id_event, 'id_slot', p_id_slot,
    'attendee_name', v_name, 'attendee_email', v_email, 'status', 'cancelled', 'already', false);
end;
$$;

revoke all on function public.confirm_attendance(uuid, uuid) from public, anon;
revoke all on function public.cancel_attendance(uuid, uuid) from public, anon;
grant execute on function public.confirm_attendance(uuid, uuid) to authenticated;
grant execute on function public.cancel_attendance(uuid, uuid) to authenticated;

-- rollback:
-- drop function if exists public.confirm_attendance(uuid, uuid);
-- drop function if exists public.cancel_attendance(uuid, uuid);
