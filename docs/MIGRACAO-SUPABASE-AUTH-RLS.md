# Migração — Supabase Auth + RLS + RPCs transacionais

> **Status: PROPOSTA / REVISÃO. Nada aqui foi executado no banco.**
> Documento de planejamento para sair do mock/localStorage e ligar o app ao
> Supabase Auth com RLS por tenant e escrita via RPC transacional.
> Projeto: `tfupwytzrkpzocfxheeq`. Base auditada via MCP em 2026-06-25
> (ver [RELATORIO-CIDADE-NA-MAO.md](./RELATORIO-CIDADE-NA-MAO.md) e
> [MIGRACAO-CIDADE-NA-MAO.md](./MIGRACAO-CIDADE-NA-MAO.md)).

---

## ⚠️ Prontidão para produção (2026-06-27)

**Status atual: 🔴 NÃO PRONTO PARA PRODUÇÃO.** Relatório completo em
[RELATORIO-PRONTIDAO-PRODUCAO.md](./RELATORIO-PRONTIDAO-PRODUCAO.md).

As fases concluídas aqui (Fase 1 auth/RLS, M4 views, M5 bloco admin) estão validadas em
**homologação**, mas ainda **não habilitam produção**. Motivos principais:
- faltam RPCs do bloco **M5-B** (`create_event_request`, `accept_counter_date`, `reject_counter_date`, `confirm_attendance`, `cancel_attendance`) — ver esqueletos na seção 7;
- líder/público ainda **escrevem em mock/localStorage**;
- a **ponte SASI não foi validada em runtime real** (secret `SASI_API_URL` ausente → `500`);
- falta **banco de produção limpo** (ambiente atual é homologação, `auth.users`=0, ~500 `@loadtest.com`);
- faltam **tenant/admin/líder reais**;
- o **fallback mock precisa ser desativado em produção** (fail-closed).

### Integração SASI Mobile (planejada)

Plano de reconciliação da ponte SASI em
[INTEGRACAO-SASI-MOBILE.md](./INTEGRACAO-SASI-MOBILE.md): passar a identificar o usuário pelo
`profile.id` do SASI (`webclient.sasi.com.br` → `/v2/public/auth/refresh` → `/v2/profile/self`),
vinculando `master_user.id_sasi_profile`, mas **mantendo a emissão de sessão Supabase real** —
`current_user_id()/current_tenant_id()/current_user_role()` e o RLS **não mudam**. **Planejado,
ainda não implementado.** Depende de confirmação externa com o SASI: (1) se `/v2/profile/self`
retorna e-mail; (2) se `profile.id` é estável e único; (3) se `https://webclient.sasi.com.br` é
o endpoint oficial; (4) se cada usuário SASI pertence a exatamente um tenant. A migration
`master_user.id_sasi_profile` **não será criada** até confirmar o item 1.

As perguntas oficiais para a equipe SASI foram registradas em
[INTEGRACAO-SASI-MOBILE.md](./INTEGRACAO-SASI-MOBILE.md), seções 14 e 15. A implementação por
`profile.id` segue bloqueada até o retorno dessas respostas.

**Boundary global + captura `?token=` (frontend) — implementado em 2026-06-27** (ver
[INTEGRACAO-SASI-MOBILE.md](./INTEGRACAO-SASI-MOBILE.md) §17): `?token=<TOKEN_SASI>` agora é
suportado tanto em `/m/*` quanto em `/web/*` por um `SasiSessionBoundary` global (mount único em
`main.tsx`). O token é **apenas ponte** para a sessão Supabase; a autorização continua por
Supabase Auth + RLS + roles (`auth.uid()`/`current_user_id()`/`current_tenant_id()`/
`current_user_role()`). Token só em `sessionStorage`, limpo após `verifyOtp`. A edge function
passou a aceitar `{ token?, refreshToken? }` (caminho `refreshToken`/`profile.id` **gated** com
`501` até a confirmação SASI; **não redeployada**). Validação local: typecheck/build ✓, 151
testes ✓, lint sem erro novo. Sessão real não validada (sem token real + secret ausente).

**Habilitar `?token=` em runtime (2026-06-28) — BLOQUEADO** (ver
[INTEGRACAO-SASI-MOBILE.md](./INTEGRACAO-SASI-MOBILE.md) §18): o caminho `{ token }` usa
`SASI_API_URL` + `GET /api/v2/providers/external/me`. **Secret PENDENTE** e **redeploy PENDENTE**
— sem `supabase` CLI/MCP nesta sessão; smoke com token real não executado. Edge function
deployada ainda em `500`. Script de deploy (`scripts/supabase/deploy-exchange-sasi-token.ps1`) e
checklist [SMOKE-SASI-TOKEN.md](./SMOKE-SASI-TOKEN.md) **preparados** para o ambiente com CLI.

