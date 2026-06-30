# RELATÓRIO DE PRONTIDÃO PARA PRODUÇÃO — Cidade na Mão / SASI Eventos

**Data:** 2026-06-27
**Banco inspecionado:** `tfupwytzrkpzocfxheeq` (TESTE/HOMOLOGAÇÃO)
**Escopo:** inspeção apenas (sem alterações de código, banco, migration ou deploy).
**Status geral:** 🔴 **NÃO PRONTO PARA PRODUÇÃO**

> Documentos relacionados: [MIGRACAO-CIDADE-NA-MAO.md](MIGRACAO-CIDADE-NA-MAO.md) · [MIGRACAO-SUPABASE-AUTH-RLS.md](MIGRACAO-SUPABASE-AUTH-RLS.md) · [INTEGRACAO-SASI-MOBILE.md](INTEGRACAO-SASI-MOBILE.md)

---

## 🔗 Integração SASI Mobile (planejada)

O plano de reconciliação da ponte SASI está em
[INTEGRACAO-SASI-MOBILE.md](INTEGRACAO-SASI-MOBILE.md): identificação por `profile.id` do SASI
(`webclient.sasi.com.br` → `/v2/public/auth/refresh` → `/v2/profile/self`), **mantendo a
emissão de sessão Supabase real** para preservar RLS e as RPCs. **Planejado, ainda não
implementado** — depende de confirmação externa com o SASI:

1. se `/v2/profile/self` retorna e-mail;
2. se `profile.id` é estável e único;
3. se `https://webclient.sasi.com.br` é o endpoint oficial;
4. se cada usuário SASI pertence a exatamente um tenant no Cidade na Mão.

Isso provavelmente explica o `403` do teste runtime anterior (casamento por e-mail em vez do
`profile.id`). A migration `master_user.id_sasi_profile` **não será criada** até a confirmação
do item 1.

As perguntas oficiais para a equipe SASI foram registradas em
[INTEGRACAO-SASI-MOBILE.md](INTEGRACAO-SASI-MOBILE.md), seções 14 e 15. A implementação por
`profile.id` segue bloqueada até o retorno dessas respostas.

**Frontend da ponte `?token=` (global, web+mobile): implementado e validado localmente**
(typecheck/build ✓, 151 testes ✓). Mas **habilitar em runtime continua bloqueado** (ver
[INTEGRACAO-SASI-MOBILE.md](INTEGRACAO-SASI-MOBILE.md) §18): secret `SASI_API_URL` e redeploy da
edge function **PENDENTES** (sem `supabase` CLI/MCP nesta sessão); a function deployada ainda
retorna `500`, então **nenhuma sessão Supabase real foi criada**. Os bloqueadores de produção do
relatório permanecem. Script de deploy/secret (`scripts/supabase/deploy-exchange-sasi-token.ps1`)
e checklist de smoke ([SMOKE-SASI-TOKEN.md](SMOKE-SASI-TOKEN.md)) **preparados** para rodar em
ambiente com Supabase CLI + token real.

**Web Admin Eventos (`/web/eventos`) — auditoria dedicada em
[ANALISE-WEB-EVENTOS-PRODUCAO.md](ANALISE-WEB-EVENTOS-PRODUCAO.md).** Status PARCIAL. Já reais:
lista, criação (`admin_create_event`), aprovar/contraproposta, inativar/ativar
(`admin_set_event_active`) e — desde 2026-06-29 — **Reprovar** ligado à RPC real `reject_event`
(motivo obrigatório). **Pessoas Confirmadas** lê `trx_event_attendance` real (sem mock; hoje vazio
até a presença real do público — M5-B). **Edição real** implementada via RPC `admin_update_event`
(informações + equipamentos com replace completo; sem mock). **Presença real (M5-B) implementada**
(Modelo A — autenticado): `confirm_attendance`/`cancel_attendance` gravam em `trx_event_attendance`;
`/m/eventos/:id`, `/m/meus-eventos` e "Pessoas Confirmadas" do admin passam a usar dados reais.
**Bloqueadores remanescentes:** fail-closed do fallback mock nas leituras, banner via Storage, e
banco de produção limpo (tenant/admin/líder reais).

---

## ✅ Smoke test frontend (dev local / homologação) — 2026-06-27

Executado com Vite dev (`http://localhost:5173`) lendo o banco de homologação
`tfupwytzrkpzocfxheeq`, dirigido via browser (Playwright).

