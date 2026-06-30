-- =====================================================================
-- admin_update_event — edição de evento pelo admin (web)
-- Projeto: tfupwytzrkpzocfxheeq (TESTE/HOMOLOGAÇÃO) — NÃO aplicar em produção.
-- APLICADA em homologação via MCP apply_migration (2026-06-29).
--
-- Atualiza master_event + trx_event_slot e faz REPLACE completo dos
-- equipamentos (trx_event_equipment_request + trx_equipment_availability),
-- sem tocar em presença. Admin-only; tenant/usuário via contexto.
-- Padrão: SECURITY DEFINER + search_path fixo; EXECUTE só authenticated.
-- =====================================================================

create or replace function public.admin_update_event(
  p_id_event           uuid,
  p_id_slot            uuid,
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
  v_uid       uuid := current_user_id();
  v_tenant    uuid := current_tenant_id();
  v_role      text := current_user_role();
  v_slot_code text;
  v_item      jsonb;
  v_eq_id     uuid;
  v_qty       integer;
  v_equip     jsonb := '[]'::jsonb;
begin
  if v_uid is null or v_tenant is null then
    raise exception using message = 'Usuário não autenticado.';
  end if;
  if v_role is distinct from 'admin' then
    raise exception using message = 'Apenas admin pode editar evento.';
  end if;
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

  if not exists (select 1 from master_event e where e.id = p_id_event and e.id_tenant = v_tenant) then
    raise exception using message = 'Evento não encontrado no tenant atual.';
  end if;
  select ss.code into v_slot_code
  from trx_event_slot s join ref_slot_status ss on ss.id = s.id_slot_status
  where s.id = p_id_slot and s.id_event = p_id_event;
  if v_slot_code is null then
    raise exception using message = 'Slot não encontrado para o evento.';
  end if;

  update master_event
     set title = btrim(p_title), description = p_description, banner_url = p_banner_url,
         location = btrim(p_location), updated_by = v_uid
   where id = p_id_event;

  update trx_event_slot
     set requested_at = p_requested_at,
         capacity = p_capacity,
         approved_at = case when v_slot_code = 'approved' then p_requested_at else approved_at end
   where id = p_id_slot;

  -- REPLACE completo dos equipamentos (estado final = payload)
  delete from trx_equipment_availability where id_event = p_id_event and id_slot = p_id_slot;
  delete from trx_event_equipment_request where id_event = p_id_event;

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
      values (p_id_event, v_eq_id, v_qty, v_slot_code = 'approved');

      v_equip := v_equip || jsonb_build_object('id_equipment', v_eq_id, 'quantity', v_qty);
    end loop;

    if v_slot_code = 'approved' then
      insert into trx_equipment_availability (id_equipment, id_event, id_slot, quantity_used, allocated_at)
      select r.id_equipment, p_id_event, p_id_slot, r.quantity, p_requested_at
      from trx_event_equipment_request r
      where r.id_event = p_id_event;
    end if;
  end if;

  return jsonb_build_object(
    'id_event', p_id_event, 'id_slot', p_id_slot, 'slot_status', v_slot_code, 'equipment_requests', v_equip
  );
end;
$$;

revoke all on function public.admin_update_event(uuid, uuid, text, text, text, text, timestamptz, integer, jsonb) from public, anon;
grant execute on function public.admin_update_event(uuid, uuid, text, text, text, text, timestamptz, integer, jsonb) to authenticated;

-- rollback:
-- drop function if exists public.admin_update_event(uuid, uuid, text, text, text, text, timestamptz, integer, jsonb);
