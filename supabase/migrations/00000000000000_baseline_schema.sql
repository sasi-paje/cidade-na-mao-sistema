-- =====================================================================
-- BASELINE — schema atual do domínio de eventos (Cidade na Mão)
-- Projeto de origem: tfupwytzrkpzocfxheeq  (extraído via MCP read-only, 2026-06-25)
--
-- OBJETIVO: reproduzir o schema atual em um projeto Supabase de STAGING.
-- NÃO aplicar em produção. NÃO contém dados de carga.
--
-- Conteúdo: schema public (17 tabelas, 3 views, 6 funções, 6 triggers,
--           RLS+policies atuais, grants, índices) + seed mínimo dos
--           catálogos ref_*. Estado é PRÉ-Fase-1 (funções current_* ainda
--           usam GUC; sem coluna id_auth_user). A Fase 1 (auth/RLS) é o
--           arquivo separado 202606250001_auth_rls_phase_1.sql.
--
-- EXCLUÍDO de propósito: 500 usuários sintéticos, 4000 eventos, qualquer
--           e-mail/dado real, dados de auth.users.
--
-- Ordenação: extensão -> tabelas -> FKs -> índices -> funções -> triggers
--           -> RLS/policies -> grants -> views -> seed de catálogos.
-- Idempotente onde aplicável.
-- =====================================================================

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- 1) TABELAS (colunas + PK/UNIQUE/CHECK inline; FKs adicionadas depois)
-- ---------------------------------------------------------------------

create table if not exists public.master_tenant (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint master_tenant_slug_key unique (slug)
);

create table if not exists public.master_user (
  id          uuid primary key default gen_random_uuid(),
  id_tenant   uuid not null,
  name        text not null,
  email       text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid,
  constraint master_user_id_tenant_email_key unique (id_tenant, email)
);

create table if not exists public.ref_user_role (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  name          text not null,
  description   text,
  is_active     boolean not null default true,
  display_order integer not null default 0,
  constraint ref_user_role_code_key unique (code)
);

create table if not exists public.ref_slot_status (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  name          text not null,
  description   text,
  is_active     boolean not null default true,
  display_order integer not null default 0,
  constraint ref_slot_status_code_key unique (code)
);

create table if not exists public.ref_approval_decision (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  name          text not null,
  description   text,
  is_active     boolean not null default true,
  display_order integer not null default 0,
  constraint ref_approval_decision_code_key unique (code)
);

create table if not exists public.ref_attendance_status (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  name          text not null,
  is_active     boolean not null default true,
  display_order integer not null default 0,
  constraint ref_attendance_status_code_key unique (code)
);

create table if not exists public.ref_event_status (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  name          text not null,
  description   text,
  is_active     boolean not null default true,
  display_order integer not null default 0,
  constraint ref_event_status_code_key unique (code)
);

create table if not exists public.ref_notification_type (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  name          text not null,
  description   text,
  is_active     boolean not null default true,
  display_order integer not null default 0,
  constraint ref_notification_type_code_key unique (code)
);

create table if not exists public.rel_user_role (
  id          uuid primary key default gen_random_uuid(),
  id_user     uuid not null,
  id_role     uuid not null,
  id_tenant   uuid not null,
  created_at  timestamptz not null default now(),
  constraint rel_user_role_id_user_id_tenant_key unique (id_user, id_tenant)
);

create table if not exists public.master_equipment (
  id          uuid primary key default gen_random_uuid(),
  id_tenant   uuid not null,
  name        text not null,
  description text,
  quantity    integer not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid,
  constraint master_equipment_quantity_check check (quantity > 0)
);

create table if not exists public.master_event (
  id          uuid primary key default gen_random_uuid(),
  id_tenant   uuid not null,
  id_user     uuid not null,
  title       text not null,
  description text,
  banner_url  text,
  location    text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);

create table if not exists public.trx_event_slot (
  id             uuid primary key default gen_random_uuid(),
  id_event       uuid not null,
  id_slot_status uuid not null,
  requested_at   timestamptz not null,
  approved_at    timestamptz,
  capacity       integer not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint trx_event_slot_capacity_check check (capacity > 0)
);