| Verificação | Resultado |
|---|---|
| `GET /` (HTML + Vite client) | ✅ 200, `<title>Cidade na Mão</title>` |
| `src/main.tsx` (transform Vite) | ✅ compila sem erro |
| `/m/eventos` (público, mobile) | ✅ renderizou com **dados reais da view pública** (`v_public_approved_events`) |
| `/web/eventos` (admin) | ✅ **guard bloqueou** sem sessão ("Acesso não autorizado — Acesse pelo aplicativo SASI") |
| Console / runtime | ✅ **0 erros** |
| Visual | ✅ layout mobile + paleta Cidade na Mão aplicados |

**Status do smoke test:**
- ✅ Leitura pública mobile validada (Supabase real, não mock localStorage).
- ✅ Guard admin validado (bloqueia sem sessão Supabase).
- ⛔ Fluxos autenticados (líder/admin/confirmar presença) **não testados** — dependem da
  ponte SASI em runtime (bloqueador conhecido).
- ⚠️ Dados exibidos são **sintéticos de homologação** (`Evento de Carga` / `Localização
  Aleatória`); reforça a necessidade de banco de produção limpo / limpeza `@loadtest`.
- 🔴 Produção **continua bloqueada** pelos itens já registrados (RPCs M5-B, ponte SASI,
  banco de produção, tenant/admin/líder reais, fail-closed do mock).

---

## 1. Resumo executivo

**Status geral: 🔴 NÃO PRONTO (com base sólida).**

O projeto tem a **fundação de segurança e leitura prontas e validadas**, mas o **núcleo transacional de escrita do fluxo de eventos ainda roda em mock (localStorage)**, e **não existe banco de produção** — o ambiente atual é homologação, com `auth.users` vazia e ~500 usuários sintéticos `@loadtest.com`.

**Por que não está pronto (bloqueadores reais):**

1. **Cadeia de escrita quebrada.** O líder cria evento/slot/equipamento apenas no localStorage (mock). O admin aprova via RPC real (`approve_event`). Como o slot nunca foi persistido no banco, em produção o `approve_event` receberia um `id_slot` inexistente e **falharia** — o fluxo ponta-a-ponta não funciona. Ver `src/features/event-slots/api/event-slots.service.ts`, `src/features/event-attendance/api/event-attendance.service.ts`.
2. **Faltam 5 RPCs (bloco M5-B):** `create_event_request`, `accept_counter_date`, `reject_counter_date`, `confirm_attendance`, `cancel_attendance`. Sem elas, líder e público não persistem nada.
3. **Edge Function SASI nunca validada em runtime.** `exchange-sasi-token` está deployada, mas o secret `SASI_API_URL` **não está configurado** → smoke test retorna `500`. Login SASI ponta-a-ponta nunca foi demonstrado com sucesso.
4. **Não existe banco de produção.** Falta projeto Supabase limpo, baseline aplicada, tenant real, admin real, líder real.
5. **Fallback mock silencioso em produção.** Se o Supabase falhar/RLS retornar 0 linhas, os serviços caem para localStorage **sem erro visível** — mascara falhas em produção.

**O que pode ficar para depois (sem risco grave):** filtros por data nas telas admin (placeholders), botão de logout no mobile, edição completa de evento (aba "Informações" read-only), refino de cobertura de testes, baseline de lint.

**Classificação por dimensão:**

| Dimensão | Status |
|---|---|
| Auth / RLS / Segurança de leitura | 🟢 Quase pronto |
| Decisões do admin (aprovar/reprovar/contraproposta) | 🟡 Backend pronto, cadeia quebrada |
| Escrita líder/público (solicitar, presença) | 🔴 Não pronto (mock) |
| Ponte SASI (login) | 🔴 Bloqueado (secret + runtime) |
| Banco de produção / dados reais | 🔴 Não existe |
| Frontend (rotas, guards, leitura) | 🟢 Quase pronto |
| Qualidade (build/test/lint) | 🟡 Verde no último registro, não revalidado |

---

## 2. Checklist por área

### Backend / Supabase