---

## 1. Diagnóstico resumido

### Situação atual (confirmada via MCP)
- `master_user` (500 linhas) **não tem** ligação com `auth.users`; **não existe** `id_auth_user`; `master_user.id` **não** é FK de `auth.users`.
- `auth.users` está **vazia (0)**. Os 500 usuários são carga sintética (`@loadtest.com`).
- `current_user_id()` / `current_tenant_id()` leem `current_setting('app.user_id'|'app.tenant_id')` (GUC). `current_user_role()` resolve via `rel_user_role`+`ref_user_role` por `id_user`+`id_tenant`.
- **Todas** as policies das tabelas-base usam essas funções GUC (role `{public}`). Sem GUC setado → anon/authenticated não enxergam nada.
- `ref_*` (slot_status, approval_decision, attendance_status, user_role) têm **RLS ligada e 0 policies** → trancadas; isso também quebra `current_user_role()` (invoker) para `authenticated`.
- Views `v_master_event_full`, `v_trx_slot_attendance_count`, `v_master_equipment_availability` são **`SECURITY DEFINER`** e **não filtram tenant** → vazam dados entre tenants.
- **Não existem** RPCs de fluxo. Papéis reais: `admin`, `community_leader` (não há `public`).

### Por que `set_config` não serve no frontend
- `set_config('app.x', v, true)` é **transação-local**: morre ao fim da transação. O PostgREST roda **cada request numa transação própria**; um “SET” feito em request separado não sobrevive.
- `set_config('app.x', v, false)` é **sessão/conexão**: persiste na conexão — mas o PostgREST usa **pool compartilhado**, então o valor **vaza para outros usuários** na mesma conexão (falha de segurança + não-determinismo).
- Conclusão: o cliente **não pode** setar `app.*` de forma confiável e segura entre requests.

### Por que o bridge é necessário
A identidade do banco (`master_user.id`) está **desconectada** do Supabase Auth (`auth.uid()`). Sem um vínculo, o banco não consegue saber “quem é o usuário logado” a partir do JWT — e RLS/RPC dependem disso.

### Por que **não** usar `master_user.id = auth.users.id`
`master_user.id` já é **PK referenciada por muitas FKs** (`master_event.id_user`, `created_by`/`updated_by`, `rel_user_role.id_user`, `trx_event_*`, etc.) e existem 500 linhas. Trocar a PK para igualar `auth.users.id` é **destrutivo e arriscado** (reescrita em cascata, risco de quebra de integridade).

### Por que adicionar `id_auth_user`
É **aditivo e reversível**: nova coluna `nullable` com `UNIQUE` parcial + FK para `auth.users(id)`. Não toca a PK, não quebra dados existentes, e cada usuário real passa a ter seu vínculo de Auth quando logar/for provisionado.

---

## 2. Decisões pendentes (aprovar ANTES de executar)

| # | Decisão | Opções | Preferência registrada |
|---|---|---|---|
| **A** | Criar o **primeiro admin real** | (1) Criar Auth user no painel + `UPDATE master_user ... id_auth_user` manual; (2) signup com metadados | **(1) manual** |
| **B** | **Tenant inicial** no cadastro | (1) tenant fixo default (ex. um `master_tenant` real); (2) por slug/subdomínio; (3) escolhido no provisionamento | a definir |
| **C** | Provisionar **líder comunitário** | (1) admin cria+vincula; (2) signup + aprovação; (3) trigger automático | começar **manual**, automatizar depois |
| **D** | **Público** precisa login? `/m/eventos` anônimo? | (1) anônimo via view pública; (2) exige login | a definir (impacta M4) |
| **E** | Role `public` | (1) criar role `public` em `ref_user_role`; (2) tratar “sem role” como público | a definir |
| **F** | 500 usuários sintéticos | (1) descartar (limpar); (2) manter como teste; (3) ligar alguns a Auth | a definir |
| **G** | Views públicas | (1) anon vê só `approved`+`is_active` via view dedicada; (2) tudo exige login | a definir (impacta M4/M6) |

> **Bloqueio:** A, B, D, E, G precisam estar definidas antes da Fase 1/Fase 3 abaixo.

---