create table if not exists public.trx_event_equipment_request (
  id           uuid primary key default gen_random_uuid(),
  id_event     uuid not null,
  id_equipment uuid not null,
  quantity     integer not null,
  is_approved  boolean,
  note         text,
  created_at   timestamptz not null default now(),
  constraint trx_event_equipment_request_id_event_id_equipment_key unique (id_event, id_equipment),
  constraint trx_event_equipment_request_quantity_check check (quantity > 0)
);

create table if not exists public.trx_event_approval (
  id             uuid primary key default gen_random_uuid(),
  id_event       uuid not null,
  id_slot        uuid,
  id_reviewed_by uuid not null,
  id_decision    uuid not null,
  reason         text,
  counter_date   timestamptz,
  reviewed_at    timestamptz not null default now()
);

create table if not exists public.trx_event_attendance (
  id                   uuid primary key default gen_random_uuid(),
  id_event             uuid not null,
  id_slot              uuid not null,
  id_user              uuid not null,
  id_attendance_status uuid not null,
  confirmed_at         timestamptz not null default now(),
  constraint trx_event_attendance_id_slot_id_user_key unique (id_slot, id_user)
);

create table if not exists public.trx_equipment_availability (
  id           uuid primary key default gen_random_uuid(),
  id_equipment uuid not null,
  id_event     uuid not null,
  id_slot      uuid not null,
  quantity_used integer not null,
  allocated_at timestamptz not null,
  released_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint trx_equipment_availability_quantity_used_check check (quantity_used > 0)
);

create table if not exists public.trx_event_notification (
  id                   uuid primary key default gen_random_uuid(),
  id_event             uuid not null,
  id_user              uuid not null,
  id_notification_type uuid not null,
  message              text not null,
  is_read              boolean not null default false,
  sent_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) FOREIGN KEYS (tabelas já existem acima) — idempotente
-- ---------------------------------------------------------------------
do $$
begin
  -- master_user (self refs + tenant)
  alter table public.master_user add constraint master_user_id_tenant_fkey foreign key (id_tenant) references public.master_tenant(id) on delete cascade;
  alter table public.master_user add constraint master_user_created_by_fkey foreign key (created_by) references public.master_user(id);
  alter table public.master_user add constraint master_user_updated_by_fkey foreign key (updated_by) references public.master_user(id);
  -- rel_user_role
  alter table public.rel_user_role add constraint rel_user_role_id_user_fkey   foreign key (id_user)   references public.master_user(id) on delete cascade;
  alter table public.rel_user_role add constraint rel_user_role_id_role_fkey   foreign key (id_role)   references public.ref_user_role(id);
  alter table public.rel_user_role add constraint rel_user_role_id_tenant_fkey foreign key (id_tenant) references public.master_tenant(id) on delete cascade;
  -- master_equipment
  alter table public.master_equipment add constraint master_equipment_id_tenant_fkey  foreign key (id_tenant)  references public.master_tenant(id) on delete cascade;
  alter table public.master_equipment add constraint master_equipment_created_by_fkey foreign key (created_by) references public.master_user(id);
  alter table public.master_equipment add constraint master_equipment_updated_by_fkey foreign key (updated_by) references public.master_user(id);
  -- master_event
  alter table public.master_event add constraint master_event_id_tenant_fkey  foreign key (id_tenant)  references public.master_tenant(id) on delete cascade;
  alter table public.master_event add constraint master_event_id_user_fkey    foreign key (id_user)    references public.master_user(id);
  alter table public.master_event add constraint master_event_created_by_fkey foreign key (created_by) references public.master_user(id);
  alter table public.master_event add constraint master_event_updated_by_fkey foreign key (updated_by) references public.master_user(id);
  -- trx_event_slot
  alter table public.trx_event_slot add constraint trx_event_slot_id_event_fkey       foreign key (id_event)       references public.master_event(id) on delete cascade;
  alter table public.trx_event_slot add constraint trx_event_slot_id_slot_status_fkey foreign key (id_slot_status) references public.ref_slot_status(id);
  -- trx_event_equipment_request
  alter table public.trx_event_equipment_request add constraint trx_event_equipment_request_id_event_fkey     foreign key (id_event)     references public.master_event(id) on delete cascade;
  alter table public.trx_event_equipment_request add constraint trx_event_equipment_request_id_equipment_fkey foreign key (id_equipment) references public.master_equipment(id);
  -- trx_event_approval
  alter table public.trx_event_approval add constraint trx_event_approval_id_event_fkey       foreign key (id_event)       references public.master_event(id) on delete cascade;
  alter table public.trx_event_approval add constraint trx_event_approval_id_slot_fkey        foreign key (id_slot)        references public.trx_event_slot(id);
  alter table public.trx_event_approval add constraint trx_event_approval_id_reviewed_by_fkey foreign key (id_reviewed_by) references public.master_user(id);
  alter table public.trx_event_approval add constraint trx_event_approval_id_decision_fkey    foreign key (id_decision)    references public.ref_approval_decision(id);
  -- trx_event_attendance
  alter table public.trx_event_attendance add constraint trx_event_attendance_id_event_fkey             foreign key (id_event)             references public.master_event(id) on delete cascade;
  alter table public.trx_event_attendance add constraint trx_event_attendance_id_slot_fkey              foreign key (id_slot)              references public.trx_event_slot(id) on delete cascade;
  alter table public.trx_event_attendance add constraint trx_event_attendance_id_user_fkey              foreign key (id_user)              references public.master_user(id) on delete cascade;
  alter table public.trx_event_attendance add constraint trx_event_attendance_id_attendance_status_fkey foreign key (id_attendance_status) references public.ref_attendance_status(id);
  -- trx_equipment_availability
  alter table public.trx_equipment_availability add constraint trx_equipment_availability_id_equipment_fkey foreign key (id_equipment) references public.master_equipment(id) on delete cascade;
  alter table public.trx_equipment_availability add constraint trx_equipment_availability_id_event_fkey     foreign key (id_event)     references public.master_event(id) on delete cascade;
  alter table public.trx_equipment_availability add constraint trx_equipment_availability_id_slot_fkey      foreign key (id_slot)      references public.trx_event_slot(id) on delete cascade;
  -- trx_event_notification
  alter table public.trx_event_notification add constraint trx_event_notification_id_event_fkey             foreign key (id_event)             references public.master_event(id) on delete cascade;
  alter table public.trx_event_notification add constraint trx_event_notification_id_user_fkey              foreign key (id_user)              references public.master_user(id) on delete cascade;
  alter table public.trx_event_notification add constraint trx_event_notification_id_notification_type_fkey foreign key (id_notification_type) references public.ref_notification_type(id);