| Item | Estado |
|---|---|
| Baseline schema | ✅ `00000000000000_baseline_schema.sql` — completo, idempotente, **seeds só de catálogos `ref_*`** (sem carga). |
| Migrations aplicadas (test DB) | ✅ Fase 1 (auth/RLS), M4 (views), M5-admin (RPCs) — aplicadas e validadas em `tfupwytzrkpzocfxheeq`. |
| Migrations pendentes | 🔴 M5-B (5 RPCs líder/público) — só existem como **esqueleto no doc**, não como arquivo de migration. |
| RLS habilitado | ✅ Em **todas** as tabelas de evento (baseline linhas 360–376). |
| Policies de escrita | ✅ **Já existem** para `master_event`, `trx_event_slot`, `trx_event_attendance`, `trx_event_equipment_request` (insert por dono/admin; attendance por `id_user = current_user_id()`). **O backend aceita escrita — o frontend é que não usa.** |
| Views públicas | ✅ `v_public_approved_events` (DEFINER, anon-safe, dados mínimos). |
| Views admin | ✅ `v_master_event_full`, `v_trx_slot_attendance_count`, `v_master_equipment_availability` com `security_invoker=on`. |
| RPCs admin | ✅ `approve_event`, `reject_event`, `propose_counter_date` (SECURITY DEFINER, validam role+tenant, EXECUTE só `authenticated`). |
| Funções SECURITY DEFINER | ✅ `current_user_id/tenant/role` via `auth.uid()`; search_path fixo. Boa prática. |
| Grants | ⚠️ `grant all on all tables to anon, authenticated, service_role` — **fail-open por grant**, mitigado por RLS em todas as tabelas. Aceitável, mas revisar antes de prod (anon não deveria ter `all`). |
| Seeds / ref tables | ✅ `ref_user_role`, `ref_slot_status`, `ref_approval_decision`, `ref_attendance_status` etc. seedados por `code`. |
| Tenant | 🔴 Nenhum tenant real; mocks usam `tenant-itabira`. |
| Usuários reais | 🔴 `auth.users` = **0**; `master_user` tem ~500 `@loadtest.com` sintéticos. |
| Isolamento multi-tenant | 🟢 Garantido por RLS via `current_tenant_id()` + M4 views. Validado: anon=0, admin só vê seu tenant. |
| Risco de vazamento | 🟢 Baixo após M4 (corrigiu views DEFINER cross-tenant). |
| Dados de teste | 🔴 500 `@loadtest.com` em `master_user`; `cleanup-test-data.sql` cobre **só tabelas legadas Bellog**, não eventos nem `master_user`. |

### Auth

| Item | Estado |
|---|---|
| Supabase Auth | ✅ Implementado (`src/features/auth/api/auth.service.ts`). |
| Vínculo `auth.users` → `master_user` | ✅ Coluna `id_auth_user` + FK + índice único parcial (Fase 1 M1). |
| Login admin (`/web/*`) | ✅ `ProtectedRoute` exige sessão + role `admin`. |
| Login líder | ✅ `ProtectedMobileRoute` com `allowedRoles=['community_leader']`. |
| Ponte SASI → sessão | 🔴 Implementada mas **não validada em runtime** (secret faltando). |
| Logout | 🟡 OK no admin (`AdminWebLayout`); **ausente no mobile** (só aparece em tela de acesso negado). |
| Usuário sem role | ✅ `current_user_role()` retorna null → `RoleRestricted`/`AccessDenied`. |
| Usuário sem master_user | ✅ Edge function retorna **403**; contexto vira anon. |
| Usuário duplicado | ✅ Edge function retorna **409** (>1 master_user, ou id_auth_user divergente). |
| Proteção de rotas | ✅ Guards web e mobile separados, esperam resolução da sessão e da troca SASI (sem flicker). |

### Edge Functions

| Item | Estado |
|---|---|
| `exchange-sasi-token` | 🟡 Código sólido e bem comentado; deployada (`ACTIVE`, v1). |
| Secret `SASI_API_URL` | 🔴 **NÃO configurado** → endpoint retorna `500 SASI_API_URL nao configurada`. |
| `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_URL` | ⚠️ Injetados pelo runtime Supabase; validar no projeto de produção. |
| `config.toml` | ✅ `verify_jwt=false` para `exchange-sasi-token` (correto: valida token SASI internamente). |
| Service role | ✅ Nunca sai do servidor; cliente admin criado server-side. |
| Logs sensíveis | ✅ Não loga token nem `hashed_token`. Loga IDs de usuário (aceitável). |
| Tratamento de erro | ✅ Mapeia 400/401/403/409/500 corretamente. |
| Dependência API SASI | ⚠️ Dependência dura de `api.sasi.io/api/v2/providers/external/me`; sem retry/cache. |
| Runtime real | 🔴 **Nunca demonstrado com sucesso** (faltou token cujo e-mail exista em `master_user`). |
| CORS | ⚠️ `Access-Control-Allow-Origin: *` — funcional, mas restringir ao domínio de prod é recomendável. |

> Nota: há ~10 outras edge functions legadas do Bellog (`send-email`, `consult-cnpj`, `register-route-arrival`, etc.) — fora do escopo de eventos, todas `verify_jwt=false`.

### Frontend Web/Admin

