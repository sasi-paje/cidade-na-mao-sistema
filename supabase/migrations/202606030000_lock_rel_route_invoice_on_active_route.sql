-- Trigger: bloqueia INSERT/UPDATE/DELETE em rel_route_invoice
-- quando a rota associada não permite mais edição (allows_route_edition = false).
-- Isso é uma proteção de banco independente do frontend e das RPCs.

create or replace function public.check_route_invoice_edition_allowed()
returns trigger
language plpgsql
security definer
as $$
declare
  v_status_id bigint;
  v_allows_edition boolean;
  v_route_id bigint;
begin
  -- Para DELETE usa o OLD.id_route; para INSERT/UPDATE usa o NEW.id_route
  if tg_op = 'DELETE' then
    v_route_id := old.id_route;
  else
    v_route_id := new.id_route;
  end if;

  select id_route_delivery_status
  into v_status_id
  from public.trx_route
  where id = v_route_id
    and is_active = true;

  if not found then
    -- Rota não encontrada ou inativa — permite a operação
    return case tg_op when 'DELETE' then old else new end;
  end if;

  select allows_route_edition
  into v_allows_edition
  from public.ref_route_delivery_status
  where id = v_status_id;

  if v_allows_edition = false then
    raise exception 'Rota em andamento. A montagem não pode mais ser alterada.'
      using errcode = 'P0001';
  end if;

  return case tg_op when 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_lock_rel_route_invoice on public.rel_route_invoice;

create trigger trg_lock_rel_route_invoice
  before insert or update or delete on public.rel_route_invoice
  for each row
  execute function public.check_route_invoice_edition_allowed();