exception when duplicate_object then null;  -- já aplicado
end $$;

-- ---------------------------------------------------------------------
-- 3) ÍNDICES (não-constraint)
-- ---------------------------------------------------------------------
create index if not exists idx_master_user_tenant                   on public.master_user (id_tenant);
create index if not exists idx_master_equipment_tenant              on public.master_equipment (id_tenant);
create index if not exists idx_master_event_tenant                  on public.master_event (id_tenant);
create index if not exists idx_master_event_user                    on public.master_event (id_user);
create index if not exists idx_rel_user_role_tenant                 on public.rel_user_role (id_tenant);
create index if not exists idx_rel_user_role_user                   on public.rel_user_role (id_user);
create index if not exists idx_trx_event_slot_event                 on public.trx_event_slot (id_event);
create index if not exists idx_trx_event_equipment_request_event    on public.trx_event_equipment_request (id_event);
create index if not exists idx_trx_event_equipment_request_equipment on public.trx_event_equipment_request (id_equipment);
create index if not exists idx_trx_event_approval_event             on public.trx_event_approval (id_event);
create index if not exists idx_trx_event_approval_reviewer          on public.trx_event_approval (id_reviewed_by);
create index if not exists idx_trx_event_attendance_event           on public.trx_event_attendance (id_event);
create index if not exists idx_trx_event_attendance_slot            on public.trx_event_attendance (id_slot);
create index if not exists idx_trx_event_attendance_user            on public.trx_event_attendance (id_user);
create index if not exists idx_trx_equipment_availability_equipment on public.trx_equipment_availability (id_equipment);
create index if not exists idx_trx_equipment_availability_slot      on public.trx_equipment_availability (id_slot);
create index if not exists idx_trx_equipment_availability_date      on public.trx_equipment_availability (allocated_at, released_at);
create index if not exists idx_trx_event_notification_event         on public.trx_event_notification (id_event);
create index if not exists idx_trx_event_notification_user          on public.trx_event_notification (id_user, is_read);

