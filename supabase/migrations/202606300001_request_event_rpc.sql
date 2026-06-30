-- =====================================================================
-- request_event — solicitação de evento pelo LÍDER comunitário (mobile)
-- Projeto: tfupwytzrkpzocfxheeq (HOMOLOGAÇÃO). Aplicada via MCP apply_migration.
--
-- Cria o evento com slot 'pending' (entra na fila de aprovação do admin).
-- Difere de admin_create_event: NÃO cria decisão de aprovação nem aloca
-- equipamento (isso só ocorre em approve_event). Equipamentos ficam
-- is_approved = null (indecisos) até a aprovação.
--
-- Padrão (igual a admin_create_event / approve_event):
--   * SECURITY DEFINER + set search_path = public
--   * autenticação via current_user_id(); tenant via current_tenant_id();
--     role via current_user_role(). NUNCA confia em tenant/user do frontend.
--   * status resolvido por CODE (nunca id fixo).
--   * EXECUTE somente para authenticated (revogado de PUBLIC/anon).
-- =====================================================================

begin;

create or replace function public.request_event(
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
  -- (1) autenticação + (2) papel (líder solicita; admin também pode)
  if v_uid is null or v_tenant is null then
    raise exception using message = 'Usuário não autenticado.';
  end if;
  if v_role is distinct from 'community_leader' and v_role is distinct from 'admin' then
    raise exception using message = 'Apenas líderes comunitários podem solicitar eventos.';
  end if;

  -- (3) campos obrigatórios
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

  select id into v_status_pending from ref_slot_status where code = 'pending';
  if v_status_pending is null then
    raise exception using message = 'Catálogo incompleto (ref_slot_status sem "pending").';
  end if;

  -- (4) master_event — tenant/user SEMPRE do contexto (nunca do front)
  insert into master_event (
    id_tenant, id_user, title, description, banner_url, location, is_active, created_by, updated_by
  ) values (
    v_tenant, v_uid, btrim(p_title), p_description, p_banner_url, btrim(p_location), true, v_uid, v_uid
  ) returning id into v_event_id;

  -- (5) slot PENDENTE — sem approved_at (entra na fila do admin)
  insert into trx_event_slot (id_event, id_slot_status, requested_at, approved_at, capacity)
  values (v_event_id, v_status_pending, p_requested_at, null, p_capacity)
  returning id into v_slot_id;

  -- (6) equipamentos solicitados (opcional), ainda NÃO aprovados (is_approved = null)
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
      if not exists (
        select 1 from master_equipment eq
        where eq.id = v_eq_id and eq.id_tenant = v_tenant and eq.is_active = true
      ) then
        raise exception using message = 'Equipamento inválido (não pertence ao tenant atual ou está inativo).';
      end if;

      insert into trx_event_equipment_request (id_event, id_equipment, quantity, is_approved)
      values (v_event_id, v_eq_id, v_qty, null);

      v_equip := v_equip || jsonb_build_object('id_equipment', v_eq_id, 'quantity', v_qty);
    end loop;
  end if;

  -- (7) retorno
  return jsonb_build_object(
    'id_event',           v_event_id,
    'id_slot',            v_slot_id,
    'slot_status',        'pending',
    'equipment_requests', v_equip
  );
end;
$$;

revoke all on function public.request_event(text, text, text, text, timestamptz, integer, jsonb) from public, anon;
grant execute on function public.request_event(text, text, text, text, timestamptz, integer, jsonb) to authenticated;

commit;

-- =====================================================================
-- ROLLBACK
-- drop function if exists public.request_event(text, text, text, text, timestamptz, integer, jsonb);
-- =====================================================================