## 3. Migration M1 — Bridge de identidade

```sql
-- M1: vínculo master_user -> auth.users (aditivo, não destrutivo)
alter table public.master_user
  add column if not exists id_auth_user uuid;

comment on column public.master_user.id_auth_user is
  'Vínculo com auth.users(id) do Supabase Auth. NULL = usuário ainda não provisionado para login. Preenchido no provisionamento/primeiro login.';

-- UNIQUE parcial: permite vários NULL, garante 1:1 quando preenchido
create unique index if not exists ux_master_user_id_auth_user
  on public.master_user (id_auth_user)
  where id_auth_user is not null;

-- FK para auth.users; ON DELETE SET NULL preserva o master_user se o auth user sumir
alter table public.master_user
  add constraint fk_master_user_auth_user
  foreign key (id_auth_user)
  references auth.users (id)
  on delete set null;
```

**Notas de validação:**
- `UNIQUE` comum não pode ser parcial → usamos **índice único parcial** (correto).
- `ON DELETE SET NULL` evita apagar perfis/histórico se um auth user for removido.
- Idempotente (`if not exists`). FK: se rodar 2×, a 2ª falha por duplicidade do constraint — envolver em `do $$ ... exception when duplicate_object then null; end $$;` se quiser reexecutável.

---

## 4. Migration M2 — Funções de contexto com `auth.uid()`

> Mantêm **nome e assinatura** (sem args; retornos `uuid/uuid/text`) → policies existentes continuam válidas. Passam a `SECURITY DEFINER` para não depender de RLS nas tabelas internas (resolve o bloqueio de `ref_user_role`).

```sql
-- M2: current_user_id() — master_user.id do usuário autenticado
create or replace function public.current_user_id()
  returns uuid
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select mu.id
  from public.master_user mu
  where mu.id_auth_user = auth.uid()
    and mu.is_active = true
  limit 1;
$$;

-- M2: current_tenant_id() — tenant do usuário autenticado
create or replace function public.current_tenant_id()
  returns uuid
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select mu.id_tenant
  from public.master_user mu
  where mu.id_auth_user = auth.uid()
    and mu.is_active = true
  limit 1;
$$;

-- M2: current_user_role() — code do papel no tenant atual
create or replace function public.current_user_role()
  returns text
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select r.code
  from public.master_user mu
  join public.rel_user_role ur on ur.id_user = mu.id and ur.id_tenant = mu.id_tenant
  join public.ref_user_role r on r.id = ur.id_role
  where mu.id_auth_user = auth.uid()
    and mu.is_active = true
  limit 1;
$$;

-- Garantir que authenticated/anon possam EXECUTAR (execute em funções já costuma ser public,
-- mas deixamos explícito):
grant execute on function public.current_user_id()    to anon, authenticated;
grant execute on function public.current_tenant_id()  to anon, authenticated;
grant execute on function public.current_user_role()  to anon, authenticated;
```

**Requisitos atendidos:** usa `auth.uid()`; resolve `master_user` por `id_auth_user`; tenant por `master_user.id_tenant`; role por `rel_user_role`+`ref_user_role`; `security definer` + `search_path` fixo; não autenticado → `auth.uid()` é null → retorna `null`.

> ⚠️ `SECURITY DEFINER` exige `search_path` fixo (feito) e dono confiável (postgres). Sem isso, é vetor de ataque.

---

## 5. Migration M3 — Policies dos catálogos `ref_*`

```sql
-- M3: catálogos globais legíveis por usuários logados (e opcionalmente anon)
-- SELECT para authenticated em todos os ref_* de evento
create policy ref_slot_status_select        on public.ref_slot_status        for select to authenticated using (true);
create policy ref_approval_decision_select  on public.ref_approval_decision  for select to authenticated using (true);
create policy ref_attendance_status_select  on public.ref_attendance_status  for select to authenticated using (true);
create policy ref_user_role_select          on public.ref_user_role          for select to authenticated using (true);

-- OPCIONAL (decisão D/G): se /m/eventos anônimo precisar dos rótulos de status:
-- create policy ref_slot_status_select_anon on public.ref_slot_status for select to anon using (true);
```

**Requisitos:** SELECT liberado a `authenticated`; **sem** INSERT/UPDATE/DELETE (continuam sem policy → bloqueados, exceto service_role). `ref_user_role` legível permite o front montar telas de papel. Catálogos são globais (não têm tenant) → `using (true)` é seguro para leitura.