-- ---------------------------------------------------------------------
-- 4) FUNÇÕES (estado ATUAL — GUC; a Fase 1 reescreve as current_*)
-- ---------------------------------------------------------------------
create or replace function public.current_user_id()
  returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

create or replace function public.current_tenant_id()
  returns uuid language sql stable as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid;
$$;

create or replace function public.current_user_role()
  returns text language sql stable as $$
  select r.code
  from public.rel_user_role ur
  join public.ref_user_role r on r.id = ur.id_role
  where ur.id_user   = public.current_user_id()
    and ur.id_tenant = public.current_tenant_id()
  limit 1;
$$;

create or replace function public.fn_approval_decision_code(p_id uuid)
  returns text language sql stable as $$
  select code from public.ref_approval_decision where id = p_id;
$$;

create or replace function public.fn_set_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.fn_validate_event_approval()
  returns trigger language plpgsql as $$
declare
  v_decision_code text;
begin
  select code into v_decision_code from public.ref_approval_decision where id = new.id_decision;
  if v_decision_code in ('rejected', 'counter_proposed') and new.reason is null then
    raise exception 'reason é obrigatório quando a decisão é "%"', v_decision_code;
  end if;
  if v_decision_code = 'counter_proposed' and new.counter_date is null then
    raise exception 'counter_date é obrigatório quando a decisão é "counter_proposed"';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) TRIGGERS
-- ---------------------------------------------------------------------
drop trigger if exists trg_master_tenant_updated_at    on public.master_tenant;
create trigger trg_master_tenant_updated_at    before update on public.master_tenant    for each row execute function public.fn_set_updated_at();
drop trigger if exists trg_master_user_updated_at      on public.master_user;
create trigger trg_master_user_updated_at      before update on public.master_user      for each row execute function public.fn_set_updated_at();
drop trigger if exists trg_master_equipment_updated_at on public.master_equipment;
create trigger trg_master_equipment_updated_at before update on public.master_equipment for each row execute function public.fn_set_updated_at();
drop trigger if exists trg_master_event_updated_at     on public.master_event;
create trigger trg_master_event_updated_at     before update on public.master_event     for each row execute function public.fn_set_updated_at();
drop trigger if exists trg_trx_event_slot_updated_at   on public.trx_event_slot;
create trigger trg_trx_event_slot_updated_at   before update on public.trx_event_slot   for each row execute function public.fn_set_updated_at();
drop trigger if exists trg_validate_event_approval     on public.trx_event_approval;
create trigger trg_validate_event_approval     before insert or update on public.trx_event_approval for each row execute function public.fn_validate_event_approval();

-- ---------------------------------------------------------------------
-- 6) RLS — habilitar em todas as tabelas
--    (ref_* ficam SEM policy = trancadas, igual ao estado atual.
--     A leitura authenticated dos ref_* é adicionada na Fase 1/M3.)
-- ---------------------------------------------------------------------
alter table public.master_tenant               enable row level security;
alter table public.master_user                 enable row level security;
alter table public.ref_user_role               enable row level security;
alter table public.ref_slot_status             enable row level security;
alter table public.ref_approval_decision       enable row level security;
alter table public.ref_attendance_status       enable row level security;
alter table public.ref_event_status            enable row level security;
alter table public.ref_notification_type       enable row level security;
alter table public.rel_user_role               enable row level security;
alter table public.master_equipment            enable row level security;
alter table public.master_event                enable row level security;
alter table public.trx_event_slot              enable row level security;
alter table public.trx_event_equipment_request enable row level security;
alter table public.trx_event_approval          enable row level security;
alter table public.trx_event_attendance        enable row level security;
alter table public.trx_equipment_availability  enable row level security;
alter table public.trx_event_notification      enable row level security;

-- ---------------------------------------------------------------------
-- 7) POLICIES (estado atual; role PUBLIC; dependem das funções de contexto)
-- ---------------------------------------------------------------------
-- master_tenant
drop policy if exists tenant_select on public.master_tenant;
create policy tenant_select on public.master_tenant for select using (id = public.current_tenant_id());

