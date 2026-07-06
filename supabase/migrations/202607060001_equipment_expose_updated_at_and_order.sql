-- =====================================================================
-- Equipamentos: expor updated_at e ordenar por última atividade.
--
-- Motivo (usabilidade): a grid admin de equipamentos deve trazer os itens
-- recém-criados OU recém-editados no topo da primeira página. A ordenação
-- correta é por "última atividade" = updated_at (mantido pelo trigger
-- trg_master_equipment_updated_at), com created_at como desempate.
--
-- Antes: as RPCs de equipamento NÃO retornavam updated_at e
-- web_list_equipment_by_tenant ordenava apenas por created_at desc.
--
-- Este arquivo faz `create or replace` (preserva grants existentes):
--   - web_list_equipment_by_tenant  → + updated_at, order by updated_at desc, created_at desc
--   - web_get_equipment_by_tenant   → + updated_at
--   - web_create/update/set_active_equipment_by_tenant → + updated_at no retorno
--   - admin_create/update/set_active_equipment          → + updated_at no retorno
--
-- REGRA DE BLOQUEIO DE INATIVAÇÃO (equipamento vinculado a evento ativo/futuro):
--   - admin_set_equipment_active           → mantém/restaura a regra (de 202606290007)
--   - web_set_equipment_active_by_tenant   → passa a ter a MESMA regra (o painel web
--     usa exclusivamente este caminho, então a proteção não pode existir só no admin)
-- =====================================================================

-- ---------------------------------------------------------------------
-- LEITURA (tenant) — lista ordenada por última atividade
-- ---------------------------------------------------------------------
create or replace function public.web_list_equipment_by_tenant(p_tenant_slug text)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_tenant uuid := web_resolve_tenant(p_tenant_slug);
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'id_tenant', e.id_tenant, 'name', e.name, 'description', e.description,
    'quantity', e.quantity, 'is_active', e.is_active,
    'created_at', e.created_at, 'updated_at', e.updated_at
  ) order by e.updated_at desc, e.created_at desc), '[]'::jsonb) into v_result
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
    'quantity', e.quantity, 'is_active', e.is_active,
    'created_at', e.created_at, 'updated_at', e.updated_at
  ) into v_result
  from master_equipment e
  where e.id = p_id and e.id_tenant = v_tenant;
  if v_result is null then
    raise exception using message = 'Equipamento não encontrado no tenant.';
  end if;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- ESCRITA (tenant) — retorno com updated_at
-- ---------------------------------------------------------------------
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
    'description', e.description, 'quantity', e.quantity, 'is_active', e.is_active,
    'created_at', e.created_at, 'updated_at', e.updated_at)
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
    'description', e.description, 'quantity', e.quantity, 'is_active', e.is_active,
    'created_at', e.created_at, 'updated_at', e.updated_at)
    from master_equipment e where e.id = p_id);
end;
$$;

-- IMPORTANTE: espelha a REGRA DE BLOQUEIO de inativação de admin_set_equipment_active.
-- Como o painel /web/equipamentos usa EXCLUSIVAMENTE este caminho (modo web-tenant),
-- a proteção precisa existir aqui também: equipamento vinculado a evento
-- ativo/futuro (slot pending/approved/counter_proposed) não pode ser inativado.
create or replace function public.web_set_equipment_active_by_tenant(p_tenant_slug text, p_id uuid, p_is_active boolean)
  returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_tenant uuid := web_resolve_tenant(p_tenant_slug);
  v_actor  uuid := web_tenant_actor(v_tenant);
  v_blockers integer;
begin
  if p_is_active is null then raise exception using message = 'is_active é obrigatório.'; end if;
  if not exists (select 1 from master_equipment where id = p_id and id_tenant = v_tenant) then
    raise exception using message = 'Equipamento não encontrado no tenant.';
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
        'Este equipamento está vinculado a %s evento(s) ativo(s) e não pode ser inativado.',
        v_blockers);
    end if;
  end if;

  update master_equipment set is_active = p_is_active, updated_by = v_actor where id = p_id;
  return (select jsonb_build_object('id', e.id, 'id_tenant', e.id_tenant, 'name', e.name,
    'description', e.description, 'quantity', e.quantity, 'is_active', e.is_active,
    'created_at', e.created_at, 'updated_at', e.updated_at)
    from master_equipment e where e.id = p_id);