> Nota: como `current_user_role()` virou `SECURITY DEFINER` (M2), ela já lê `ref_user_role` sem depender dessas policies. M3 é para leitura **direta** pelo frontend.

---

## 6. Migration M4 — Views seguras por tenant

Hoje as 3 views são `DEFINER` e **vazam todos os tenants**. Duas opções:

### Opção A — `security_invoker = on` (recomendada para uso autenticado)
```sql
alter view public.v_master_event_full            set (security_invoker = on);
alter view public.v_trx_slot_attendance_count    set (security_invoker = on);
alter view public.v_master_equipment_availability set (security_invoker = on);
```
- A view passa a rodar como o **usuário que consulta** → a RLS das tabelas-base filtra automaticamente por tenant/role.
- ✅ Simples, sem duplicar lógica. ❌ **Quebra o acesso anônimo** (`/m/eventos` sem login não veria nada) — só serve se o público for **logado**.

### Opção B — manter DEFINER + filtro explícito de tenant
```sql
-- Exemplo (recriar a view adicionando o filtro):
create or replace view public.v_master_event_full as
  select e.id, e.id_tenant, e.title, e.description, e.banner_url, e.location, e.is_active,
         e.id_user, u.name as creator_name, r.code as creator_role,
         s.id as id_slot, s.requested_at, s.approved_at, s.capacity, ss.code as slot_status,
         e.created_at, e.updated_at
  from public.master_event e
  join public.master_user u   on u.id = e.id_user
  join public.rel_user_role ur on ur.id_user = u.id and ur.id_tenant = e.id_tenant
  join public.ref_user_role r  on r.id = ur.id_role
  left join public.trx_event_slot s on s.id_event = e.id
  left join public.ref_slot_status ss on ss.id = s.id_slot_status
       and ss.code = any (array['pending','approved','counter_proposed'])
  where e.id_tenant = public.current_tenant_id();   -- <-- filtro de tenant
```
- ✅ Mantém DEFINER (continua funcionando para quem tiver contexto). ❌ Continua exigindo `current_tenant_id()` resolvido (logado) — anônimo sem tenant não vê.

### Caso especial — `/m/eventos` público anônimo
Se a decisão D/G for **anônimo**, criar **view dedicada** mínima e sem dados sensíveis:
```sql
-- View pública só de eventos aprovados/ativos. Decidir o escopo de tenant (multi-tenant por slug?).
create or replace view public.v_public_approved_events as
  select e.id            as id_event,
         e.id_tenant,                 -- manter p/ resolução por slug, se multi-tenant
         e.title, e.banner_url, e.location,
         s.id            as id_slot, s.requested_at, s.capacity
  from public.master_event e
  join public.trx_event_slot s on s.id_event = e.id
  join public.ref_slot_status ss on ss.id = s.id_slot_status and ss.code = 'approved'
  where e.is_active = true;
-- security_invoker fica OFF (DEFINER) de propósito p/ permitir leitura anônima;
-- NÃO expõe creator_name/email; filtra approved+is_active.
grant select on public.v_public_approved_events to anon, authenticated;
```
> ⚠️ Se o app for multi-tenant por subdomínio/slug, o frontend anônimo deve filtrar `id_tenant` pelo slug da cidade; senão a listagem pública mistura cidades.

**Recomendação:** se público logar → **Opção A**. Se `/m/eventos` for anônimo → **Opção A para authenticated** + **`v_public_approved_events`** para anon.

---

## 7. Migration M5 — RPCs transacionais (esqueletos)

Padrão de todas: `language plpgsql`, **`security definer`**, `set search_path = public, pg_temp`, validam papel/tenant via `current_user_id()/current_tenant_id()/current_user_role()`, e fazem todas as escritas numa transação. `grant execute to authenticated`.

> Helper sugerido (resolver id de catálogo por code):
> ```sql
> create or replace function public.ref_id(p_table regclass, p_code text) returns uuid ...
> ```
> (ou subselects inline `(select id from ref_slot_status where code='pending')`).