-- master_user
drop policy if exists user_select on public.master_user;
create policy user_select on public.master_user for select using (id_tenant = public.current_tenant_id());
drop policy if exists user_insert on public.master_user;
create policy user_insert on public.master_user for insert with check ((id_tenant = public.current_tenant_id()) and (public.current_user_role() = 'admin'));
drop policy if exists user_update on public.master_user;
create policy user_update on public.master_user for update using ((id_tenant = public.current_tenant_id()) and (public.current_user_role() = 'admin'));

-- rel_user_role
drop policy if exists rel_user_role_select on public.rel_user_role;
create policy rel_user_role_select on public.rel_user_role for select using (id_tenant = public.current_tenant_id());
drop policy if exists rel_user_role_insert on public.rel_user_role;
create policy rel_user_role_insert on public.rel_user_role for insert with check ((id_tenant = public.current_tenant_id()) and (public.current_user_role() = 'admin'));

-- master_equipment
drop policy if exists equipment_catalog_select on public.master_equipment;
create policy equipment_catalog_select on public.master_equipment for select using (id_tenant = public.current_tenant_id());
drop policy if exists equipment_catalog_insert on public.master_equipment;
create policy equipment_catalog_insert on public.master_equipment for insert with check ((id_tenant = public.current_tenant_id()) and (public.current_user_role() = 'admin'));
drop policy if exists equipment_catalog_update on public.master_equipment;
create policy equipment_catalog_update on public.master_equipment for update using ((id_tenant = public.current_tenant_id()) and (public.current_user_role() = 'admin'));
drop policy if exists equipment_catalog_delete on public.master_equipment;
create policy equipment_catalog_delete on public.master_equipment for delete using ((id_tenant = public.current_tenant_id()) and (public.current_user_role() = 'admin'));

-- master_event
drop policy if exists event_select on public.master_event;
create policy event_select on public.master_event for select using (
  (id_tenant = public.current_tenant_id())
  and ((public.current_user_role() = 'admin') or (id_user = public.current_user_id())));
drop policy if exists event_insert on public.master_event;
create policy event_insert on public.master_event for insert with check (
  (id_tenant = public.current_tenant_id())
  and (public.current_user_role() = any (array['admin','community_leader'])));
drop policy if exists event_update on public.master_event;
create policy event_update on public.master_event for update using (
  (id_tenant = public.current_tenant_id())
  and ((public.current_user_role() = 'admin')
       or ((id_user = public.current_user_id())
           and exists (select 1 from public.trx_event_slot s
                       join public.ref_slot_status ss on ss.id = s.id_slot_status
                       where s.id_event = master_event.id
                         and ss.code = any (array['draft','inactive'])
                       limit 1))));
drop policy if exists event_delete on public.master_event;
create policy event_delete on public.master_event for delete using (
  (id_tenant = public.current_tenant_id()) and (public.current_user_role() = 'admin'));

-- trx_event_slot
drop policy if exists slot_select on public.trx_event_slot;
create policy slot_select on public.trx_event_slot for select using (
  exists (select 1 from public.master_event e
          where e.id = trx_event_slot.id_event and e.id_tenant = public.current_tenant_id()
            and (e.id_user = public.current_user_id() or public.current_user_role() = 'admin')));
drop policy if exists slot_insert on public.trx_event_slot;
create policy slot_insert on public.trx_event_slot for insert with check (
  exists (select 1 from public.master_event e
          where e.id = trx_event_slot.id_event and e.id_tenant = public.current_tenant_id()
            and (e.id_user = public.current_user_id() or public.current_user_role() = 'admin')));
drop policy if exists slot_update on public.trx_event_slot;
create policy slot_update on public.trx_event_slot for update using (
  exists (select 1 from public.master_event e
          where e.id = trx_event_slot.id_event and e.id_tenant = public.current_tenant_id()
            and (e.id_user = public.current_user_id() or public.current_user_role() = 'admin')));

-- trx_event_equipment_request
drop policy if exists equipment_request_select on public.trx_event_equipment_request;
create policy equipment_request_select on public.trx_event_equipment_request for select using (
  exists (select 1 from public.master_event e
          where e.id = trx_event_equipment_request.id_event and e.id_tenant = public.current_tenant_id()
            and (e.id_user = public.current_user_id() or public.current_user_role() = 'admin')));