| Rota | Estado |
|---|---|
| `/web/eventos` | 🟢 Lê `v_master_event_full` (real). UI: filtro por data é placeholder. |
| `/web/eventos/:id` | 🟡 Lê real; aprovar/contraproposta via RPC real. **Aba "Informações" é read-only (placeholder)**; "Pessoas confirmadas" é **100% mock** (`confirmedPeople.mock.ts`). |
| `/web/equipamentos` | 🟡 Cabeado p/ `master_equipment`, mas RLS sem auth → cai no mock na prática. |
| Login / logout admin | 🟢 OK. |
| Proteção admin | 🟢 `ProtectedRoute requireAdmin`. |
| Escrita real via RPC | 🟡 Só decisões do admin (com fallback mock). Criação de evento = mock. |
| Telas incompletas | "Novo evento" → etapa de equipamentos = "será implementada"; filtros por data = placeholder. |

### Frontend Mobile / Público / Líder

| Rota | Estado |
|---|---|
| `/m/eventos` | 🟢 Público; lê `v_public_approved_events` (real). |
| `/m/eventos/:id` | 🟡 Lê real; **confirmar/cancelar presença = mock**. |
| `/m/meus-eventos` | 🔴 Lista presenças **só do localStorage** (mock). |
| `/m/eventos-solicitados` | 🟢 Lê `v_master_event_full` filtrado por usuário (real, RLS). |
| `/m/eventos-solicitados/:id` | 🟡 `getLatestApproval` real; aceitar/recusar contraproposta = mock. |
| `/m/solicitar-evento` | 🔴 Submete via `useEventRequestFlow` → createEvent+slot+equipment **todos mock**. |
| Visual vs `SASI Eventos Mobile.html` | ⚠️ Ajustado por referência visual; **validação no navegador pendente**. |
| Dependência ponte SASI | 🔴 Rotas protegidas dependem da ponte não-validada. |

### Regras de negócio

| Regra | Estado |
|---|---|
| Público visualizar eventos | 🟢 Real (view pública). |
| Público confirmar presença | 🔴 Mock. RLS exige `id_user=current_user_id()` → exige master_user+auth para todo público. |
| Público cancelar presença | 🔴 Mock. |
| Líder solicitar evento | 🔴 Mock (sem `create_event_request`). |
| Líder aceitar contraproposta | 🔴 Mock (sem `accept_counter_date`). |
| Líder recusar contraproposta | 🔴 Mock (sem `reject_counter_date`). |
| Admin aprovar | 🟡 RPC real `approve_event` (mas slot vem do mock → quebra em prod). |
| Admin reprovar | 🟡 RPC real `reject_event`. |
| Admin sugerir nova data | 🟡 RPC real `propose_counter_date`. |
| Equipamentos (catálogo) | 🟡 Tabela + RLS prontos; leitura cai no mock sem auth. |
| Disponibilidade de equipamento | 🟡 `approve_event` aloca em `trx_equipment_availability`, mas requests vêm vazios (mock) → aloca 0. |
| Status de evento/slot | 🟢 `ref_slot_status` seedado (pending/approved/counter_proposed/rejected/inactive). |
| Notificações | ⚪ Tabela `trx_event_notification` existe; **sem implementação de frontend/serviço**. |

### Dados / Produção

- 🔴 Banco atual = homologação com carga de teste (`@loadtest.com`, `auth.users`=0).
- 🔴 Necessário **criar projeto Supabase de produção limpo**.
- 🔴 Aplicar baseline + todas as migrations + M5-B em banco vazio.
- 🔴 Criar **tenant real**, **admin real** (e `id_auth_user`), **líder real**.
- 🔴 Limpeza `@loadtest.com` — script atual **não cobre** isso.
- ⚠️ Configurar domínio/`VITE_APP_URL`, `VITE_IS_TEST=false`.

### Segurança

- 🟢 RLS em todas as tabelas; isolamento por tenant validado.
- ⚠️ `grant all ... to anon` — depende 100% de RLS; revisar.
- 🟢 Views públicas mínimas (sem PII de criador).
- 🟢 Service role só na edge function.
- 🔴 Secret `SASI_API_URL` ausente.
- 🟢 Tokens não logados; sessionStorage só para token SASI transitório.
- ⚠️ CORS `*` nas edge functions.
- 🔴 **Fallback mock pode servir dados falsos em produção** se Supabase falhar.
- ⚠️ `.env` versiona credenciais do projeto de teste (anon key é pública por design, mas confirmar que não há service key).

### Qualidade

