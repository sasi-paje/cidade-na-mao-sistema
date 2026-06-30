-- =====================================================================
-- CRUD real de equipamentos (admin) — Projeto: tfupwytzrkpzocfxheeq (HOMOLOG).
-- APLICADA via MCP apply_migration (2026-06-29).
--
-- Reusa master_equipment. Admin-only, tenant via contexto; nunca escreve fora
-- do tenant. SECURITY DEFINER + search_path fixo; EXECUTE só authenticated.
-- Dedup de nome (case-insensitive) por tenant. is_active preserva auditoria.
-- =====================================================================

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
      'description', e.description, 'quantity', e.quantity, 'is_active', e.is_active, 'created_at', e.created_at)
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
      'description', e.description, 'quantity', e.quantity, 'is_active', e.is_active, 'created_at', e.created_at)
    from master_equipment e where e.id = p_id
  );
end;
$$;

create or replace function public.admin_set_equipment_active(p_id uuid, p_is_active boolean)
  returns jsonb
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
    raise exception using message = 'Apenas admin pode ativar/inativar equipamento.';
  end if;
  if p_is_active is null then
    raise exception using message = 'is_active é obrigatório.';
  end if;
  if not exists (select 1 from master_equipment where id = p_id and id_tenant = v_tenant) then
    raise exception using message = 'Equipamento não encontrado no tenant atual.';
  end if;

  update master_equipment set is_active = p_is_active, updated_by = v_uid where id = p_id;

  return (
    select jsonb_build_object('id', e.id, 'id_tenant', e.id_tenant, 'name', e.name,
      'description', e.description, 'quantity', e.quantity, 'is_active', e.is_active, 'created_at', e.created_at)
    from master_equipment e where e.id = p_id
  );
end;
$$;

revoke all on function public.admin_create_equipment(text, integer, text) from public, anon;
revoke all on function public.admin_update_equipment(uuid, text, integer, text) from public, anon;
revoke all on function public.admin_set_equipment_active(uuid, boolean) from public, anon;
grant execute on function public.admin_create_equipment(text, integer, text) to authenticated;
grant execute on function public.admin_update_equipment(uuid, text, integer, text) to authenticated;
grant execute on function public.admin_set_equipment_active(uuid, boolean) to authenticated;

-- rollback:
-- drop function if exists public.admin_create_equipment(text, integer, text);
-- drop function if exists public.admin_update_equipment(uuid, text, integer, text);
-- drop function if exists public.admin_set_equipment_active(uuid, boolean);
