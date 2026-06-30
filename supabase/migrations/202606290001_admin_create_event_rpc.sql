-- =====================================================================
-- admin_create_event — criação de evento JÁ APROVADO pelo admin (web)
-- Projeto: tfupwytzrkpzocfxheeq (TESTE/HOMOLOGAÇÃO) — NÃO aplicar em produção.
--
-- RASCUNHO PARA REVISÃO — NÃO APLICADO NO BANCO (sem Supabase CLI/MCP nesta
-- sessão). Aplicar via SQL Editor ou `supabase db push`.
--
-- Por que uma RPC separada da M5-B `create_event_request`:
--   - create_event_request é EXCLUSIVA de community_leader e cria slot 'pending'.
--   - admin_create_event é do ADMIN e cria o evento já 'approved' (sem etapa de
--     aprovação posterior), registrando a decisão em trx_event_approval e
--     alocando equipamentos como o approve_event faz.
--
-- Padrão (igual a approve_event/202606250003):
--   * SECURITY DEFINER + set search_path = public
--   * autenticação via current_user_id(); tenant via current_tenant_id();
--     role via current_user_role(). NUNCA confia em tenant/user do frontend.
--   * status/decisões resolvidos por CODE (nunca id fixo).
--   * EXECUTE somente para authenticated (revogado de PUBLIC/anon).
-- =====================================================================

begin;

create or replace function public.admin_create_event(
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
  v_uid               uuid := current_user_id();
  v_tenant            uuid := current_tenant_id();
  v_role              text := current_user_role();
  v_status_approved   uuid;
  v_decision_approved uuid;
  v_event_id          uuid;
  v_slot_id           uuid;
  v_item              jsonb;
  v_eq_id             uuid;
  v_qty               integer;
  v_equip             jsonb := '[]'::jsonb;
begin
  -- (1) autenticação + (2) role admin + (3/4) contexto
  if v_uid is null or v_tenant is null then
    raise exception using message = 'Usuário não autenticado.';
  end if;
  if v_role is distinct from 'admin' then
    raise exception using message = 'Apenas admin pode criar evento por esta rota.';
  end if;

  -- (7) campos obrigatórios
  if p_title is null or btrim(p_title) = '' then
    raise exception using message = 'Título é obrigatório.';
  end if;
  if p_location is null or btrim(p_location) = '' then
    raise exception using message = 'Local é obrigatório.';
  end if;
  if p_requested_at is null then
    raise exception using message = 'Data/hora (requested_at) é obrigatória.';
  end if;
  if p_capacity is null or p_capacity <= 0 then
    raise exception using message = 'Capacidade deve ser maior que zero.';
  end if;

  select id into v_status_approved   from ref_slot_status      where code = 'approved';
  select id into v_decision_approved from ref_approval_decision where code = 'approved';
  if v_status_approved is null or v_decision_approved is null then
    raise exception using message = 'Catálogo incompleto (ref_slot_status/ref_approval_decision).';
  end if;

  -- (8) master_event — tenant/user SEMPRE do contexto (nunca do front)
  insert into master_event (
    id_tenant, id_user, title, description, banner_url, location, is_active, created_by, updated_by
  ) values (
    v_tenant, v_uid, btrim(p_title), p_description, p_banner_url, btrim(p_location), true, v_uid, v_uid
  ) returning id into v_event_id;

  -- (9) slot já APROVADO (admin) — requested_at = approved_at = data informada
  insert into trx_event_slot (id_event, id_slot_status, requested_at, approved_at, capacity)
  values (v_event_id, v_status_approved, p_requested_at, p_requested_at, p_capacity)
  returning id into v_slot_id;

  -- (11) equipamentos solicitados (opcional), já aprovados
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
      -- equipamento precisa ser do mesmo tenant e ativo
      if not exists (
        select 1 from master_equipment eq
        where eq.id = v_eq_id and eq.id_tenant = v_tenant and eq.is_active = true
      ) then
        raise exception using message = 'Equipamento inválido (não pertence ao tenant atual ou está inativo).';
      end if;

      insert into trx_event_equipment_request (id_event, id_equipment, quantity, is_approved)
      values (v_event_id, v_eq_id, v_qty, true);

      v_equip := v_equip || jsonb_build_object('id_equipment', v_eq_id, 'quantity', v_qty);
    end loop;
  end if;

  -- (10) decisão de aprovação do admin (id_reviewed_by = admin do contexto)
  insert into trx_event_approval (id_event, id_slot, id_reviewed_by, id_decision, reason, counter_date)
  values (v_event_id, v_slot_id, v_uid, v_decision_approved, null, null);

  -- (11) alocação de equipamentos — MESMA regra do approve_event
  insert into trx_equipment_availability (id_equipment, id_event, id_slot, quantity_used, allocated_at)
  select r.id_equipment, v_event_id, v_slot_id, r.quantity, p_requested_at
  from trx_event_equipment_request r
  where r.id_event = v_event_id
    and not exists (
      select 1 from trx_equipment_availability a
      where a.id_slot = v_slot_id and a.id_equipment = r.id_equipment and a.released_at is null
    );

  -- (12) retorno
  return jsonb_build_object(
    'id_event',           v_event_id,
    'id_slot',            v_slot_id,
    'slot_status',        'approved',
    'equipment_requests', v_equip
  );
end;
$$;

-- Grants: EXECUTE só para authenticated (revogado de PUBLIC/anon)
revoke all on function public.admin_create_event(text, text, text, text, timestamptz, integer, jsonb) from public, anon;
grant execute on function public.admin_create_event(text, text, text, text, timestamptz, integer, jsonb) to authenticated;

commit;

-- =====================================================================
-- VERIFICAÇÃO (rodar APÓS aplicar; não faz parte da migration)
-- =====================================================================
-- anon  -> "permission denied for function admin_create_event"
-- líder -> "Apenas admin pode criar evento por esta rota."
-- admin -> retorna { id_event, id_slot, slot_status:'approved', equipment_requests:[...] };
--          master_event + trx_event_slot(approved) + trx_event_approval(approved)
--          + trx_event_equipment_request(is_approved=true) + trx_equipment_availability.

-- =====================================================================
-- ROLLBACK (executar manualmente se necessário)
-- =====================================================================
-- drop function if exists public.admin_create_event(text, text, text, text, timestamptz, integer, jsonb);
