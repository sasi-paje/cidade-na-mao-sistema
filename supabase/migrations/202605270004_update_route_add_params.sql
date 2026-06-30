-- Add p_departure_date and p_id_route_responsible to update_route_from_assign_notes
-- Drop old overload (6 params) to avoid ambiguity
drop function if exists public.update_route_from_assign_notes(bigint, bigint, text, text[], bigint[], boolean);

create or replace function public.update_route_from_assign_notes(
  p_route_id bigint,
  p_departure_date date default null,
  p_id_route_responsible bigint default null,
  p_id_driver bigint default null,
  p_area text default null,
  p_assistant text[] default null,
  p_invoice_ids bigint[] default null,
  p_is_test boolean default false
)
returns void
language plpgsql
security definer
as $$
declare
  v_current_status_id bigint;
  v_allows_edition boolean;
  v_has_history_event_type boolean;
  v_route_code text;
begin
  select id_route_delivery_status, route_code
  into v_current_status_id, v_route_code
  from public.trx_route
  where id = p_route_id and is_active = true and is_test = p_is_test;

  if not found then
    raise exception 'Rota nao encontrada';
  end if;

  select allows_route_edition into v_allows_edition
  from public.ref_route_delivery_status
  where id = v_current_status_id;

  if v_allows_edition = false then
    raise exception 'Rota em andamento - montagem nao pode ser alterada';
  end if;

  update public.trx_route
  set
    departure_date = coalesce(p_departure_date, departure_date),
    id_route_responsible = coalesce(p_id_route_responsible, id_route_responsible),
    id_driver = coalesce(p_id_driver, id_driver),
    area = coalesce(p_area, area),
    assistant = coalesce(p_assistant, assistant),
    updated_at = now()
  where id = p_route_id;

  if p_invoice_ids is not null then
    perform public.sync_route_invoices(p_route_id, to_jsonb(p_invoice_ids::text[]), null);
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trx_route_history'
      and column_name = 'event_type'
  ) into v_has_history_event_type;

  if v_has_history_event_type then
    insert into public.trx_route_history (
      id_route, event_type, event_label, event_description, event_at, is_test, is_active
    ) values (
      p_route_id, 'ROUTE_UPDATED', 'Rota Atualizada',
      'Rota ' || v_route_code || ' atualizada',
      now(), p_is_test, true
    );
  end if;
end;
$$;

grant execute on function public.update_route_from_assign_notes(bigint, date, bigint, bigint, text, text[], bigint[], boolean) to authenticated, anon;