### 7.1 `create_event_request`
```sql
create or replace function public.create_event_request(
  p_title text, p_description text, p_banner_url text, p_location text,
  p_requested_at timestamptz, p_capacity int,
  p_equipment jsonb  -- [{ "id_equipment": uuid, "quantity": int }, ...]
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := current_user_id(); v_tenant uuid := current_tenant_id();
        v_role text := current_user_role(); v_event uuid; v_item jsonb;
begin
  if v_uid is null or v_tenant is null then raise exception 'não autenticado'; end if;
  if v_role not in ('admin','community_leader') then raise exception 'sem permissão'; end if;

  insert into master_event (id_tenant, id_user, title, description, banner_url, location, created_by)
  values (v_tenant, v_uid, p_title, p_description, p_banner_url, p_location, v_uid)
  returning id into v_event;

  insert into trx_event_slot (id_event, id_slot_status, requested_at, capacity)
  values (v_event, (select id from ref_slot_status where code='pending'), p_requested_at, p_capacity);

  for v_item in select * from jsonb_array_elements(coalesce(p_equipment,'[]'::jsonb)) loop
    insert into trx_event_equipment_request (id_event, id_equipment, quantity)
    values (v_event, (v_item->>'id_equipment')::uuid, (v_item->>'quantity')::int)
    on conflict (id_event, id_equipment) do update set quantity = excluded.quantity;
  end loop;

  return v_event;
end; $$;
```
- **Toca:** master_event, trx_event_slot, trx_event_equipment_request. **Chama:** admin/community_leader. Tenant/owner derivados do contexto (cliente **não** envia id_user/id_tenant).

### 7.2 `approve_event(p_id_event uuid, p_id_slot uuid) returns void`
- role=admin; evento no tenant. Insere `trx_event_approval` (decision=`approved`); `update trx_event_slot set id_slot_status=approved, approved_at=requested_at`; insere `trx_equipment_availability` (quantity_used=quantity, allocated_at=now) para cada `trx_event_equipment_request` do evento.

### 7.3 `reject_event(p_id_event uuid, p_id_slot uuid, p_reason text) returns void`
- role=admin. Insere approval (decision=`rejected`, **reason obrigatório** — trigger valida); `update slot set id_slot_status=rejected`.

### 7.4 `propose_counter_date(p_id_event uuid, p_id_slot uuid, p_counter_date timestamptz, p_reason text) returns void`
- role=admin. Insere approval (decision=`counter_proposed`, **reason + counter_date obrigatórios** — trigger valida); `update slot set id_slot_status=counter_proposed, approved_at=null`.

### 7.5 `accept_counter_date(p_id_slot uuid) returns void`
- **owner** do evento (community_leader) no tenant. Pega `counter_date` da última `trx_event_approval`; `update slot set id_slot_status=approved, requested_at = <counter_date>, approved_at = <counter_date>`.

### 7.6 `reject_counter_date(p_id_slot uuid, p_id_event uuid) returns void`
- owner. `update slot set id_slot_status=inactive`; `update master_event set is_active=false where id=p_id_event`.

### 7.7 `confirm_attendance(p_id_event uuid, p_id_slot uuid) returns void`
- qualquer `authenticated` no tenant do evento. Valida: slot `approved`; **vaga** (`confirmed_count < capacity` via `v_trx_slot_attendance_count`/contagem). `insert trx_event_attendance (id_user=current_user_id(), id_attendance_status=confirmed) on conflict (id_slot,id_user) do update set id_attendance_status=confirmed`.

### 7.8 `cancel_attendance(p_id_event uuid, p_id_slot uuid) returns void`
- dono da participação. `update trx_event_attendance set id_attendance_status=cancelled where id_slot=p_id_slot and id_user=current_user_id()`.

> Esqueleto-modelo (aplica-se a 7.2–7.8):
> ```sql
> create or replace function public.approve_event(p_id_event uuid, p_id_slot uuid)
> returns void language plpgsql security definer set search_path = public, pg_temp as $$
> declare v_tenant uuid := current_tenant_id(); v_role text := current_user_role();
> begin
>   if v_role <> 'admin' then raise exception 'apenas admin'; end if;
>   if not exists (select 1 from master_event e where e.id=p_id_event and e.id_tenant=v_tenant)
>     then raise exception 'evento fora do tenant'; end if;
>   -- ... inserts/updates ...
> end; $$;
> ```

**Permissões:** `grant execute on function public.<rpc>(...) to authenticated;` para todas. **Nenhuma** a `anon` (escrita exige login).

---

## 8. Migration M6 — Provisionamento (trigger opcional)

### Alternativa 1 — manual (recomendada para começar)
```sql
-- 1) criar o usuário no Supabase Auth (painel/admin API)
-- 2) vincular ao master_user existente (ou criar um novo) e garantir role
update public.master_user
   set id_auth_user = '<auth-user-uuid>'
 where email = '<email-do-admin>';
-- garantir role admin no tenant:
-- insert into rel_user_role (id_user, id_role, id_tenant)
-- select mu.id, (select id from ref_user_role where code='admin'), mu.id_tenant
--   from master_user mu where mu.email='<email>'
-- on conflict (id_user, id_tenant) do update set id_role = excluded.id_role;
```