drop policy if exists equipment_request_insert on public.trx_event_equipment_request;
create policy equipment_request_insert on public.trx_event_equipment_request for insert with check (
  exists (select 1 from public.master_event e
          where e.id = trx_event_equipment_request.id_event and e.id_tenant = public.current_tenant_id()
            and (e.id_user = public.current_user_id() or public.current_user_role() = 'admin')));
drop policy if exists equipment_request_update on public.trx_event_equipment_request;
create policy equipment_request_update on public.trx_event_equipment_request for update using (
  (public.current_user_role() = 'admin')
  and exists (select 1 from public.master_event e
              where e.id = trx_event_equipment_request.id_event and e.id_tenant = public.current_tenant_id()));

-- trx_event_approval
drop policy if exists approval_select on public.trx_event_approval;
create policy approval_select on public.trx_event_approval for select using (
  exists (select 1 from public.master_event e
          where e.id = trx_event_approval.id_event and e.id_tenant = public.current_tenant_id()
            and (e.id_user = public.current_user_id() or public.current_user_role() = 'admin')));
drop policy if exists approval_insert on public.trx_event_approval;
create policy approval_insert on public.trx_event_approval for insert with check (
  (public.current_user_role() = 'admin')
  and exists (select 1 from public.master_event e
              where e.id = trx_event_approval.id_event and e.id_tenant = public.current_tenant_id()));

-- trx_event_attendance
drop policy if exists attendance_select on public.trx_event_attendance;
create policy attendance_select on public.trx_event_attendance for select using (
  exists (select 1 from public.master_event e
          where e.id = trx_event_attendance.id_event and e.id_tenant = public.current_tenant_id()));
drop policy if exists attendance_insert on public.trx_event_attendance;
create policy attendance_insert on public.trx_event_attendance for insert with check (
  (id_user = public.current_user_id())
  and exists (select 1 from public.master_event e
              where e.id = trx_event_attendance.id_event and e.id_tenant = public.current_tenant_id()));
drop policy if exists attendance_update on public.trx_event_attendance;
create policy attendance_update on public.trx_event_attendance for update using (id_user = public.current_user_id());

-- trx_equipment_availability
drop policy if exists equipment_availability_select on public.trx_equipment_availability;
create policy equipment_availability_select on public.trx_equipment_availability for select using (
  exists (select 1 from public.master_equipment eq
          where eq.id = trx_equipment_availability.id_equipment and eq.id_tenant = public.current_tenant_id()));
drop policy if exists equipment_availability_insert on public.trx_equipment_availability;
create policy equipment_availability_insert on public.trx_equipment_availability for insert with check (
  (public.current_user_role() = 'admin')
  and exists (select 1 from public.master_equipment eq
              where eq.id = trx_equipment_availability.id_equipment and eq.id_tenant = public.current_tenant_id()));
drop policy if exists equipment_availability_update on public.trx_equipment_availability;
create policy equipment_availability_update on public.trx_equipment_availability for update using (
  (public.current_user_role() = 'admin')
  and exists (select 1 from public.master_equipment eq
              where eq.id = trx_equipment_availability.id_equipment and eq.id_tenant = public.current_tenant_id()));

-- trx_event_notification
drop policy if exists notification_select on public.trx_event_notification;
create policy notification_select on public.trx_event_notification for select using (id_user = public.current_user_id());
drop policy if exists notification_update on public.trx_event_notification;
create policy notification_update on public.trx_event_notification for update using (id_user = public.current_user_id());

-- ---------------------------------------------------------------------
-- 8) GRANTS (acesso governado por RLS; replica o ACL atual)
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public    to anon, authenticated, service_role;
grant all on all routines in schema public  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 9) VIEWS (estado atual: SECURITY DEFINER, sem filtro de tenant.
--    A correção de vazamento entre tenants é tratada na Fase M4.)
-- ---------------------------------------------------------------------
create or replace view public.v_master_event_full as
  select e.id, e.id_tenant, e.title, e.description, e.banner_url, e.location, e.is_active,
         e.id_user, u.name as creator_name, r.code as creator_role,
         s.id as id_slot, s.requested_at, s.approved_at, s.capacity, ss.code as slot_status,
         e.created_at, e.updated_at
  from public.master_event e
  join public.master_user u    on u.id = e.id_user
  join public.rel_user_role ur on ur.id_user = u.id and ur.id_tenant = e.id_tenant
  join public.ref_user_role r  on r.id = ur.id_role
  left join public.trx_event_slot s   on s.id_event = e.id
  left join public.ref_slot_status ss on ss.id = s.id_slot_status
       and ss.code = any (array['pending','approved','counter_proposed']);

