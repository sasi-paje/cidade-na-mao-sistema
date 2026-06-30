-- =====================================================================
-- PROVISIONAMENTO DE TESTE — Andressa Vercosa como ADMIN (HOMOLOGAÇÃO)
-- Projeto: tfupwytzrkpzocfxheeq (TESTE/HOMOLOGAÇÃO) — NÃO usar em produção.
--
-- O QUE FAZ: garante um master_user para andressa.vercosa@sasi.com.br no
-- tenant ativo e o vincula à role 'admin', para destravar o acesso a /web/*
-- após a ponte SASI funcionar.
--
-- O QUE NÃO FAZ: não cria auth.users (id_auth_user = null → a Edge Function
-- exchange-sasi-token cria/vincula no 1º login). Não troca role existente.
--
-- COMO USAR (revisar antes de gravar):
--   1. Rode a SEÇÃO A (diagnóstico) e confira tenants/colunas/estado atual.
--   2. Ajuste a SEÇÃO B se necessário (tenant fixo / coluna is_test).
--   3. Rode a SEÇÃO B com ROLLBACK, revise os NOTICES + o resultado.
--   4. Se estiver correto, troque ROLLBACK por COMMIT e rode de novo.
-- Idempotente: reexecutar não duplica (unique (id_tenant,email) e
-- (id_user,id_tenant)).
-- =====================================================================


-- =====================================================================
-- SEÇÃO A — DIAGNÓSTICO (somente leitura; rodar primeiro)
-- =====================================================================

-- A1) Colunas de master_user (confirmar se existe 'is_test' antes do INSERT)
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'master_user'
order by ordinal_position;

-- A2) Tenants ativos (saber qual será usado; se houver >1, fixar na Seção B)
select id, name, slug, is_active, created_at
from public.master_tenant
where is_active = true
order by created_at;

-- A3) Situação atual de Andressa (0 linhas = causa do 403 no exchange)
select
  u.id as user_id, u.name, u.email, u.id_tenant,
  t.name as tenant_name, t.slug as tenant_slug,
  u.id_auth_user, u.is_active,
  r.code as role_code, r.name as role_name
from public.master_user u
join public.master_tenant t on t.id = u.id_tenant
left join public.rel_user_role rr on rr.id_user = u.id and rr.id_tenant = u.id_tenant
left join public.ref_user_role  r on r.id = rr.id_role
where lower(u.email) = lower('andressa.vercosa@sasi.com.br');


-- =====================================================================
-- SEÇÃO B — PROVISIONAMENTO (transacional; revisar antes de COMMIT)
-- =====================================================================
begin;

do $$
declare
  v_email          text := 'andressa.vercosa@sasi.com.br';
  v_name           text := 'Andressa Vercosa';
  v_tenant         uuid;
  v_active_tenants int;
  v_user           uuid;
  v_role_admin     uuid;
  v_existing_role  text;
begin
  -- (1) tenant ativo: exige EXATAMENTE um. Se houver vários, pare e fixe id/slug.
  select count(*) into v_active_tenants from public.master_tenant where is_active = true;
  if v_active_tenants = 0 then
    raise exception 'Nenhum tenant ativo. Defina o tenant manualmente.';
  elsif v_active_tenants > 1 then
    raise exception 'Há % tenants ativos. Edite o script: troque a seleção por "where slug = ''<slug>''" (ou id).', v_active_tenants;
  end if;
  select id into v_tenant from public.master_tenant where is_active = true;
  -- Alternativa (vários tenants): comente as 6 linhas acima e use:
  --   select id into v_tenant from public.master_tenant where slug = '<slug-do-tenant>';
  --   if v_tenant is null then raise exception 'Tenant <slug> não encontrado.'; end if;

  -- (2) role admin por code (nunca id fixo)
  select id into v_role_admin from public.ref_user_role where code = 'admin';
  if v_role_admin is null then
    raise exception 'Role admin (code=admin) não existe em ref_user_role.';
  end if;

  -- (3) master_user: cria só se não existir (unique (id_tenant, email))
  select id into v_user
  from public.master_user
  where id_tenant = v_tenant and lower(email) = lower(v_email);

  if v_user is null then
    insert into public.master_user (id_tenant, name, email, is_active, id_auth_user)
    values (v_tenant, v_name, v_email, true, null)
    returning id into v_user;
    raise notice 'master_user CRIADO: %', v_user;
  else
    update public.master_user set is_active = true
    where id = v_user and is_active is distinct from true;
    raise notice 'master_user já existia (reaproveitado): %', v_user;
  end if;

  -- (4) vínculo de role (unique id_user,id_tenant): só insere se não houver
  select r.code into v_existing_role
  from public.rel_user_role rr
  join public.ref_user_role r on r.id = rr.id_role
  where rr.id_user = v_user and rr.id_tenant = v_tenant;

  if v_existing_role is null then
    insert into public.rel_user_role (id_user, id_role, id_tenant)
    values (v_user, v_role_admin, v_tenant);
    raise notice 'rel_user_role CRIADO: admin';
  elsif v_existing_role = 'admin' then
    raise notice 'Usuário já é admin — nada a fazer.';
  else
    raise exception 'Usuário já tem role "%". NÃO troquei automaticamente (revise a modelagem).', v_existing_role;
  end if;
end $$;

-- Resultado (revise; se correto, troque o ROLLBACK final por COMMIT)
select
  u.id as user_id, u.name, u.email, u.id_tenant,
  t.name as tenant_name, t.slug as tenant_slug,
  u.id_auth_user, u.is_active,
  r.code as role_code, r.name as role_name
from public.master_user u
join public.master_tenant t on t.id = u.id_tenant
left join public.rel_user_role rr on rr.id_user = u.id and rr.id_tenant = u.id_tenant
left join public.ref_user_role  r on r.id = rr.id_role
where lower(u.email) = lower('andressa.vercosa@sasi.com.br');

rollback;  -- ⚠️ troque por COMMIT após revisar os NOTICES e o resultado


-- =====================================================================
-- SEÇÃO C — (OPCIONAL) LÍDER DE TESTE — preencher o e-mail e descomentar
-- =====================================================================
-- Use para validar o fluxo /m/* (community_leader). Precisa de um e-mail real
-- de teste do SASI (NÃO inventar). Substitua <EMAIL_DO_LIDER> e <NOME_DO_LIDER>.
-- Mantém a regra: 1 role por usuário/tenant; este bloco cria a role
-- 'community_leader' para OUTRO usuário (não a Andressa).
--
-- begin;
-- do $$
-- declare
--   v_email  text := '<EMAIL_DO_LIDER>';
--   v_name   text := '<NOME_DO_LIDER>';
--   v_tenant uuid;
--   v_user   uuid;
--   v_role   uuid;
--   v_existing_role text;
-- begin
--   select id into v_tenant from public.master_tenant where is_active = true;  -- fixe o slug se houver vários
--   select id into v_role   from public.ref_user_role where code = 'community_leader';
--   if v_tenant is null or v_role is null then raise exception 'tenant/role ausente'; end if;
--
--   select id into v_user from public.master_user
--   where id_tenant = v_tenant and lower(email) = lower(v_email);
--   if v_user is null then
--     insert into public.master_user (id_tenant, name, email, is_active, id_auth_user)
--     values (v_tenant, v_name, v_email, true, null) returning id into v_user;
--   end if;
--
--   select r.code into v_existing_role
--   from public.rel_user_role rr join public.ref_user_role r on r.id = rr.id_role
--   where rr.id_user = v_user and rr.id_tenant = v_tenant;
--   if v_existing_role is null then
--     insert into public.rel_user_role (id_user, id_role, id_tenant)
--     values (v_user, v_role, v_tenant);
--   elsif v_existing_role <> 'community_leader' then
--     raise exception 'Usuário já tem role "%". Não troquei.', v_existing_role;
--   end if;
-- end $$;
-- rollback;  -- troque por COMMIT após revisar
-- =====================================================================
