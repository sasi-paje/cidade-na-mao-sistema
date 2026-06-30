-- =====================================================================
-- M5-B — RPCs transacionais do LÍDER e do PÚBLICO (evento/presença)
-- Projeto: tfupwytzrkpzocfxheeq (TESTE/HOMOLOGAÇÃO)
-- Proposta: ver docs/RELATORIO-PRONTIDAO-PRODUCAO.md (bloqueadores M5-B) e
--           docs/MIGRACAO-SUPABASE-AUTH-RLS.md (esqueletos seção 7).
--
-- RASCUNHO PARA REVISÃO — NÃO APLICADO NO BANCO.
--
-- RPCs criadas:
--   1) create_event_request   — líder cria evento + slot pending + equipamentos
--   2) accept_counter_date     — líder aceita contraproposta do admin
--   3) reject_counter_date     — líder recusa contraproposta do admin
--   4) confirm_attendance      — qualquer autenticado confirma presença
--   5) cancel_attendance       — qualquer autenticado cancela a própria presença
--
-- Padrão (igual à M5-admin, 202606250003):
--   * SECURITY DEFINER + set search_path = public
--   * autenticação via current_user_id(); tenant via current_tenant_id();
--     role via current_user_role(). NUNCA confiam em tenant/user vindos do front.
--   * status/decisões resolvidos por CODE (nunca id fixo).
--   * EXECUTE somente para authenticated (revogado de PUBLIC/anon).
--
-- NÃO altera tabelas-base, RLS, views, nem remove mocks/frontend.
-- Rollback no rodapé.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) create_event_request — solicitação de evento pelo líder
--    p_equipment_requests: jsonb array [{ "id_equipment": "uuid", "quantity": 2 }]
-- ---------------------------------------------------------------------
create or replace function public.create_event_request(
  p_title              text,
  p_description        text,
  p_banner_url         text,
  p_location           text,
  p_requested_at       timestamptz,
  p_capacity           integer,
  p_equipment_requests jsonb default '[]'::jsonb
) returns jsonb
  language plpgsql security definer set search_path = public
as $$
declare
  v_uid            uuid := current_user_id();
  v_tenant         uuid := current_tenant_id();
  v_role           text := current_user_role();
  v_status_pending uuid;
  v_event_id       uuid;
  v_slot_id        uuid;
  v_item           jsonb;
  v_eq_id          uuid;
  v_qty            integer;
  v_equip          jsonb := '[]'::jsonb;
begin
  if v_uid is null or v_tenant is null then
    raise exception using message = 'Usuário não autenticado.';
  end if;
  if v_role is distinct from 'community_leader' then
    raise exception using message = 'Apenas líder comunitário pode solicitar evento.';
  end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception using message = 'Título é obrigatório.';
  end if;
  if p_location is null or btrim(p_location) = '' then
    raise exception using message = 'Local é obrigatório.';
  end if;
  if p_requested_at is null then
    raise exception using message = 'Data solicitada (requested_at) é obrigatória.';
  end if;
  if p_capacity is null or p_capacity <= 0 then
    raise exception using message = 'Capacidade deve ser maior que zero.';
  end if;

  select id into v_status_pending from ref_slot_status where code = 'pending';
  if v_status_pending is null then
    raise exception using message = 'Status de slot "pending" não encontrado no catálogo.';
  end if;

  -- master_event: tenant/user SEMPRE do contexto, nunca do front
  insert into master_event (
    id_tenant, id_user, title, description, banner_url, location, is_active, created_by, updated_by
  ) values (
    v_tenant, v_uid, btrim(p_title), p_description, p_banner_url, btrim(p_location), true, v_uid, v_uid
  ) returning id into v_event_id;

  -- slot inicial em pending
  insert into trx_event_slot (id_event, id_slot_status, requested_at, capacity)
  values (v_event_id, v_status_pending, p_requested_at, p_capacity)
  returning id into v_slot_id;

  -- equipamentos solicitados (opcional)
  if p_equipment_requests is not null and jsonb_typeof(p_equipment_requests) = 'array' then
    for v_item in select * from jsonb_array_elements(p_equipment_requests)
    loop
      v_eq_id := nullif(v_item->>'id_equipment', '')::uuid;
      v_qty   := coalesce((v_item->>'quantity')::integer, 0);

      if v_eq_id is null then
        raise exception using message = 'id_equipment inválido em equipment_requests.';
      end if;
      if v_qty <= 0 then
        raise exception using message = 'Quantidade de equipamento deve ser maior que zero.';
      end if;
      -- equipamento precisa ser do mesmo tenant
      if not exists (
        select 1 from master_equipment eq
        where eq.id = v_eq_id and eq.id_tenant = v_tenant
      ) then
        raise exception using message = 'Equipamento não pertence ao tenant atual ou não existe.';
      end if;

      insert into trx_event_equipment_request (id_event, id_equipment, quantity)
      values (v_event_id, v_eq_id, v_qty);

      v_equip := v_equip || jsonb_build_object('id_equipment', v_eq_id, 'quantity', v_qty);
    end loop;
  end if;

  return jsonb_build_object(
    'id_event',           v_event_id,
    'id_slot',            v_slot_id,
    'status',             'pending',
    'equipment_requests', v_equip
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 2) accept_counter_date — líder aceita a contraproposta do admin
--    counter_proposed -> approved (approved_at já contém a data sugerida).
-- ---------------------------------------------------------------------
create or replace function public.accept_counter_date(
  p_id_event uuid,
  p_id_slot  uuid
) returns jsonb
  language plpgsql security definer set search_path = public
