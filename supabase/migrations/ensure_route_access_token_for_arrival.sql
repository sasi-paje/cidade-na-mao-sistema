-- Garante a tabela usada pela Edge Function register-route-arrival.

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