### Alternativa 2 — trigger automático (depois)
```sql
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid; v_role uuid;
begin
  v_tenant := (new.raw_user_meta_data->>'tenant_id')::uuid;     -- exige metadado no signup
  v_role   := (select id from ref_user_role
               where code = coalesce(new.raw_user_meta_data->>'role','community_leader'));
  insert into public.master_user (id_tenant, id_auth_user, name, email)
  values (v_tenant, new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email);
  insert into public.rel_user_role (id_user, id_role, id_tenant)
  select mu.id, v_role, v_tenant from public.master_user mu where mu.id_auth_user = new.id
  on conflict (id_user, id_tenant) do nothing;
  return new;
end; $$;
-- create trigger on_auth_user_created after insert on auth.users
--   for each row execute function public.handle_new_auth_user();
```
> ⚠️ Exige decidir B (tenant) e E (role). Sem `tenant_id` no metadado, falha. Por isso **começar manual** (Alt 1) para o admin, e só depois automatizar líderes com fluxo de signup controlado.

---

## 9. Migration M7 — Frontend (depois, em etapa separada)

> Não implementar agora. Só registra o alvo.

- `src/lib/supabase/session-context.ts` — resolve `{ userId, tenantId, role }` da sessão.
- `useCurrentUser()` (novo hook) consumindo a sessão Supabase.
- Remover mocks de `src/app/constants/currentUser.ts`.
- Corrigir `AdminAuthProvider`/`LoginPage`: sync vai para **`master_user`** (a `master_system_user` **não existe** neste projeto) + criar/atualizar `id_auth_user`.
- Login para **público/líder** (hoje só admin tem Supabase Auth).
- Services de escrita (`events`, `event-slots`, `event-approvals`, `event-attendance`, `event-equipment`) passam a **chamar RPC** e **param de enviar** `id_user`/`id_tenant`.
- Leitura de `master_equipment` sai do fallback (com sessão, a policy de tenant passa a retornar dados).
- Remover fallback mock por feature, só após validar a leitura/escrita real.

---

## 10. Scripts de verificação pós-migration

```sql
-- a) coluna bridge existe
select column_name from information_schema.columns
 where table_schema='public' and table_name='master_user' and column_name='id_auth_user';

-- b) funções de contexto resolvem (rodar AUTENTICADO; via SQL editor usar set request.jwt... ou testar pelo app)
select public.current_user_id(), public.current_tenant_id(), public.current_user_role();

-- c) policies dos refs presentes
select tablename, policyname, cmd, roles::text from pg_policies
 where schemaname='public' and tablename like 'ref_%' order by tablename;

-- d) master_equipment retorna p/ usuário autenticado do tenant (testar pelo app logado): deve trazer linhas
-- e) anon NÃO vê tabela base: GET /rest/v1/master_equipment com anon → []  (RLS)
-- f) view não vaza tenant:
--    Opção A (invoker): consultar como anon → 0 linhas; como user do tenant X → só do tenant X.
--    Opção B (definer+filtro): idem via current_tenant_id().
select count(distinct id_tenant) as tenants_visiveis from public.v_master_event_full; -- esperado: 1 (logado) / 0 (anon)
```

---

## 11. Ordem de execução recomendada (fases)

| Fase | Conteúdo | Pré-requisito |
|---|---|---|
| **1** | M1 (bridge) + M2 (funções) + M3 (refs) | Decisões A,B,E |
| **2** | Criar/vincular 1º admin real (M6 Alt 1) + testar leitura authenticated | Fase 1 |
| **3** | M4 (views seguras) — escolher A/B + view pública se anônimo | Decisão D,G |
| **4** | M5 (RPCs de escrita) | Fase 1–2 |
| **5** | M7 (frontend: auth/contexto + RPC) | Fase 1–4 |
| **6** | Remover mocks/fallbacks | Fase 5 validada |

> Cada fase deve ser uma migration versionada em `supabase/migrations/` e validada com a seção 10 antes da próxima.

---

## 12. Riscos

