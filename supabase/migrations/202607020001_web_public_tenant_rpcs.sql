-- =====================================================================
-- RPCs WEB PÚBLICAS POR TENANT (modo espelhado /web/* sem autenticação)
-- Projeto: tfupwytzrkpzocfxheeq (TESTE/HOMOLOGAÇÃO).
--
-- RASCUNHO PARA REVISÃO — NÃO APLICADO NESTA SESSÃO (sem Supabase CLI/MCP).
-- Aplicar via SQL Editor / `supabase db push` APÓS revisão de segurança.
--
-- CONTEXTO / REGRA DE NEGÓCIO:
--   As telas web serão espelhadas dentro de um sistema externo e NÃO terão
--   autenticação própria: "qualquer pessoa com a URL do tenant pode operar".
--   Por isso estas RPCs são as ÚNICAS liberadas para `anon` — as RPCs admin
--   atuais (admin_*, approve_event, etc.) CONTINUAM restritas a authenticated.
--
-- ⚠️ SEGURANÇA — como o acesso é público, o ISOLAMENTO POR TENANT é a única
--   fronteira. Regras seguidas em todas as funções:
--     * SECURITY DEFINER + set search_path = public
--     * tenant resolvido internamente por SLUG (preferencial) ou NOME, sempre
--       case-insensitive — nunca por id vindo do front
--     * tenant precisa existir e estar ATIVO (senão erro amigável)
--     * toda leitura/escrita filtra por id_tenant resolvido
--     * ids de evento/slot/equipamento são validados como pertencentes ao tenant
--     * NUNCA opera dados de outro tenant
--   `service_role` jamais vai ao frontend; o front chama estas RPCs via anon key.
--
-- ATRIBUIÇÃO DE AUTORIA (writes): as colunas NOT NULL master_event.id_user e
--   trx_event_approval.id_reviewed_by exigem um master_user. Como não há sessão,
--   a autoria é atribuída a um ADMIN ativo do tenant (fallback: qualquer usuário
--   ativo do tenant). Se o tenant não tiver usuário, a ação falha.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Helpers internos (NÃO expostos a anon; chamados dentro das RPCs definer)
-- ---------------------------------------------------------------------
create or replace function public.web_resolve_tenant(p_tenant_slug text)
  returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_key    text := lower(btrim(coalesce(p_tenant_slug, '')));
  v_tenant uuid;
begin
  if v_key = '' then
    raise exception using message = 'Tenant não informado na URL.';
  end if;
  -- Aceita o identificador da URL como SLUG (preferencial) OU como NOME do
  -- tenant (case-insensitive). Ex.: ?tenant=borba casa slug='borba' ou name='Borba'.
  select id into v_tenant
    from master_tenant
   where is_active = true and lower(slug) = v_key
   limit 1;
  if v_tenant is null then
    select id into v_tenant
      from master_tenant
     where is_active = true and lower(name) = v_key
     order by created_at asc
     limit 1;
  end if;
  if v_tenant is null then
    raise exception using message = 'Tenant inválido ou inativo.';
  end if;
  return v_tenant;
end;
$$;

create or replace function public.web_tenant_actor(p_tenant uuid)
  returns uuid language plpgsql security definer set search_path = public
as $$
declare v_actor uuid;
begin
  -- Preferir um admin ativo do tenant; fallback = qualquer usuário ativo.
  select mu.id into v_actor
    from master_user mu
    join rel_user_role ur on ur.id_user = mu.id and ur.id_tenant = mu.id_tenant
    join ref_user_role rr on rr.id = ur.id_role
   where mu.id_tenant = p_tenant and rr.code = 'admin' and mu.is_active = true
   order by mu.created_at asc
   limit 1;
  if v_actor is null then
    select id into v_actor
      from master_user
     where id_tenant = p_tenant and is_active = true
     order by created_at asc limit 1;
  end if;
  if v_actor is null then
    raise exception using message = 'Tenant sem usuário para registrar a ação.';
  end if;
  return v_actor;
end;
$$;

revoke all on function public.web_resolve_tenant(text) from public, anon;
revoke all on function public.web_tenant_actor(uuid) from public, anon;

-- ---------------------------------------------------------------------
-- Validação de tenant (usada pela tela para o boundary de acesso)
-- ---------------------------------------------------------------------
create or replace function public.web_tenant_is_active(p_tenant_slug text)
  returns boolean language sql security definer set search_path = public
as $$
  -- Válido se o identificador casar por SLUG ou por NOME (case-insensitive) e ativo.
  select exists (
    select 1 from master_tenant
     where is_active = true
       and lower(btrim(coalesce(p_tenant_slug, ''))) <> ''
       and (lower(slug) = lower(btrim(coalesce(p_tenant_slug, '')))
            or lower(name) = lower(btrim(coalesce(p_tenant_slug, ''))))
  );
$$;

revoke all on function public.web_tenant_is_active(text) from public;
grant execute on function public.web_tenant_is_active(text) to anon, authenticated;

-- =====================================================================
-- LEITURA
-- =====================================================================

-- Lista de eventos do tenant (todos os status) — 1 linha por slot, com
-- confirmed_count. Shape das chaves = EventFullView do front.
create or replace function public.web_list_events_by_tenant(p_tenant_slug text)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_tenant uuid := web_resolve_tenant(p_tenant_slug);
  v_result jsonb;
begin
  select coalesce(jsonb_agg(t.row order by t.created_at desc), '[]'::jsonb) into v_result
  from (
    select
      jsonb_build_object(
        'id_event', e.id,
        'id_slot', s.id,
        'title', e.title,
        'description', e.description,
        'banner_url', e.banner_url,
        'location', e.location,
        'is_active', e.is_active,
        'requested_at', s.requested_at,
        'approved_at', s.approved_at,
        'counter_date', null,
        'capacity', s.capacity,
        'slot_status', ss.code,
        'created_by', e.id_user,
        'confirmed_count', coalesce(cnt.confirmed_count, 0)
      ) as row,
      e.created_at
    from master_event e
    join trx_event_slot s on s.id_event = e.id
    join ref_slot_status ss on ss.id = s.id_slot_status
    left join (
      select a.id_slot, count(*)::int as confirmed_count
      from trx_event_attendance a
      join ref_attendance_status ast on ast.id = a.id_attendance_status
      where ast.code = 'confirmed'
      group by a.id_slot
    ) cnt on cnt.id_slot = s.id
    where e.id_tenant = v_tenant
  ) t;
  return v_result;
end;
$$;

-- Detalhe de um evento do tenant (com equipment_requests embutidos).
create or replace function public.web_get_event_by_tenant(p_tenant_slug text, p_id_event uuid)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_tenant uuid := web_resolve_tenant(p_tenant_slug);
  v_result jsonb;
begin
  select jsonb_build_object(
    'id_event', e.id,
    'id_slot', s.id,
    'title', e.title,
    'description', e.description,
    'banner_url', e.banner_url,
    'location', e.location,
    'is_active', e.is_active,
    'requested_at', s.requested_at,
    'approved_at', s.approved_at,
    'counter_date', null,
    'capacity', s.capacity,
    'slot_status', ss.code,
    'created_by', e.id_user,
    'confirmed_count', coalesce((
      select count(*)::int from trx_event_attendance a
      join ref_attendance_status ast on ast.id = a.id_attendance_status
      where a.id_slot = s.id and ast.code = 'confirmed'
    ), 0),
    'equipment_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'id_event', r.id_event, 'id_equipment', r.id_equipment, 'quantity', r.quantity,
        'equipment', jsonb_build_object(
          'id', eq.id, 'id_tenant', eq.id_tenant, 'name', eq.name, 'description', eq.description,
          'quantity', eq.quantity, 'is_active', eq.is_active, 'created_at', eq.created_at
        )
      ))
      from trx_event_equipment_request r
      join master_equipment eq on eq.id = r.id_equipment
      where r.id_event = e.id
    ), '[]'::jsonb)
  ) into v_result
  from master_event e
  join trx_event_slot s on s.id_event = e.id
  join ref_slot_status ss on ss.id = s.id_slot_status
  where e.id = p_id_event and e.id_tenant = v_tenant
  order by s.requested_at desc
  limit 1;

  if v_result is null then
    raise exception using message = 'Evento não encontrado no tenant.';
  end if;
  return v_result;
end;
$$;

-- Lista de equipamentos do tenant (ativos e inativos).
create or replace function public.web_list_equipment_by_tenant(p_tenant_slug text)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_tenant uuid := web_resolve_tenant(p_tenant_slug);
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'id_tenant', e.id_tenant, 'name', e.name, 'description', e.description,
    'quantity', e.quantity, 'is_active', e.is_active, 'created_at', e.created_at
  ) order by e.created_at desc), '[]'::jsonb) into v_result
  from master_equipment e
  where e.id_tenant = v_tenant;
  return v_result;
end;
$$;

create or replace function public.web_get_equipment_by_tenant(p_tenant_slug text, p_id uuid)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_tenant uuid := web_resolve_tenant(p_tenant_slug);
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', e.id, 'id_tenant', e.id_tenant, 'name', e.name, 'description', e.description,
    'quantity', e.quantity, 'is_active', e.is_active, 'created_at', e.created_at
  ) into v_result
  from master_equipment e
  where e.id = p_id and e.id_tenant = v_tenant;
  if v_result is null then
    raise exception using message = 'Equipamento não encontrado no tenant.';
  end if;
  return v_result;
end;
$$;

-- =====================================================================
-- ESCRITA — EVENTOS
-- =====================================================================

-- Criar evento JÁ APROVADO (espelha admin_create_event) — tenant por slug.
create or replace function public.web_create_event_by_tenant(
  p_tenant_slug        text,
  p_title              text,
  p_description        text,
  p_banner_url         text,
  p_location           text,
  p_requested_at       timestamptz,
  p_capacity           integer,
  p_equipment_requests jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_tenant            uuid := web_resolve_tenant(p_tenant_slug);
  v_actor             uuid := web_tenant_actor(v_tenant);
  v_status_approved   uuid;
  v_decision_approved uuid;
  v_event_id          uuid;
  v_slot_id           uuid;
  v_item              jsonb;
  v_eq_id             uuid;
  v_qty               integer;
  v_equip             jsonb := '[]'::jsonb;
begin
  if p_title is null or btrim(p_title) = '' then raise exception using message = 'Título é obrigatório.'; end if;
  if p_location is null or btrim(p_location) = '' then raise exception using message = 'Local é obrigatório.'; end if;
  if p_requested_at is null then raise exception using message = 'Data/hora é obrigatória.'; end if;
  if p_capacity is null or p_capacity <= 0 then raise exception using message = 'Capacidade deve ser maior que zero.'; end if;
  if p_requested_at::date < current_date then raise exception using message = 'A data do evento não pode ser anterior ao dia de hoje.'; end if;

  select id into v_status_approved   from ref_slot_status       where code = 'approved';
  select id into v_decision_approved from ref_approval_decision where code = 'approved';
  if v_status_approved is null or v_decision_approved is null then
    raise exception using message = 'Catálogo incompleto (ref_slot_status/ref_approval_decision).';
  end if;

  insert into master_event (id_tenant, id_user, title, description, banner_url, location, is_active, created_by, updated_by)
  values (v_tenant, v_actor, btrim(p_title), p_description, p_banner_url, btrim(p_location), true, v_actor, v_actor)
  returning id into v_event_id;

  insert into trx_event_slot (id_event, id_slot_status, requested_at, approved_at, capacity)
  values (v_event_id, v_status_approved, p_requested_at, p_requested_at, p_capacity)
  returning id into v_slot_id;

  if p_equipment_requests is not null and jsonb_typeof(p_equipment_requests) = 'array' then
    for v_item in select * from jsonb_array_elements(p_equipment_requests)
    loop
      v_eq_id := nullif(v_item->>'id_equipment', '')::uuid;
      v_qty   := coalesce((v_item->>'quantity')::integer, 0);
      if v_eq_id is null then raise exception using message = 'id_equipment inválido.'; end if;
      if v_qty <= 0 then raise exception using message = 'Quantidade de equipamento deve ser maior que zero.'; end if;
      if not exists (select 1 from master_equipment eq where eq.id = v_eq_id and eq.id_tenant = v_tenant and eq.is_active = true) then
        raise exception using message = 'Equipamento inválido (não pertence ao tenant ou inativo).';
      end if;
      insert into trx_event_equipment_request (id_event, id_equipment, quantity, is_approved)
      values (v_event_id, v_eq_id, v_qty, true);
      v_equip := v_equip || jsonb_build_object('id_equipment', v_eq_id, 'quantity', v_qty);
    end loop;
  end if;

  insert into trx_event_approval (id_event, id_slot, id_reviewed_by, id_decision, reason, counter_date)
  values (v_event_id, v_slot_id, v_actor, v_decision_approved, null, null);

  insert into trx_equipment_availability (id_equipment, id_event, id_slot, quantity_used, allocated_at)
  select r.id_equipment, v_event_id, v_slot_id, r.quantity, p_requested_at
  from trx_event_equipment_request r
  where r.id_event = v_event_id
    and not exists (select 1 from trx_equipment_availability a
                    where a.id_slot = v_slot_id and a.id_equipment = r.id_equipment and a.released_at is null);

  return jsonb_build_object('id_event', v_event_id, 'id_slot', v_slot_id,
                            'slot_status', 'approved', 'equipment_requests', v_equip);
end;
$$;

-- Editar evento (espelha admin_update_event) — tenant por slug.
create or replace function public.web_update_event_by_tenant(
  p_tenant_slug        text,
  p_id_event           uuid,
  p_id_slot            uuid,
  p_title              text,
  p_description        text,
  p_banner_url         text,
  p_location           text,
  p_requested_at       timestamptz,
  p_capacity           integer,
  p_equipment_requests jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_tenant    uuid := web_resolve_tenant(p_tenant_slug);
  v_actor     uuid := web_tenant_actor(v_tenant);
  v_slot_code text;
  v_item      jsonb;
  v_eq_id     uuid;
  v_qty       integer;
  v_equip     jsonb := '[]'::jsonb;
begin
  if p_title is null or btrim(p_title) = '' then raise exception using message = 'Título é obrigatório.'; end if;
  if p_location is null or btrim(p_location) = '' then raise exception using message = 'Local é obrigatório.'; end if;
  if p_requested_at is null then raise exception using message = 'Data/hora é obrigatória.'; end if;
  if p_capacity is null or p_capacity <= 0 then raise exception using message = 'Capacidade deve ser maior que zero.'; end if;
  if p_requested_at::date < current_date then raise exception using message = 'A data do evento não pode ser anterior ao dia de hoje.'; end if;

  if not exists (select 1 from master_event e where e.id = p_id_event and e.id_tenant = v_tenant) then
    raise exception using message = 'Evento não encontrado no tenant.';
  end if;
  select ss.code into v_slot_code
  from trx_event_slot s join ref_slot_status ss on ss.id = s.id_slot_status
  where s.id = p_id_slot and s.id_event = p_id_event;
  if v_slot_code is null then raise exception using message = 'Slot não encontrado para o evento.'; end if;

  update master_event
     set title = btrim(p_title), description = p_description, banner_url = p_banner_url,
         location = btrim(p_location), updated_by = v_actor
   where id = p_id_event;

  update trx_event_slot
     set requested_at = p_requested_at, capacity = p_capacity,
         approved_at = case when v_slot_code = 'approved' then p_requested_at else approved_at end
   where id = p_id_slot;

  delete from trx_equipment_availability where id_event = p_id_event and id_slot = p_id_slot;
  delete from trx_event_equipment_request where id_event = p_id_event;

  if p_equipment_requests is not null and jsonb_typeof(p_equipment_requests) = 'array' then
    for v_item in select * from jsonb_array_elements(p_equipment_requests)
    loop
      v_eq_id := nullif(v_item->>'id_equipment', '')::uuid;
      v_qty   := coalesce((v_item->>'quantity')::integer, 0);
      if v_eq_id is null then raise exception using message = 'id_equipment inválido.'; end if;
      if v_qty <= 0 then raise exception using message = 'Quantidade de equipamento deve ser maior que zero.'; end if;
      if not exists (select 1 from master_equipment eq where eq.id = v_eq_id and eq.id_tenant = v_tenant and eq.is_active = true) then
        raise exception using message = 'Equipamento inválido (não pertence ao tenant ou inativo).';
      end if;
      insert into trx_event_equipment_request (id_event, id_equipment, quantity, is_approved)
      values (p_id_event, v_eq_id, v_qty, v_slot_code = 'approved');
      v_equip := v_equip || jsonb_build_object('id_equipment', v_eq_id, 'quantity', v_qty);
    end loop;

    if v_slot_code = 'approved' then
      insert into trx_equipment_availability (id_equipment, id_event, id_slot, quantity_used, allocated_at)
      select r.id_equipment, p_id_event, p_id_slot, r.quantity, p_requested_at
      from trx_event_equipment_request r where r.id_event = p_id_event;
    end if;
  end if;

  return jsonb_build_object('id_event', p_id_event, 'id_slot', p_id_slot,
                            'slot_status', v_slot_code, 'equipment_requests', v_equip);
end;
$$;

-- Aprovar evento (espelha approve_event) — tenant por slug.
create or replace function public.web_approve_event_by_tenant(p_tenant_slug text, p_id_event uuid, p_id_slot uuid)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_tenant uuid := web_resolve_tenant(p_tenant_slug);
  v_actor  uuid := web_tenant_actor(v_tenant);
  v_slot_code text; v_requested timestamptz; v_decision uuid; v_status uuid; v_approved_at timestamptz;
begin
  if not exists (select 1 from master_event e where e.id = p_id_event and e.id_tenant = v_tenant) then
    raise exception using message = 'Evento não encontrado no tenant.';
  end if;
  select ss.code, s.requested_at into v_slot_code, v_requested
  from trx_event_slot s join ref_slot_status ss on ss.id = s.id_slot_status
  where s.id = p_id_slot and s.id_event = p_id_event;
  if v_slot_code is null then raise exception using message = 'Slot não encontrado para o evento.'; end if;
  if v_slot_code not in ('pending', 'counter_proposed') then
    raise exception using message = 'Slot não pode ser aprovado (status atual: ' || v_slot_code || ').';
  end if;
  select id into v_decision from ref_approval_decision where code = 'approved';
  select id into v_status   from ref_slot_status      where code = 'approved';
  insert into trx_event_approval (id_event, id_slot, id_reviewed_by, id_decision, reason, counter_date)
  values (p_id_event, p_id_slot, v_actor, v_decision, null, null);
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

-- Sugerir nova data (espelha propose_counter_date) — tenant por slug.
create or replace function public.web_propose_counter_date_by_tenant(
  p_tenant_slug text, p_id_event uuid, p_id_slot uuid, p_counter_date timestamptz, p_reason text)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_tenant uuid := web_resolve_tenant(p_tenant_slug);
  v_actor  uuid := web_tenant_actor(v_tenant);
  v_decision uuid; v_status uuid;
begin
  if p_counter_date is null then raise exception using message = 'Nova data é obrigatória.'; end if;
  if not exists (select 1 from master_event e where e.id = p_id_event and e.id_tenant = v_tenant) then
    raise exception using message = 'Evento não encontrado no tenant.';
  end if;
  if not exists (select 1 from trx_event_slot s where s.id = p_id_slot and s.id_event = p_id_event) then
    raise exception using message = 'Slot não encontrado para o evento.';
  end if;
  select id into v_decision from ref_approval_decision where code = 'counter_proposed';
  select id into v_status   from ref_slot_status      where code = 'counter_proposed';
  insert into trx_event_approval (id_event, id_slot, id_reviewed_by, id_decision, reason, counter_date)
  values (p_id_event, p_id_slot, v_actor, v_decision, nullif(btrim(coalesce(p_reason, '')), ''), p_counter_date);
  update trx_event_slot set id_slot_status = v_status, approved_at = p_counter_date where id = p_id_slot;
  return jsonb_build_object('id_event', p_id_event, 'id_slot', p_id_slot,
                            'slot_status', 'counter_proposed', 'counter_date', p_counter_date);
end;
$$;

-- Ativar/inativar evento (espelha admin_set_event_active) — tenant por slug.
create or replace function public.web_set_event_active_by_tenant(p_tenant_slug text, p_id_event uuid, p_is_active boolean)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_tenant uuid := web_resolve_tenant(p_tenant_slug);
  v_actor  uuid := web_tenant_actor(v_tenant);
begin
  if p_is_active is null then raise exception using message = 'is_active é obrigatório.'; end if;
  if not exists (select 1 from master_event e where e.id = p_id_event and e.id_tenant = v_tenant) then
    raise exception using message = 'Evento não encontrado no tenant.';
  end if;
  update master_event set is_active = p_is_active, updated_by = v_actor where id = p_id_event;
  return jsonb_build_object('id_event', p_id_event, 'is_active', p_is_active);
end;
$$;

-- =====================================================================
-- ESCRITA — EQUIPAMENTOS
-- =====================================================================
create or replace function public.web_create_equipment_by_tenant(
  p_tenant_slug text, p_name text, p_quantity integer, p_description text default null)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_tenant uuid := web_resolve_tenant(p_tenant_slug);
  v_actor  uuid := web_tenant_actor(v_tenant);
  v_id uuid;
begin
  if p_name is null or btrim(p_name) = '' then raise exception using message = 'Nome é obrigatório.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception using message = 'Quantidade deve ser maior que zero.'; end if;
  if exists (select 1 from master_equipment where id_tenant = v_tenant and lower(name) = lower(btrim(p_name))) then
    raise exception using message = 'Já existe um equipamento com esse nome neste tenant.';
  end if;
  insert into master_equipment (id_tenant, name, description, quantity, is_active, created_by, updated_by)
  values (v_tenant, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), p_quantity, true, v_actor, v_actor)
  returning id into v_id;
  return (select jsonb_build_object('id', e.id, 'id_tenant', e.id_tenant, 'name', e.name,
    'description', e.description, 'quantity', e.quantity, 'is_active', e.is_active, 'created_at', e.created_at)
    from master_equipment e where e.id = v_id);
end;
$$;

create or replace function public.web_update_equipment_by_tenant(
  p_tenant_slug text, p_id uuid, p_name text, p_quantity integer, p_description text default null)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_tenant uuid := web_resolve_tenant(p_tenant_slug);
  v_actor  uuid := web_tenant_actor(v_tenant);
begin
  if not exists (select 1 from master_equipment where id = p_id and id_tenant = v_tenant) then
    raise exception using message = 'Equipamento não encontrado no tenant.';
  end if;
  if p_name is null or btrim(p_name) = '' then raise exception using message = 'Nome é obrigatório.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception using message = 'Quantidade deve ser maior que zero.'; end if;
  if exists (select 1 from master_equipment where id_tenant = v_tenant and id <> p_id and lower(name) = lower(btrim(p_name))) then
    raise exception using message = 'Já existe outro equipamento com esse nome neste tenant.';
  end if;
  update master_equipment
     set name = btrim(p_name), description = nullif(btrim(coalesce(p_description, '')), ''),
         quantity = p_quantity, updated_by = v_actor
   where id = p_id;
  return (select jsonb_build_object('id', e.id, 'id_tenant', e.id_tenant, 'name', e.name,
    'description', e.description, 'quantity', e.quantity, 'is_active', e.is_active, 'created_at', e.created_at)
    from master_equipment e where e.id = p_id);
end;
$$;

create or replace function public.web_set_equipment_active_by_tenant(p_tenant_slug text, p_id uuid, p_is_active boolean)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_tenant uuid := web_resolve_tenant(p_tenant_slug);
  v_actor  uuid := web_tenant_actor(v_tenant);
begin
  if p_is_active is null then raise exception using message = 'is_active é obrigatório.'; end if;
  if not exists (select 1 from master_equipment where id = p_id and id_tenant = v_tenant) then
    raise exception using message = 'Equipamento não encontrado no tenant.';
  end if;
  update master_equipment set is_active = p_is_active, updated_by = v_actor where id = p_id;
  return (select jsonb_build_object('id', e.id, 'id_tenant', e.id_tenant, 'name', e.name,
    'description', e.description, 'quantity', e.quantity, 'is_active', e.is_active, 'created_at', e.created_at)
    from master_equipment e where e.id = p_id);
end;
$$;

-- ---------------------------------------------------------------------
-- GRANTS: SOMENTE estas RPCs web são liberadas para anon.
-- As RPCs admin_* / approve_event / etc. CONTINUAM restritas a authenticated.
-- ---------------------------------------------------------------------
grant execute on function public.web_list_events_by_tenant(text)                                   to anon, authenticated;
grant execute on function public.web_get_event_by_tenant(text, uuid)                               to anon, authenticated;
grant execute on function public.web_list_equipment_by_tenant(text)                                to anon, authenticated;
grant execute on function public.web_get_equipment_by_tenant(text, uuid)                           to anon, authenticated;
grant execute on function public.web_create_event_by_tenant(text, text, text, text, text, timestamptz, integer, jsonb) to anon, authenticated;
grant execute on function public.web_update_event_by_tenant(text, uuid, uuid, text, text, text, text, timestamptz, integer, jsonb) to anon, authenticated;
grant execute on function public.web_approve_event_by_tenant(text, uuid, uuid)                     to anon, authenticated;
grant execute on function public.web_propose_counter_date_by_tenant(text, uuid, uuid, timestamptz, text) to anon, authenticated;
grant execute on function public.web_set_event_active_by_tenant(text, uuid, boolean)               to anon, authenticated;
grant execute on function public.web_create_equipment_by_tenant(text, text, integer, text)         to anon, authenticated;
grant execute on function public.web_update_equipment_by_tenant(text, uuid, text, integer, text)   to anon, authenticated;
grant execute on function public.web_set_equipment_active_by_tenant(text, uuid, boolean)           to anon, authenticated;

commit;

-- =====================================================================
-- VERIFICAÇÃO (rodar APÓS aplicar; não faz parte da migration)
-- =====================================================================
-- select web_tenant_is_active('paje');                        -- true
-- select web_list_events_by_tenant('paje');                   -- eventos do tenant paje
-- select web_list_events_by_tenant('inexistente');            -- erro "Tenant inválido ou inativo."
-- select web_list_events_by_tenant('');                       -- erro "Tenant não informado na URL."
-- Confirmar que nenhuma linha de OUTRO tenant aparece nos retornos acima.

-- =====================================================================
-- ROLLBACK (executar manualmente se necessário)
-- =====================================================================
-- drop function if exists public.web_list_events_by_tenant(text);
-- drop function if exists public.web_get_event_by_tenant(text, uuid);
-- drop function if exists public.web_list_equipment_by_tenant(text);
-- drop function if exists public.web_get_equipment_by_tenant(text, uuid);
-- drop function if exists public.web_create_event_by_tenant(text, text, text, text, text, timestamptz, integer, jsonb);
-- drop function if exists public.web_update_event_by_tenant(text, uuid, uuid, text, text, text, text, timestamptz, integer, jsonb);
-- drop function if exists public.web_approve_event_by_tenant(text, uuid, uuid);
-- drop function if exists public.web_propose_counter_date_by_tenant(text, uuid, uuid, timestamptz, text);
-- drop function if exists public.web_set_event_active_by_tenant(text, uuid, boolean);
-- drop function if exists public.web_create_equipment_by_tenant(text, text, integer, text);
-- drop function if exists public.web_update_equipment_by_tenant(text, uuid, text, integer, text);
-- drop function if exists public.web_set_equipment_active_by_tenant(text, uuid, boolean);
-- drop function if exists public.web_tenant_is_active(text);
-- drop function if exists public.web_tenant_actor(uuid);
-- drop function if exists public.web_resolve_tenant(text);