create or replace view public.v_trx_slot_attendance_count as
  select a.id_slot, a.id_event,
         count(*) filter (where (select code from public.ref_attendance_status where id = a.id_attendance_status) = 'confirmed') as confirmed_count,
         count(*) filter (where (select code from public.ref_attendance_status where id = a.id_attendance_status) = 'cancelled') as cancelled_count
  from public.trx_event_attendance a
  group by a.id_slot, a.id_event;

create or replace view public.v_master_equipment_availability as
  select eq.id as id_equipment, eq.id_tenant, eq.name as equipment_name, eq.quantity as total_quantity,
         a.allocated_at, a.released_at,
         coalesce(sum(a.quantity_used), 0::bigint) as quantity_in_use,
         eq.quantity - coalesce(sum(a.quantity_used), 0::bigint) as quantity_available
  from public.master_equipment eq
  left join public.trx_equipment_availability a on a.id_equipment = eq.id and a.released_at is null
  group by eq.id, eq.id_tenant, eq.name, eq.quantity, a.allocated_at, a.released_at;

grant select on public.v_master_event_full, public.v_trx_slot_attendance_count, public.v_master_equipment_availability
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 10) SEED — catálogos ref_* (sem dados de carga). Idempotente por code.
-- ---------------------------------------------------------------------
insert into public.ref_user_role (code, name, description, display_order) values
  ('admin','Administrador','Gerencia e aprova eventos',1),
  ('community_leader','Líder comunitário','Solicita e acompanha eventos',2)
on conflict (code) do nothing;

insert into public.ref_slot_status (code, name, description, display_order) values
  ('pending','Pendente','Aguardando análise do admin',1),
  ('approved','Aprovado','Slot confirmado',2),
  ('counter_proposed','Contraproposta','Admin propôs outra data/hora',3),
  ('rejected','Rejeitado','Slot rejeitado',4),
  ('inactive','Inativo','Líder não aceitou a contraproposta',5)
on conflict (code) do nothing;

insert into public.ref_approval_decision (code, name, description, display_order) values
  ('approved','Aprovado','Aprovado como solicitado',1),
  ('counter_proposed','Contraproposta','Aprovado com outra data/hora',2),
  ('rejected','Reprovado','Solicitação reprovada',3)
on conflict (code) do nothing;

insert into public.ref_attendance_status (code, name, display_order) values
  ('confirmed','Confirmado',1),
  ('cancelled','Cancelado',2)
on conflict (code) do nothing;

insert into public.ref_event_status (code, name, description, display_order) values
  ('draft','Rascunho','Evento criado, não enviado para aprovação',1),
  ('pending_approval','Aguardando aprovação','Solicitação enviada, aguardando admin',2),
  ('approved','Aprovado','Evento aprovado com slot confirmado',3),
  ('counter_proposed','Contraproposta','Admin aprovou com outra data/hora',4),
  ('rejected','Reprovado','Admin reprovou a solicitação',5),
  ('inactive','Inativo','Líder não aceitou a contraproposta',6),
  ('cancelled','Cancelado','Evento cancelado definitivamente',7)
on conflict (code) do nothing;

insert into public.ref_notification_type (code, name, description, display_order) values
  ('approval_requested','Solicitação recebida','Admin recebe: líder enviou evento',1),
  ('approved','Evento aprovado','Líder recebe: evento aprovado',2),
  ('counter_proposed','Contraproposta','Líder recebe: admin propôs outra data',3),
  ('rejected','Evento reprovado','Líder recebe: evento reprovado',4),
  ('reactivated','Evento reativado','Admin recebe: líder reativou evento',5),
  ('leader_declined','Líder recusou proposta','Admin recebe: líder recusou contraproposta',6)
on conflict (code) do nothing;

-- =====================================================================
-- FIM DO BASELINE. Aplicar SOMENTE em staging. Depois aplicar
-- 202606250001_auth_rls_phase_1.sql por cima.
-- =====================================================================
