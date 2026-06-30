-- Fix create_route_from_assign_notes: use id_previous_route_invoice (without _id suffix)
-- The table column is id_previous_route_invoice but the RPC was inserting id_previous_route_invoice_id

create or replace function public.create_route_from_assign_notes(
  p_id_vehicle bigint,
  p_departure_date date,
  p_id_route_responsible bigint,
  p_id_driver bigint default null,
  p_area text default null,
  p_assistant text[] default null,
  p_invoice_ids bigint[] default null,
  p_is_test boolean default false
)
returns table(p_id bigint, p_route_code text)
language plpgsql
security definer
as $$
declare
  v_route_id bigint;
  v_route_code text;
  v_id_route_status bigint;
  v_id_route_delivery_status bigint;
  v_invoice_id bigint;
  v_attempt_number integer;
  v_previous_route_invoice_id bigint;
  v_assistant_is_array boolean;
  v_has_new_history_columns boolean;
begin
  if not exists (
    select 1
    from public.master_fleet_vehicle
    where id = p_id_vehicle
      and is_active = true
  ) then
    raise exception 'Veiculo invalido ou inativo';
  end if;

  if not exists (
    select 1
    from public.ref_route_responsible
    where id = p_id_route_responsible
      and is_active = true
  ) then
    raise exception 'Responsavel invalido ou inativo';
  end if;

  if p_id_driver is not null and not exists (
    select 1
    from public.master_person_driver
    where id = p_id_driver
      and is_active = true
  ) then
    raise exception 'Motorista invalido ou inativo';
  end if;

  if p_invoice_ids is not null and array_length(p_invoice_ids, 1) > 0 then
    foreach v_invoice_id in array p_invoice_ids
    loop
      if not exists (
        select 1
        from public.trx_fiscal_invoice
        where id = v_invoice_id
          and is_active = true
          and is_test = p_is_test
      ) then
        raise exception 'Nota % nao existe ou nao esta disponivel', v_invoice_id;
      end if;

      if exists (
        select 1
        from public.rel_route_invoice
        where id_fiscal_invoice = v_invoice_id
          and is_active = true
      ) then
        raise exception 'Nota % ja esta em uma rota ativa', v_invoice_id;
      end if;
    end loop;
  end if;

  if exists (
    select 1
    from public.trx_route
    where id_vehicle = p_id_vehicle
      and departure_date = p_departure_date
      and is_active = true
      and is_test = p_is_test
  ) then
    raise exception 'Ja existe uma rota ativa para este veiculo nesta data';
  end if;

  select id
  into v_id_route_status
  from public.ref_route_status
  where is_initial = true
    and is_active = true
    and (is_test = p_is_test or is_test = false)
  order by case when is_test = p_is_test then 0 else 1 end
  limit 1;

  if not found then
    raise exception 'Status inicial da rota nao encontrado';
  end if;

  select id
  into v_id_route_delivery_status
  from public.ref_route_delivery_status
  where is_initial = true
    and is_active = true
    and (is_test = p_is_test or is_test = false)
  order by case when is_test = p_is_test then 0 else 1 end
  limit 1;

  if not found then
    raise exception 'Status inicial da entrega nao encontrado';
  end if;

  select coalesce(max(route_code::integer), 0) + 1
  into v_route_code
  from public.trx_route
  where is_test = p_is_test
    and route_code ~ '^[0-9]+$';

  v_route_code := lpad(v_route_code::text, 6, '0');

  select data_type = 'ARRAY'
  into v_assistant_is_array
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'trx_route'
    and column_name = 'assistant';

  if coalesce(v_assistant_is_array, false) then
    insert into public.trx_route (
      route_code, departure_date,
      id_route_status, id_route_delivery_status,
      id_vehicle, id_driver,
      area, assistant,
      is_test, is_active,
      id_route_responsible
    ) values (
      v_route_code, p_departure_date,
      v_id_route_status, v_id_route_delivery_status,
      p_id_vehicle, p_id_driver,
      p_area, p_assistant,
      p_is_test, true,
      p_id_route_responsible
    )
    returning id into v_route_id;
  else
    insert into public.trx_route (
      route_code, departure_date,
      id_route_status, id_route_delivery_status,
      id_vehicle, id_driver,
      area, assistant,
      is_test, is_active,
      id_route_responsible
    ) values (
      v_route_code, p_departure_date,
      v_id_route_status, v_id_route_delivery_status,
      p_id_vehicle, p_id_driver,
      p_area, array_to_string(p_assistant, ', '),
      p_is_test, true,
      p_id_route_responsible
    )
    returning id into v_route_id;
  end if;

  if p_invoice_ids is not null and array_length(p_invoice_ids, 1) > 0 then
    foreach v_invoice_id in array p_invoice_ids
    loop
      select coalesce(max(attempt_number), 0) + 1, max(id)
      into v_attempt_number, v_previous_route_invoice_id
      from public.rel_route_invoice
      where id_fiscal_invoice = v_invoice_id;

      insert into public.rel_route_invoice (
        id_route, id_fiscal_invoice,
        assigned_at,
        is_test, is_active,
        attempt_number,
        id_previous_route_invoice,
        planned_box_quantity,
        planned_amount
      ) values (
        v_route_id, v_invoice_id,
        now(),
        p_is_test, true,
        coalesce(v_attempt_number, 1),
        v_previous_route_invoice_id,
        (select box_quantity from public.trx_fiscal_invoice where id = v_invoice_id),
        (select invoice_amount from public.trx_fiscal_invoice where id = v_invoice_id)
      );

      update public.trx_fiscal_invoice
      set id_fiscal_invoice_status = (
        select id
        from public.ref_fiscal_invoice_status
        where code = 'EM_ROTA'
        limit 1
      )
      where id = v_invoice_id;
    end loop;

    perform public.sync_route_stops(v_route_id, null);
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trx_route_history'
      and column_name = 'event_type'
  )
  into v_has_new_history_columns;

  if v_has_new_history_columns then
    insert into public.trx_route_history (
      id_route, event_type, event_label, event_description,
      event_at, metadata, is_test, is_active
    ) values (
      v_route_id,
      'ROUTE_CREATED',
      'Rota Criada',
      'Rota ' || v_route_code || ' criada com ' || coalesce(array_length(p_invoice_ids, 1), 0) || ' notas',
      now(),
      jsonb_build_object(
        'vehicle_id', p_id_vehicle,
        'responsible_id', p_id_route_responsible,
        'invoice_count', coalesce(array_length(p_invoice_ids, 1), 0)
      ),
      p_is_test,
      true
    );
  else
    insert into public.trx_route_history (
      id_route, id_history_type, event_at, description, is_test, is_active
    ) values (
      v_route_id,
      null,
      now(),
      'Rota ' || v_route_code || ' criada com ' || coalesce(array_length(p_invoice_ids, 1), 0) || ' notas',
      p_is_test,
      true
    );
  end if;

  return query select v_route_id, v_route_code::text;
end;
$$;

grant execute on function public.create_route_from_assign_notes to authenticated, anon;