| Risco | Mitigação |
|---|---|
| **Travar login** (funções definer mal feitas) | testar em staging/branch; manter rollback das funções (corpo antigo guardado) |
| **Vazar tenant em views** | M4 obrigatória antes de abrir uso autenticado; verificação 10.f |
| **Policies bloquearem tudo** | validar com usuário real vinculado (Fase 2) antes de seguir |
| **SECURITY DEFINER inseguro** | `set search_path` fixo (feito); dono = postgres; sem dynamic SQL com input |
| **500 usuários sem auth** | decisão F; não dependem deles para o piloto; ligar só os reais |
| **Público sem role** | decisão E; RPCs de leitura/attendance não exigem role; tratar “sem role” = público |
| **Multi-tenant sem tenant p/ anon** | `v_public_approved_events` + resolução por slug no front; não usar `current_tenant_id()` para anon |
| **RPC aprovar evento de outro tenant** | toda RPC valida `e.id_tenant = current_tenant_id()` + `current_user_role()` antes de escrever |
| **Branch/migração direto em produção** | usar Supabase **branch** (`create_branch`) p/ testar, depois `merge` |

---

## Status de execução

- **Fase 1 (M1+M2+M3) — APLICADA e VALIDADA** no banco de TESTE/HOMOLOGAÇÃO `tfupwytzrkpzocfxheeq` em 2026-06-25 (migration `auth_rls_phase_1`, via MCP `apply_migration`).
  - Pós-checks: coluna/índice/FK `id_auth_user` ✅; `current_user_*` como `SECURITY DEFINER` ✅; 4 policies SELECT `ref_*` (authenticated) ✅.
  - Smoke test: auth user `43c060a3…` vinculado a `master_user d657a1ca…` → `current_user_id/tenant/role` = master_user / Load Test Corp / `admin`; authenticated lê `ref_*` e `master_equipment` (50); anon bloqueado nas tabelas-base; views públicas seguem (4000/50, ainda cross-tenant → Fase M4).
- **Etapa 9.1/9.2 (frontend auth/contexto) — INICIADA** (sem escrita):
  - Criado `src/features/auth` (`types`, `api/auth.service`, `context/AuthProvider`+`AuthContext`, `hooks/useCurrentUser`, `index`).
  - `src/app/routes/ProtectedRoute.tsx` protege `/web/*` (sessão + role admin); `/m/*` segue público.
  - `main.tsx` envolto em `<AuthProvider>`; `AdminWebLayout` mostra usuário + logout.
  - Bug corrigido: `LoginPage` e `AdminAuthProvider` não usam mais `master_system_user` (inexistente). `AdminAuthProvider` marcado como superseded.
  - `currentUser.ts` documentado como fallback dev (mocks mantidos).
  - Validação: tsc OK, build OK, 86/86 testes, lint sem erros novos.

- **Fase M4 (views seguras por tenant) — APLICADA e VALIDADA** em `tfupwytzrkpzocfxheeq` em 2026-06-25 (migration `secure_event_views`; arquivo `supabase/migrations/202606250002_secure_event_views.sql`).
  - Criada `v_public_approved_events` (DEFINER, anon): approved+is_active, dados mínimos (sem `id_user`/creator), com `confirmed_count`. Grant SELECT anon+authenticated.
  - `v_master_event_full` / `v_master_equipment_availability` / `v_trx_slot_attendance_count` → `security_invoker = on` (RLS filtra por tenant/role).
  - Validação banco: **anon** → admin views = 0, `v_public_approved_events` = approved/ativos; **admin** → views só do tenant (distinct id_tenant = 1).
  - Services: `events.service.listPublicApprovedEvents` e o fallback público de `getEventById` usam `v_public_approved_events`; funções admin seguem em `v_master_event_full` (agora tenant-safe). `equipment.service` inalterado.

- **Fase M5 (bloco admin) — APLICADA e VALIDADA** em `tfupwytzrkpzocfxheeq` em 2026-06-25 (migration `admin_event_decision_rpcs` + revoke; arquivo `supabase/migrations/202606250003_admin_event_decision_rpcs.sql`).
  - RPCs `approve_event(uuid,uuid)`, `reject_event(uuid,uuid,text)`, `propose_counter_date(uuid,uuid,timestamptz,text)` — `SECURITY DEFINER`, validam admin + tenant via contexto; `EXECUTE` só `authenticated` (revogado de PUBLIC/anon).
  - Testes banco: anon → `permission denied`; admin → counter_proposed/rejected/approved persistidos, `trx_event_approval` com `id_reviewed_by` derivado do auth, alocação em `trx_equipment_availability` no approve.
  - Service `event-approvals.service.ts`: `approveEvent`/`rejectEvent`/`proposeCounterDate` chamam `supabase.rpc(...)` (fallback mock só em dev).