| Item | Estado |
|---|---|
| typecheck / build / test | 🟡 Último registro: tsc OK, build OK, 86/86 testes. **Não revalidado nesta inspeção** (a pedido). |
| Testes | ⚠️ Cobertura concentrada no legado Bellog; **zero testes dos fluxos de evento** (services novos). |
| Testes de integração | 🔴 Inexistentes para RPCs de evento / ponte SASI. |
| Lint | 🟡 Baseline antigo; "sem erros novos" no último registro. |
| Smoke / manual / mobile no navegador | 🔴 Pendentes. |
| Responsividade / a11y | ⚪ Não auditadas. |
| Tratamento de erro | ⚠️ Fallback silencioso mascara erros (anti-padrão para prod). |

### Deploy

| Item | Estado |
|---|---|
| Frontend | 🟡 Vercel configurado (`vercel.json`, framework vite). Falta env de prod. |
| Migrations | 🔴 Sem projeto de prod; CLI `supabase` indisponível no ambiente (usado MCP). |
| Edge Functions | 🟡 Deployada em test; pendente em prod + secret. |
| Secrets | 🔴 `SASI_API_URL` pendente. |
| Domínio / env vars | 🔴 `VITE_IS_TEST=false`, `VITE_SUPABASE_URL` de prod, `VITE_APP_URL` pendentes. |
| Rollback | 🟡 Migrations têm blocos de rollback comentados; sem plano operacional. |
| Monitoramento / logs | 🔴 Sem observabilidade (Sentry/Datadog); `logSupabaseError` só loga em DEV. |

---

## 3. Lista objetiva do que falta

| Prioridade | Item | Área | Status atual | Risco | O que fazer | Arquivos/tabelas |
|---|---|---|---|---|---|---|
| BLOQUEADOR | RPC `create_event_request` | Backend | Mock | Líder não persiste nada | Criar RPC transacional (evento+slot+equip) | `master_event`, `trx_event_slot`, `trx_event_equipment_request` |
| BLOQUEADOR | RPC `confirm_attendance`/`cancel_attendance` | Backend | Mock | Presença não persiste | Criar RPCs | `trx_event_attendance` |
| BLOQUEADOR | RPC `accept_counter_date`/`reject_counter_date` | Backend | Mock | Líder não responde contraproposta | Criar RPCs | `trx_event_slot`, `trx_event_approval` |
| BLOQUEADOR | Cadeia slot→approve quebrada | Backend/Front | Mock cria id local | `approve_event` falha em prod | Persistir slot real antes de aprovar | `event-slots.service.ts` |
| BLOQUEADOR | Secret `SASI_API_URL` | Edge | Ausente | Login SASI 500 | Configurar secret e re-testar | `exchange-sasi-token` |
| BLOQUEADOR | Ponte SASI runtime | Auth | Não validada | Login pode não funcionar | Token de líder real + teste E2E | edge fn + `SasiAuthProvider` |
| BLOQUEADOR | Banco de produção | Dados | Não existe | Sem ambiente | Criar projeto, baseline, migrations | todas |
| BLOQUEADOR | Tenant/admin/líder reais | Dados | Só mocks | Sem acesso real | Seed manual controlado | `master_tenant`, `master_user`, `rel_user_role` |
| ALTO | Fallback mock silencioso | Front/Seg | Ativo | Dados falsos em prod | Fail-closed quando `IS_TEST=false` | services `features/events*` |
| ALTO | `VITE_IS_TEST=false` em prod | Deploy | Default true | Filtros errados | Setar no Vercel | `.env`/Vercel |
| ALTO | Limpeza `@loadtest.com` | Dados | 500 sintéticos | PII falsa/ruído | Banco limpo (recomendado) ou script novo | `master_user` |
| ALTO | Escrita equipamento (request) | Front | Mock | Aprovação aloca 0 | RPC + chamada real | `trx_event_equipment_request` |
| MÉDIO | "Pessoas confirmadas" mock | Front | Gerador fake | Lista irreal/CSV falso | Ler `trx_event_attendance` | `EventConfirmedPeopleTab` |
| MÉDIO | Aba "Informações" read-only | Front | Placeholder | Admin não edita | Implementar edição | `EditEventInfoTab` |
| MÉDIO | Validação mobile no navegador | Front | Pendente | Bugs visuais | Smoke test | `/m/*` |
| MÉDIO | Logout mobile | Front | Ausente | UX | Adicionar no header | `MobileLayout` |
| MÉDIO | Testes dos fluxos de evento | Qualidade | Zero | Regressões | Cobrir services/RPCs | `features/event*` |
| BAIXO | Filtros por data | Front | Placeholder | UX | Implementar | `WebEventsToolbar` |
| BAIXO | Notificações | Negócio | Sem front | Feature ausente | Definir escopo | `trx_event_notification` |
| BAIXO | CORS `*` / grants `anon all` | Seg | Permissivo | Hardening | Restringir | edge fns / baseline |
| BAIXO | `currentUser.ts` / `DEFAULT_REVIEWER` | Front | Deprecated | Limpeza | Remover pós-migração | `app/constants/currentUser.ts` |