as $$
declare
  v_uid             uuid := current_user_id();
  v_tenant          uuid := current_tenant_id();
  v_role            text := current_user_role();
  v_slot_code       text;
  v_status_approved uuid;
  v_decision        uuid;
  v_approved_at     timestamptz;
begin
  if v_uid is null or v_tenant is null then
    raise exception using message = 'Usuário não autenticado.';
  end if;
  if v_role is distinct from 'community_leader' then
    raise exception using message = 'Apenas líder comunitário pode aceitar contraproposta.';
  end if;
  -- evento do tenant atual E criado pelo próprio líder
  if not exists (
    select 1 from master_event e
    where e.id = p_id_event and e.id_tenant = v_tenant and e.id_user = v_uid
  ) then
    raise exception using message = 'Evento não encontrado, de outro tenant, ou não pertence ao usuário.';
  end if;

  select ss.code into v_slot_code
  from trx_event_slot s
  join ref_slot_status ss on ss.id = s.id_slot_status
  where s.id = p_id_slot and s.id_event = p_id_event;
  if v_slot_code is null then
    raise exception using message = 'Slot não encontrado para o evento.';
  end if;
  if v_slot_code is distinct from 'counter_proposed' then
    raise exception using message = 'Slot não está em contraproposta (status atual: ' || v_slot_code || ').';
  end if;

  select id into v_status_approved from ref_slot_status where code = 'approved';
  update trx_event_slot
     set id_slot_status = v_status_approved,
         approved_at    = coalesce(approved_at, requested_at)  -- data sugerida vira a data final
   where id = p_id_slot
   returning approved_at into v_approved_at;

  -- auditoria: registra o aceite do líder no log de aprovação
  select id into v_decision from ref_approval_decision where code = 'approved';
  insert into trx_event_approval (id_event, id_slot, id_reviewed_by, id_decision, reason, counter_date)
  values (p_id_event, p_id_slot, v_uid, v_decision, null, null);

  return jsonb_build_object(
    'id_event',    p_id_event,
    'id_slot',     p_id_slot,
    'slot_status', 'approved',
    'approved_at', v_approved_at
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 3) reject_counter_date — líder recusa a contraproposta do admin
--    counter_proposed -> inactive (ref_slot_status: "Líder não aceitou a
--    contraproposta"). Motivo obrigatório (auditado em trx_event_approval).
-- ---------------------------------------------------------------------
create or replace function public.reject_counter_date(
  p_id_event uuid,
  p_id_slot  uuid,
  p_reason   text
) returns jsonb
  language plpgsql security definer set search_path = public
as $$
declare
  v_uid             uuid := current_user_id();
  v_tenant          uuid := current_tenant_id();
  v_role            text := current_user_role();
  v_slot_code       text;
  v_status_inactive uuid;
  v_decision        uuid;
begin
  if v_uid is null or v_tenant is null then
    raise exception using message = 'Usuário não autenticado.';
  end if;
  if v_role is distinct from 'community_leader' then
    raise exception using message = 'Apenas líder comunitário pode recusar contraproposta.';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception using message = 'Motivo (reason) é obrigatório.';
  end if;
  if not exists (
    select 1 from master_event e
    where e.id = p_id_event and e.id_tenant = v_tenant and e.id_user = v_uid
  ) then
    raise exception using message = 'Evento não encontrado, de outro tenant, ou não pertence ao usuário.';
  end if;

  select ss.code into v_slot_code
  from trx_event_slot s
  join ref_slot_status ss on ss.id = s.id_slot_status
  where s.id = p_id_slot and s.id_event = p_id_event;
  if v_slot_code is null then
    raise exception using message = 'Slot não encontrado para o evento.';
  end if;
  if v_slot_code is distinct from 'counter_proposed' then
    raise exception using message = 'Slot não está em contraproposta (status atual: ' || v_slot_code || ').';
  end if;

  select id into v_status_inactive from ref_slot_status where code = 'inactive';
  update trx_event_slot set id_slot_status = v_status_inactive where id = p_id_slot;

  -- auditoria: motivo da recusa do líder (trigger exige reason p/ 'rejected')
  select id into v_decision from ref_approval_decision where code = 'rejected';
  insert into trx_event_approval (id_event, id_slot, id_reviewed_by, id_decision, reason, counter_date)
  values (p_id_event, p_id_slot, v_uid, v_decision, p_reason, null);

  return jsonb_build_object(
    'id_event',    p_id_event,
    'id_slot',     p_id_slot,
    'slot_status', 'inactive'
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 4) confirm_attendance — qualquer usuário autenticado confirma presença
--    Idempotente; respeita unique(id_slot,id_user); valida capacidade.
-- ---------------------------------------------------------------------
create or replace function public.confirm_attendance(
  p_id_event uuid,
  p_id_slot  uuid
) returns jsonb
  language plpgsql security definer set search_path = public
as $$
declare
  v_uid              uuid := current_user_id();
  v_tenant           uuid := current_tenant_id();
  v_slot_code        text;
  v_capacity         integer;
  v_status_confirmed uuid;
  v_att_id           uuid;
  v_att_code         text;
  v_confirmed_count  integer;
begin
  if v_uid is null or v_tenant is null then
    raise exception using message = 'Usuário não autenticado.';
  end if;
  -- qualquer role autenticada pode confirmar (público/líder/admin)

  -- evento ativo + mesmo tenant (espelha RLS attendance_insert)
  if not exists (
    select 1 from master_event e
    where e.id = p_id_event and e.id_tenant = v_tenant and e.is_active = true
  ) then
    raise exception using message = 'Evento não encontrado, inativo, ou de outro tenant.';
  end if;

  select ss.code, s.capacity into v_slot_code, v_capacity
  from trx_event_slot s
  join ref_slot_status ss on ss.id = s.id_slot_status
  where s.id = p_id_slot and s.id_event = p_id_event;
  if v_slot_code is null then
    raise exception using message = 'Slot não encontrado para o evento.';
  end if;
  if v_slot_code is distinct from 'approved' then
    raise exception using message = 'Evento não está aprovado para confirmação de presença.';
  end if;

  select id into v_status_confirmed from ref_attendance_status where code = 'confirmed';

  -- presença existente do usuário neste slot
  select a.id, ras.code into v_att_id, v_att_code
  from trx_event_attendance a
  join ref_attendance_status ras on ras.id = a.id_attendance_status
  where a.id_slot = p_id_slot and a.id_user = v_uid;

  -- já confirmada => idempotente
  if v_att_id is not null and v_att_code = 'confirmed' then
    return jsonb_build_object(
      'id_attendance', v_att_id, 'id_event', p_id_event, 'id_slot', p_id_slot,
      'status', 'confirmed', 'already', true
    );
  end if;

  -- capacidade (conta confirmados de OUTROS usuários)
  select count(*) into v_confirmed_count
  from trx_event_attendance a
  join ref_attendance_status ras on ras.id = a.id_attendance_status
  where a.id_slot = p_id_slot and ras.code = 'confirmed' and a.id_user <> v_uid;
  if v_capacity is not null and v_confirmed_count >= v_capacity then
    raise exception using message = 'Capacidade do evento esgotada.';
  end if;

  if v_att_id is not null then
    -- reativa presença previamente cancelada
    update trx_event_attendance
       set id_attendance_status = v_status_confirmed, confirmed_at = now()
     where id = v_att_id;
  else
    insert into trx_event_attendance (id_event, id_slot, id_user, id_attendance_status)
    values (p_id_event, p_id_slot, v_uid, v_status_confirmed)
    returning id into v_att_id;
  end if;

  return jsonb_build_object(
    'id_attendance', v_att_id, 'id_event', p_id_event, 'id_slot', p_id_slot,
    'status', 'confirmed', 'already', false
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 5) cancel_attendance — usuário cancela a própria presença
-- ---------------------------------------------------------------------
create or replace function public.cancel_attendance(
  p_id_event uuid,
  p_id_slot  uuid
) returns jsonb
  language plpgsql security definer set search_path = public
as $$
declare
  v_uid              uuid := current_user_id();
  v_status_cancelled uuid;
  v_att_id           uuid;
  v_att_code         text;
begin
  if v_uid is null then
    raise exception using message = 'Usuário não autenticado.';
  end if;

  select a.id, ras.code into v_att_id, v_att_code
  from trx_event_attendance a
  join ref_attendance_status ras on ras.id = a.id_attendance_status
  where a.id_slot = p_id_slot and a.id_event = p_id_event and a.id_user = v_uid;

  if v_att_id is null then
    raise exception using message = 'Presença não encontrada para o usuário neste evento.';
  end if;

  select id into v_status_cancelled from ref_attendance_status where code = 'cancelled';

  -- já cancelada => idempotente
  if v_att_code = 'cancelled' then
    return jsonb_build_object(
      'id_attendance', v_att_id, 'id_event', p_id_event, 'id_slot', p_id_slot,
      'status', 'cancelled', 'already', true
    );
  end if;

  update trx_event_attendance set id_attendance_status = v_status_cancelled where id = v_att_id;

  return jsonb_build_object(
    'id_attendance', v_att_id, 'id_event', p_id_event, 'id_slot', p_id_slot,
    'status', 'cancelled', 'already', false
  );
end;
$$;

-- ---------------------------------------------------------------------
-- GRANTS — EXECUTE só para authenticated (revogado de PUBLIC/anon)
-- ---------------------------------------------------------------------
revoke all on function public.create_event_request(text, text, text, text, timestamptz, integer, jsonb) from public, anon;
revoke all on function public.accept_counter_date(uuid, uuid)                                            from public, anon;
revoke all on function public.reject_counter_date(uuid, uuid, text)                                      from public, anon;
revoke all on function public.confirm_attendance(uuid, uuid)                                             from public, anon;
revoke all on function public.cancel_attendance(uuid, uuid)                                              from public, anon;

grant execute on function public.create_event_request(text, text, text, text, timestamptz, integer, jsonb) to authenticated;
grant execute on function public.accept_counter_date(uuid, uuid)                                            to authenticated;
grant execute on function public.reject_counter_date(uuid, uuid, text)                                      to authenticated;
grant execute on function public.confirm_attendance(uuid, uuid)                                             to authenticated;
grant execute on function public.cancel_attendance(uuid, uuid)                                              to authenticated;

commit;

-- =====================================================================
-- VERIFICAÇÃO (rodar APÓS aplicar; não faz parte da migration)
-- =====================================================================
-- anon          -> toda RPC deve dar "permission denied for function ..."
-- community_leader -> create_event_request retorna {id_event,id_slot,status:pending,...};
--                     accept/reject_counter_date operam só no slot counter_proposed do próprio evento.
-- usuário comum -> confirm/cancel_attendance operam só a própria presença.
-- admin         -> create_event_request deve falhar ("apenas líder"); decisões seguem na M5-admin.
-- multi-tenant  -> evento de outro tenant => "não encontrado".
-- outro líder   -> evento de outro líder => "não pertence ao usuário".

-- =====================================================================
-- ROLLBACK (executar manualmente se necessário)
-- =====================================================================
-- drop function if exists public.create_event_request(text, text, text, text, timestamptz, integer, jsonb);
-- drop function if exists public.accept_counter_date(uuid, uuid);
-- drop function if exists public.reject_counter_date(uuid, uuid, text);
-- drop function if exists public.confirm_attendance(uuid, uuid);
-- drop function if exists public.cancel_attendance(uuid, uuid);