end;
$$;

-- ---------------------------------------------------------------------
-- ESCRITA (admin) — retorno com updated_at
-- ---------------------------------------------------------------------
create or replace function public.admin_create_equipment(
  p_name text, p_quantity integer, p_description text default null
) returns jsonb
  language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := current_user_id();
  v_tenant uuid := current_tenant_id();
  v_role text := current_user_role();
  v_id uuid;
begin
  if v_uid is null or v_tenant is null then
    raise exception using message = 'Usuário não autenticado.';
  end if;
  if v_role is distinct from 'admin' then
    raise exception using message = 'Apenas admin pode criar equipamento.';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception using message = 'Nome é obrigatório.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception using message = 'Quantidade deve ser maior que zero.';
  end if;
  if exists (select 1 from master_equipment where id_tenant = v_tenant and lower(name) = lower(btrim(p_name))) then
    raise exception using message = 'Já existe um equipamento com esse nome neste tenant.';
  end if;

  insert into master_equipment (id_tenant, name, description, quantity, is_active, created_by, updated_by)
  values (v_tenant, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), p_quantity, true, v_uid, v_uid)
  returning id into v_id;

  return (
    select jsonb_build_object('id', e.id, 'id_tenant', e.id_tenant, 'name', e.name,
      'description', e.description, 'quantity', e.quantity, 'is_active', e.is_active,
      'created_at', e.created_at, 'updated_at', e.updated_at)
    from master_equipment e where e.id = v_id
  );
end;
$$;

create or replace function public.admin_update_equipment(
  p_id uuid, p_name text, p_quantity integer, p_description text default null
) returns jsonb
  language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := current_user_id();
  v_tenant uuid := current_tenant_id();
  v_role text := current_user_role();
begin
  if v_uid is null or v_tenant is null then
    raise exception using message = 'Usuário não autenticado.';
  end if;
  if v_role is distinct from 'admin' then
    raise exception using message = 'Apenas admin pode editar equipamento.';
  end if;
  if not exists (select 1 from master_equipment where id = p_id and id_tenant = v_tenant) then
    raise exception using message = 'Equipamento não encontrado no tenant atual.';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception using message = 'Nome é obrigatório.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception using message = 'Quantidade deve ser maior que zero.';
  end if;
  if exists (select 1 from master_equipment where id_tenant = v_tenant and id <> p_id and lower(name) = lower(btrim(p_name))) then
    raise exception using message = 'Já existe outro equipamento com esse nome neste tenant.';
  end if;

  update master_equipment
     set name = btrim(p_name),
         description = nullif(btrim(coalesce(p_description, '')), ''),
         quantity = p_quantity,
         updated_by = v_uid
   where id = p_id;

  return (
    select jsonb_build_object('id', e.id, 'id_tenant', e.id_tenant, 'name', e.name,
      'description', e.description, 'quantity', e.quantity, 'is_active', e.is_active,
      'created_at', e.created_at, 'updated_at', e.updated_at)
    from master_equipment e where e.id = p_id
  );
end;
$$;

-- IMPORTANTE: preserva a REGRA DE BLOQUEIO de inativação introduzida em
-- 202606290007 (não pode inativar equipamento vinculado a evento ativo/futuro).
-- Este create or replace apenas ACRESCENTA updated_at ao retorno.
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
      'description', e.description, 'quantity', e.quantity, 'is_active', e.is_active,
      'created_at', e.created_at, 'updated_at', e.updated_at)
    from master_equipment e where e.id = p_id
  );
end;
$$;

-- =====================================================================
-- VERIFICAÇÃO (rodar após aplicar; não faz parte da migration)
-- =====================================================================
-- select jsonb_array_elements(web_list_equipment_by_tenant('paje')) -> 'updated_at';  -- deve vir em ordem desc
-- select (admin_create_equipment('Teste updated_at', 1, null)) -> 'updated_at';        -- não-nulo

-- =====================================================================
-- ROLLBACK: reaplicar a migration 202606290006 (admin) e 202607020001 (tenant),
-- que recriam estas funções sem updated_at e com order by created_at desc.
-- =====================================================================