---

## 4. Bloqueadores de produção

Confirmados no código/banco/docs:

1. **Faltam 5 RPCs de escrita (M5-B)** — `create_event_request`, `accept_counter_date`, `reject_counter_date`, `confirm_attendance`, `cancel_attendance`. Só existem como esqueleto em `docs/MIGRACAO-SUPABASE-AUTH-RLS.md` (linhas 235–290). *(Nota: o RLS já permitiria insert direto; a decisão de projeto é via RPC.)*
2. **Cadeia de escrita quebrada** — solicitação de evento/slot/equipamento e presença são **localStorage** (`event-slots.service.ts`, `event-attendance.service.ts`, `event-equipment.service.ts`, `createEvent` em `events.service.ts`). `approve_event` real receberia `id_slot` inexistente → falha.
3. **Edge Function SASI não validada em runtime** — secret `SASI_API_URL` ausente → `500`; sessão de sucesso nunca demonstrada.
4. **Banco de produção inexistente** — ambiente atual é homologação; `auth.users`=0; ~500 `@loadtest.com`.
5. **Faltam baseline+migrations aplicadas em prod, tenant real, admin real, líder real.**
6. **Fallback mock ativo em runtime** — degradação silenciosa se `hasSupabaseEnv()` falhar ou RLS retornar 0 (ALTO, na fronteira de bloqueador).

---

## 5. O que já está pronto (com evidência)

| Item | Evidência |
|---|---|
| **Auth/RLS Fase 1** | `supabase/migrations/202606250001_auth_rls_phase_1.sql` — `id_auth_user`+FK, `current_user_id/tenant/role` via `auth.uid()`, SECURITY DEFINER. Aplicada e validada. |
| **RLS completo nas tabelas de evento** | baseline linhas 360–511 — RLS + policies select/insert/update por tenant/role/dono. |
| **Views seguras (M4)** | `supabase/migrations/202606250002_secure_event_views.sql` — view pública + 3 admin `security_invoker`. Validado anon=0. |
| **RPCs de decisão admin (M5)** | `supabase/migrations/202606250003_admin_event_decision_rpcs.sql` — 3 RPCs, validam admin+tenant, EXECUTE só authenticated. Testado no banco. |
| **`getLatestApproval` real** | `src/features/event-approvals/api/event-approvals.service.ts` lê `trx_event_approval`. |
| **Auth no frontend admin** | `ProtectedRoute` exige sessão+admin; `AdminWebLayout` com logout. |
| **Leitura real eventos** | `v_public_approved_events` (público) e `v_master_event_full` (admin/líder, RLS). |
| **Ponte SASI implementada** | `supabase/functions/exchange-sasi-token/index.ts` + `SasiAuthProvider` (deployada, código revisado). |
| **Guards de rota web/mobile** | `ProtectedRoute` / `ProtectedMobileRoute` com `allowedRoles`. |
| **Baseline limpa** | seeds só de catálogos `ref_*`, sem dados de carga. |

---

## 6. Mocks / fallbacks ainda existentes

| Arquivo | Função | Aceitável em dev? | Remover antes de prod? |
|---|---|---|---|
| `src/features/events/api/events.service.ts` | `createEvent`, `deactivate/reactivate`, fallback de leitura | Sim | **Sim** (write); fallback → fail-closed |
| `src/features/event-slots/api/event-slots.service.ts` | `createEventSlot`, `acceptCounterDate`, `rejectCounterDate` | Sim | **Sim** |
| `src/features/event-attendance/api/event-attendance.service.ts` | `confirm/cancelAttendance`, `getMyAttendance`, `listMyAttendances` | Sim | **Sim** |
| `src/features/event-equipment/api/event-equipment.service.ts` | `requestEventEquipment`, `update...` | Sim | **Sim** |
| `src/features/equipment/api/equipment.service.ts` | `listAllEquipment` (fallback) | Sim | Após auth/RLS |
| `src/features/event-approvals/api/event-approvals.service.ts` | fallback mock + `DEFAULT_REVIEWER='user-admin-1'` | Sim | Fallback → fail-closed |
| `src/features/events/mocks/event-storage.mock.ts` + `event.mock.ts` | `seedEventMockData`, STORAGE_KEYS (localStorage) | Sim | Neutralizar quando `IS_TEST=false` |
| `src/modules/admin/events/data/confirmedPeople.mock.ts` | gerador determinístico de pessoas/CSV | Sim | **Sim** (substituir por dados reais) |
| `src/app/constants/currentUser.ts` | `MOCK_*_USER_ID`, `MOCK_TENANT_ID` (deprecated, ainda usados em fallback) | Sim | **Sim** |
| `src/features/sasi-token/api/sasi-token.service.ts` | sessionStorage do token SASI | **Sim — é parte do fluxo real** | Não |
| `src/apps/admin/App.tsx` | localStorage de navegação (UX) | Sim | Não |