- **`getLatestApproval` migrado para dados reais** (2026-06-25): lê `trx_event_approval` + embed `ref_approval_decision(code,name)`, `order reviewed_at desc limit 1`, filtro `id_event` (+`id_slot` opcional). RLS: admin vê tenant, líder vê próprios eventos, anon = 0. Fallback mock mantido (dev). Type `EventApproval` ganhou `decision_code`/`decision_name`/`reviewed_at` e `id_decision: number | string`. Validado no banco (rejected/counter_proposed/approved com reason/counter_date reais; anon=0).

- **Auth `/m/*` (público/líder) religada** (2026-06-25): `ProtectedMobileRoute` guarda `/m/meus-eventos` (login) e rotas de líder (login + `community_leader`); páginas usam `useCurrentUser().masterUserId/tenantId`. `/m/eventos`/`:id` seguem anônimos.

### Ponte SASI → sessão Supabase (login mobile via deep-link) — 2026-06-25

Deep-link `/m/*?sasi-token=<JWT>` vira sessão Supabase real (sem JWT manual, sem service role no front).

- **Captura** (`features/sasi-token`): `useSasiTokenCapture` lê `?sasi-token=` (fallback `?token=`), guarda em `sessionStorage` e limpa a URL.
- **Troca** (`SasiAuthProvider` → `exchangeSasiTokenForSupabaseSession`): chama a edge function; ao receber `tokenHash`, faz `supabase.auth.verifyOtp({ type:'magiclink', token_hash })` → dispara `SIGNED_IN` → `AuthProvider` recarrega `useCurrentUser`. Em sucesso, limpa o token SASI do `sessionStorage`.
- **Edge function `exchange-sasi-token`** (`supabase/functions/exchange-sasi-token/index.ts`, `verify_jwt=false`): valida na SASI (`GET {SASI_API_URL}/api/v2/providers/external/me`) → extrai e-mail (`customProps.email`→`profileProps.email`) → resolve `master_user` (0→403, >1→409) → garante `auth.users` (cria com `email_confirm:true` se faltar; concilia `master_user.id_auth_user`, divergência→409) → `admin.generateLink(magiclink)` → `{ identity, supabaseAuth:{ email, tokenHash, type } }`. Não loga token nem tokenHash; service role só no servidor.
- **Autorização**: `ProtectedMobileRoute` autoriza SOMENTE por sessão Supabase real; o `SasiAuthProvider` é apenas mecanismo de login (expõe `loading` p/ evitar flicker).

**Deploy/validação runtime (2026-06-25) — projeto `tfupwytzrkpzocfxheeq` (= `VITE_SUPABASE_URL` do front):**
- Edge function **deployada** (via MCP, v1, `ACTIVE`, `verify_jwt=false`). CLI `supabase` indisponível no ambiente; `.temp/project-ref` apontava `bkaqywslrgyqsvaumwnv` (stale) — o front usa `tfupwytzrkpzocfxheeq`.
- Secret **`SASI_API_URL` PENDENTE**: não configurado e sem tool de secrets aqui. Smoke test do endpoint deployado → `500 {"error":"SASI_API_URL nao configurada."}` (confirma função viva, guard de config e `verify_jwt=false`).
- Token SASI real validado **direto na API** (`api.sasi.io/.../me` → HTTP 200): `andressa.vercosa@sasi.com.br` (provider Bellog "worker"). `master_user` para o e-mail = **0** → com este token o fluxo cairia corretamente em **403** (população SASI/Bellog ≠ usuários de eventos). Sessão de sucesso **não demonstrada** (falta token cujo e-mail case com `master_user`).

### Pendências
- **Configurar secret** `SASI_API_URL=https://api.sasi.io` em `tfupwytzrkpzocfxheeq` (CLI/dashboard) e re-testar.
- **Token SASI de líder** com e-mail existente em `master_user` (ou vínculo de teste autorizado) para validar sessão Supabase + RLS ponta-a-ponta.
- **M5-B** — RPCs do líder: `create_event_request`, `accept_counter_date`, `reject_counter_date`; do público: `confirm_attendance`, `cancel_attendance`.
- Remoção de mocks/fallbacks quando o fluxo real estiver firme.

## Próximo passo recomendado
1. Configurar `SASI_API_URL` e re-testar a ponte com um token de líder válido.
2. M5-B: RPCs transacionais do líder e do público.
3. Remover mocks/fallbacks após o fluxo real firme.
