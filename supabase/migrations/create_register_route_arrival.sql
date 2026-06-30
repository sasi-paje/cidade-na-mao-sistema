-- Infraestrutura para chegada ao cliente via SASI + Edge Function.
-- Nao cria policy anon de insert. O upload no bucket route-arrivals deve ser
-- feito pela Edge Function usando SUPABASE_SERVICE_ROLE_KEY.

create table if not exists public.trx_route_access_token (
  id bigserial primary key,
  token text not null unique,
  id_route bigint not null references public.trx_route(id) on delete cascade,
  expires_at timestamptz,
  is_active boolean not null default true,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  created_by bigint,
  updated_at timestamptz,
  updated_by bigint
);

alter table public.trx_route_access_token
  add column if not exists token text,
  add column if not exists id_route bigint,
  add column if not exists expires_at timestamptz,
  add column if not exists is_active boolean not null default true,
  add column if not exists is_test boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists created_by bigint,
  add column if not exists updated_at timestamptz,
  add column if not exists updated_by bigint;

create unique index if not exists trx_route_access_token_token_uidx
on public.trx_route_access_token (token);

create index if not exists trx_route_access_token_route_idx
on public.trx_route_access_token (id_route)
where is_active = true;

alter table public.trx_route_access_token enable row level security;

insert into storage.buckets (
  id,
  name,
  "public",
  file_size_limit,
  allowed_mime_types
)
values (
  'route-arrivals',
  'route-arrivals',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]::text[]
)
on conflict (id) do update
set
  "public" = excluded."public",
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.register_route_stop_arrival(
  p_id_route_stop bigint,
  p_arrived_at timestamptz,
  p_arrival_photo_path text,
  p_justification text default null,
  p_user_id bigint default null
)
returns table (
  id_route_stop bigint,
  arrived_at timestamptz,
  arrival_photo_path text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_arrived_at timestamptz;
begin
  select trs.arrived_at
    into v_existing_arrived_at
  from public.trx_route_stop trs
  where trs.id = p_id_route_stop
    and trs.is_active = true
  for update;

  if not found then
    raise exception 'Parada da rota nao encontrada.'
      using errcode = 'P0002';
  end if;

  if v_existing_arrived_at is not null and nullif(trim(coalesce(p_justification, '')), '') is null then
    raise exception 'Justificativa obrigatoria para alterar chegada ja registrada.'
      using errcode = '23514';
  end if;

  update public.trx_route_stop
  set
    arrived_at = p_arrived_at,
    arrival_photo_path = p_arrival_photo_path,
    arrival_observation = nullif(trim(coalesce(p_justification, '')), ''),
    updated_at = now(),
    updated_by = p_user_id
  where id = p_id_route_stop;

  return query
  select
    trs.id::bigint as id_route_stop,
    trs.arrived_at::timestamptz as arrived_at,
    trs.arrival_photo_path::text as arrival_photo_path
  from public.trx_route_stop trs
  where trs.id = p_id_route_stop;
end;
$$;

revoke all on function public.register_route_stop_arrival(bigint, timestamptz, text, text, bigint) from public;