**Padrão de risco:** todo service de evento segue `if (hasSupabaseEnv()) { try real } catch { } return mock`. Em produção, qualquer falha de rede/RLS **cai silenciosamente no mock**. Recomenda-se fail-closed quando `getEnvironment()==='production'`.

> Correção a CLAUDE.md: o "fallback hardcoded de labels" do `UserModal` **não existe mais** no código atual (mostra `pagesError` e lista vazia). A nota está desatualizada.

---

## 7. RPCs e escritas faltantes

| Fluxo | RPC existe? | Frontend chama? | Estado | Onde |
|---|---|---|---|---|
| `approve_event` | ✅ | ✅ | **Real** (c/ fallback mock) | `event-approvals.service.ts:51` |
| `reject_event` | ✅ | ✅ | **Real** | `event-approvals.service.ts:106` |
| `propose_counter_date` | ✅ | ✅ | **Real** | `event-approvals.service.ts:76` |
| `create_event_request` | 🔴 | 🔴 | **Pendente** (mock no front) | events/event-slots services |
| `accept_counter_date` | 🔴 | 🔴 | **Pendente** (mock) | event-slots.service.ts |
| `reject_counter_date` | 🔴 | 🔴 | **Pendente** (mock) | event-slots.service.ts |
| `confirm_attendance` | 🔴 | 🔴 | **Pendente** (mock) | event-attendance.service.ts |
| `cancel_attendance` | 🔴 | 🔴 | **Pendente** (mock) | event-attendance.service.ts |
| Criar/editar equipamento (catálogo) | 🔴 (RLS direto permite) | 🔴 | **Mock/direto pendente** | equipment.service.ts |
| Request de equipamento (líder) | 🔴 | 🔴 | **Pendente** (mock) | event-equipment.service.ts |

**Escritas reais já existentes** (não-evento, legado): atendimento via direct insert/update em `master_destination`, `master_supplier`, `master_user`, `trx_attachment`, `ref_*` — governadas por RLS. RPCs de usuários/cargos (`save_user_role_with_permissions`, etc.) reais.

---

## 8. Plano para ficar pronto para produção

### Fase P1 — Bloqueadores (grande)
1. Criar migration **M5-B** com RPCs `create_event_request`, `accept_counter_date`, `reject_counter_date`, `confirm_attendance`, `cancel_attendance` (SECURITY DEFINER, validam role/tenant/dono). *Dep:* Fase 1/2 (prontas).
2. Religar frontend: `createEventSlot`/`confirmAttendance`/etc. → `.rpc(...)` reais; **resolver cadeia slot→approve** (slot persistido antes da aprovação). *Dep:* (1).
3. Configurar `SASI_API_URL` e validar ponte SASI E2E com token de líder real. *Dep:* tenant/líder reais.
- *Risco:* alto. *Ordem:* 1→2 em paralelo com 3.

### Fase P2 — Segurança e dados reais (média)
4. Criar projeto Supabase de produção; aplicar baseline + todas migrations + M5-B em banco vazio.
5. Seed controlado: tenant real, admin real (com `id_auth_user`), líder real. Sem `@loadtest`.
6. **Fail-closed**: desativar fallback mock quando `IS_TEST=false`; tornar erros visíveis. *Dep:* (1,2).
7. Revisar grants `anon`/CORS.

### Fase P3 — UX e qualidade (média)
8. "Pessoas confirmadas" real; aba "Informações" editável; filtros por data; logout mobile.
9. Testes dos fluxos de evento + smoke manual + validação mobile no navegador vs `SASI Eventos Mobile.html`.
10. Loading/erro consistentes.

### Fase P4 — Deploy e operação (média)
11. Vercel: env de prod (`VITE_SUPABASE_URL` prod, `VITE_IS_TEST=false`, `VITE_APP_URL`).
12. Deploy edge functions + secrets no projeto de prod.
13. Observabilidade (logs de erro reais), plano de rollback, smoke test final.

---

## 9. Checklist final de produção

- [ ] Criar projeto Supabase produção
- [ ] Aplicar baseline
- [ ] Aplicar migrations (incl. **M5-B**)
- [ ] Criar tenant real
- [ ] Criar admin real (+ `id_auth_user`)
- [ ] Criar líder real
- [ ] Configurar Auth (provider magiclink/SASI)
- [ ] Deploy Edge Functions
- [ ] Configurar secret `SASI_API_URL` (+ service role)
- [ ] Religar escritas do front para RPCs reais
- [ ] Desativar fallback mock em produção (fail-closed)
- [ ] Configurar env Vercel (`VITE_IS_TEST=false`, URLs)
- [ ] Deploy frontend
- [ ] Testar login admin
- [ ] Testar login SASI (líder/público)
- [ ] Testar fluxo público (ver + confirmar/cancelar presença)
- [ ] Testar fluxo líder (solicitar + contraproposta)
- [ ] Testar fluxo admin (aprovar/reprovar/nova data)
- [ ] Validar RLS anon/auth (anon=0 nas tabelas-base)
- [ ] Validar ausência de dados de teste (`@loadtest`)
- [ ] Rodar typecheck/build/test/lint
- [ ] Smoke test final (web + mobile no navegador)
- [ ] Plano de rollback documentado

---

## 10. Comandos úteis (NÃO executar no momento desta inspeção)

```bash
# Qualidade
npm run typecheck
npm run build
npm run test:run
npm run lint

# Supabase (requer CLI + login no projeto de prod)
supabase link --project-ref <PROD_REF>
supabase db push                      # aplicar migrations
supabase functions deploy exchange-sasi-token
supabase secrets set SASI_API_URL=https://api.sasi.io

# Smoke da edge function
curl -X POST https://<PROD_REF>.functions.supabase.co/exchange-sasi-token \
  -H "Content-Type: application/json" -d '{"token":"<TOKEN_SASI>"}'

# Limpeza de teste (revisar antes; trocar ROLLBACK→COMMIT) — NÃO cobre eventos/master_user hoje
psql -f sql/cleanup-test-data.sql
```

---

## 11. Relatório final

1. **Status geral:** 🔴 **NÃO PRONTO** — base de segurança/leitura pronta; escrita do fluxo de eventos em mock; sem banco de produção.
2. **Bloqueadores:** **8** (5 RPCs faltantes agrupados em "M5-B"; + cadeia quebrada, secret SASI, runtime SASI, banco de prod, tenant/admin/líder reais).
3. **Demais itens:** ALTO **~5**, MÉDIO **~6**, BAIXO **~5**.

**Top 10 riscos**
1. Cadeia slot→approve quebra em produção (RPC com id inexistente).
2. Líder/público não persistem nada (5 RPCs faltando).
3. Login SASI nunca validado em runtime (secret ausente).
4. Fallback mock silencioso servindo dados falsos em produção.
5. `auth.users` vazia / ~500 `@loadtest.com` em `master_user`.
6. Sem banco de produção / sem tenant-admin-líder reais.
7. "Pessoas confirmadas" e CSV são dados fictícios.
8. `grant all to anon` + CORS `*` — dependência total de RLS.
9. Zero testes/observabilidade nos fluxos de evento.
10. Mobile não validado no navegador; sem logout mobile.

**Top 10 próximos passos**
1. Escrever migration M5-B (5 RPCs).
2. Religar escritas do front para RPCs reais.
3. Corrigir cadeia slot→approve.
4. Configurar `SASI_API_URL` e validar ponte E2E.
5. Criar projeto Supabase de produção + aplicar baseline/migrations.
6. Seed real: tenant, admin, líder.
7. Fail-closed do mock em produção.
8. Substituir "pessoas confirmadas" por `trx_event_attendance`.
9. Env Vercel (`VITE_IS_TEST=false`) + deploy.
10. Smoke test completo (web + mobile) + plano de rollback.

**Recomendação objetiva:** ❌ **Não pode subir ainda.** O fluxo transacional central (solicitar/confirmar/responder) não persiste, o login SASI não foi provado em runtime e não há ambiente de produção.

**Caminho mínimo para uma primeira produção segura (MVP):**
São **inegociáveis**: (a) RPCs `create_event_request`, `confirm_attendance`, `cancel_attendance`, `accept/reject_counter_date` + religar o front com a cadeia slot→approve consistente; (b) ponte SASI validada em runtime com `SASI_API_URL`; (c) projeto de produção limpo com baseline+migrations, **um** tenant real, **um** admin e **um** líder; (d) fallback mock desativado em produção; (e) `VITE_IS_TEST=false` e deploy; (f) smoke test dos três fluxos. Sem esses seis, não há produção segura.
