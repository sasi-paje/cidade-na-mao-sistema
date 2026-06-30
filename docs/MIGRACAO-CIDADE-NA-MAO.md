# Migração Bellog → Cidade na Mão

Documento vivo de acompanhamento da migração. Ver também o diagnóstico completo em
[RELATORIO-CIDADE-NA-MAO.md](./RELATORIO-CIDADE-NA-MAO.md).

---

## ⚠️ Prontidão para produção (2026-06-27)

**Status atual: 🔴 NÃO PRONTO PARA PRODUÇÃO.** Relatório completo em
[RELATORIO-PRONTIDAO-PRODUCAO.md](./RELATORIO-PRONTIDAO-PRODUCAO.md).

Motivos principais:
- faltam RPCs do bloco **M5-B** (`create_event_request`, `accept_counter_date`, `reject_counter_date`, `confirm_attendance`, `cancel_attendance`);
- líder/público ainda **escrevem em mock/localStorage**;
- a **ponte SASI não foi validada em runtime real** (secret `SASI_API_URL` ausente → `500`);
- falta **banco de produção limpo** (ambiente atual é homologação, `auth.users`=0, ~500 `@loadtest.com`);
- faltam **tenant/admin/líder reais**;
- o **fallback mock precisa ser desativado em produção** (fail-closed).

### Integração SASI Mobile (planejada)

Plano em [INTEGRACAO-SASI-MOBILE.md](./INTEGRACAO-SASI-MOBILE.md): identificar o usuário pelo
`profile.id` do SASI (`webclient.sasi.com.br`), vinculando `master_user.id_sasi_profile`, mas
**mantendo a emissão de sessão Supabase real** (RLS/RPCs inalterados). **Planejado, ainda não
implementado** — depende de confirmação externa com o SASI: (1) se `/v2/profile/self` retorna
e-mail; (2) se `profile.id` é estável e único; (3) se `https://webclient.sasi.com.br` é o
endpoint oficial; (4) se cada usuário SASI pertence a exatamente um tenant. A migration
`master_user.id_sasi_profile` **não será criada** até confirmar o item 1.

As perguntas oficiais para a equipe SASI foram registradas em
[INTEGRACAO-SASI-MOBILE.md](./INTEGRACAO-SASI-MOBILE.md), seções 14 e 15. A implementação por
`profile.id` segue bloqueada até o retorno dessas respostas.

**Boundary global + captura `?token=` (frontend) — 2026-06-27** (ver
[INTEGRACAO-SASI-MOBILE.md](./INTEGRACAO-SASI-MOBILE.md) §17): `?token=<TOKEN_SASI>` agora
funciona em `/m/*` e `/web/*` via `SasiSessionBoundary` global (mount único em `main.tsx`). Token
é só ponte para sessão Supabase; autorização segue por Supabase Auth + RLS + roles; token só em
`sessionStorage`, limpo após sucesso. Edge function aceita `{ token?, refreshToken? }` (caminho
`refreshToken`/`profile.id` **gated** até confirmação SASI; não redeployada). Local: typecheck/
build ✓, 151 testes ✓, lint sem erro novo.

**Habilitar `?token=` em runtime (2026-06-28) — BLOQUEADO**: secret `SASI_API_URL` e redeploy
**PENDENTES** (sem `supabase` CLI/MCP nesta sessão); smoke com token real não executado; edge
function deployada ainda em `500`. Detalhes em
[INTEGRACAO-SASI-MOBILE.md](./INTEGRACAO-SASI-MOBILE.md) §18. Script
`scripts/supabase/deploy-exchange-sasi-token.ps1` e checklist
[SMOKE-SASI-TOKEN.md](./SMOKE-SASI-TOKEN.md) **preparados** para rodar em ambiente com CLI.

### Smoke test frontend (dev local / homologação) — 2026-06-27

Vite dev (`http://localhost:5173`) lendo o banco de homologação `tfupwytzrkpzocfxheeq`,
dirigido via browser (Playwright). Detalhes em
[RELATORIO-PRONTIDAO-PRODUCAO.md](./RELATORIO-PRONTIDAO-PRODUCAO.md) (seção "Smoke test
frontend").

- ✅ `/` respondeu 200; `src/main.tsx` compilou sem erro.
- ✅ `/m/eventos` renderizou com **dados reais da view pública** (Supabase, não mock).
- ✅ `/web/eventos` **bloqueou corretamente** sem sessão (guard admin).
- ✅ **0 erros** de console/runtime; layout mobile + paleta Cidade na Mão aplicados.
- ⛔ Fluxos autenticados **não testados** (dependem da ponte SASI em runtime).
- ⚠️ Dados exibidos são **sintéticos de homologação**.
- 🔴 Produção **continua bloqueada** pelos itens já registrados.

---

## Decisões aprovadas (Seção 13 do relatório)

1. **Roteamento:** adotar `react-router-dom`. Rotas reais `/m/*` (público/líder) e `/web/*` (admin). Abandonar navegação manual via `window.location.pathname` + state/localStorage para a navegação principal.
2. **Apps/layouts:** uma única app React com duas áreas — pública/mobile (`/m/*`, layout `PublicMobileLayout`/`MobileLayout`) e admin/web (`/web/*`, layout `AdminWebLayout`).
3. **Feature `companies`:** não remover; renomear/adaptar para **`organizations`** (representa comunidade, prefeitura, secretaria, organização responsável). Conceito de tenant/cidade fica separado em `lib/tenant`.
4. **Auth:** perfil mockado por enquanto (público | líder | admin), arquitetura preparada para Supabase Auth + profiles/roles/permissions + `tenant_id`/`user_id` + RLS no futuro.
5. **Paleta:** aplicar Cidade na Mão — primary-dark `#0f3255`, primary-default `#1e558b`, secondary-lighter `#bdcde8`, neutral `#919191`. Substituição gradual, sem quebrar layout.

---

## Etapa 1 — Renomear identidade e preparar base ✅ (2026-06-24)

### Renomeado (identidade visível)
| Local | De | Para |
|---|---|---|
| `package.json` → `name` | `bellog` | `cidade-na-mao` (+ `description`) |
| `index.html` → `<title>` | `bellog` | `Cidade na Mão` (+ meta description, `lang="pt-BR"`) |
| `src/main.tsx` | "Carregando Bellog..." / comentário "Bellog Bootstrap" | "Carregando Cidade na Mão..." / "Cidade na Mão Bootstrap" |
| `src/layouts/MainLayout.tsx` | `alt="Bellog Logo"` / `"Bellog Logo Mini"` | `alt="Cidade na Mão"` |
| `src/modules/auth/LoginPage.tsx` | `alt="Bellog Logo"` / `"Bellog Illustration"` | `alt="Cidade na Mão"` |
| `src/modules/auth/FirstAccessPage.tsx` | idem | `alt="Cidade na Mão"` |
| `src/modules/auth/ForgotPasswordPage.tsx` | idem | `alt="Cidade na Mão"` |
| `src/shared/components/Toolbar/ToolbarTokens.ts` | comentário "...toolbars do Bellog" | "...toolbars do Cidade na Mão" |

### Chaves locais renomeadas (com fallback)
| Local | De | Para | Fallback |
|---|---|---|---|
| `src/apps/admin/App.tsx` | `bellog-current-page` | `cidade-na-mao-current-page` | lê chave antiga se a nova não existir |
| `src/modules/events/data/mockEvents.ts` | `bellog:mock-public-events` | `cidade-na-mao:mock-public-events` | n/a (protótipo) |

### Paleta (tokens centrais)
`tailwind.config.js` → `colors.primary` = { DEFAULT `#1e558b`, dark `#0f3255`, light `#bdcde8` } + novo `colors.secondary.lighter` = `#bdcde8`. `neutral.gray` já era `#919191`.

### Criados (scaffold de roteamento — inativos)
- `src/app/routes/routePaths.ts` — mapa central de paths (sem dependências, já utilizável)
- `src/app/routes/AppRoutes.tsx`, `PublicRoutes.tsx`, `AdminRoutes.tsx` — placeholders retornando `null`, **sem** import de react-router (não afetam build/runtime; documentam a estrutura-alvo)

### react-router-dom
**Não está instalado** e **não foi instalado automaticamente** (conforme regra). Comando para a Etapa 4:
```bash
npm install react-router-dom
```

---

## O que NÃO foi tocado nesta etapa
- Módulos/features de logística (routes, notes, vehicles, drivers, assignments, xml-import, delivery...) — saem na Etapa 2.
- Backend: Supabase, edge functions, tabelas, RLS, migrations, `supabase/`.
- Bucket de storage `bellog-files` e coluna de banco `bellog_arrival_date` (identificadores de dados — trocar junto com o backend).
- Nomes de arquivos de assets (`bellog-logo.svg` etc.) e símbolos de export `BellogLogo`/`BellogLogoMini` (refactor de assets fica para quando houver a nova marca).
- `CLAUDE.md` (documenta o sistema atual; será atualizado quando a arquitetura mudar).
- Label "Chegada Bellog" e comentários internos em módulos de logística (saem com os módulos na Etapa 2).

---

## Pendências / decisões futuras
- Definir a nova marca/logo do Cidade na Mão (substituir assets `brand/` e renomear símbolos).
- Decidir estratégia de auth do público/líder (Supabase Auth para todos?).
- Confirmar se `companies` → `organizations` mantém papéis ou simplifica.
- Renomear bucket de storage e coluna `bellog_arrival_date` na etapa de backend.

## Riscos monitorados
- Recolorir tokens `primary` afeta toda a UI de logística existente (esperado; não quebra layout).
- Scaffolds de rota não podem importar react-router até a instalação (mantidos sem import).
- Navegação principal ainda é manual até a Etapa 4 — não criar telas novas dependendo de react-router antes disso.

---

---

## Etapa 2 — Remover domínio de logística ✅ (2026-06-24)

### Pastas/arquivos removidos
- **Features:** `routes`, `routes-card`, `routes-history`, `notes`, `assignments`, `vehicles`, `drivers`, `xml-import`, `import`
- **Modules:** `routes`, `notes`, `assign-notes`, `my-routes`, `delivery`, `arrival-client`, `vehicles`, `settings` (inteiro)
- **Mobile:** `apps/mobile/services/` (auth SASI + driver repository + external-provider)
- **Hooks:** `useAssignments`, `useDrivers`, `useFiscalInvoices`, `useRouteHistory`, `useRoutes`, `useVehicles`, `useMotivos`, `useSuppliers`, `useDestinations`
- **Types:** `shared/types/routes.ts` (+ pasta `shared/types/` vazia removida)

### Arquivos reescritos
- `apps/admin/App.tsx` → admin mínimo: auth + Usuários + Home placeholder (removidos todos os imports de logística)
- `apps/mobile/App.tsx` → placeholder (sem auth SASI, sem telas de motorista)
- `layouts/MainLayout.tsx` → menu mínimo (Início + Usuários); removidos Rotas/Notas/Rotas por Notas/Atribuir Notas/Configurações; removido import `ReactElement` não usado
- `main.tsx` → `isMobilePath` agora detecta `/m/*`; removido o tratamento de URL legada (SASI/page)

### Mantidos (base reaproveitável)
Features `users`, `roles`, `email`, `storage`, `attachments`, `companies`, `cnpj`, `company-resolver` · Modules `auth`, `users`, `events` · `shared/*`, `layouts/Sidebar`, `lib/*`, `app/routes`, `testing/factories`, hooks `useCompanies`/`useLoadingFeedback`/`useRealtime`/`useRefData`.

### Validação
- `tsc --noEmit`: **EXIT 0** ✅
- `vite build`: **EXIT 0** ✅ (bundle caiu de ~582 kB para ~82 kB no chunk principal)
- `eslint`: erros remanescentes são **pré-existentes** (fast-refresh em main.tsx, dep-warning em AdminApp, edge functions em `supabase/functions`). Nenhum erro novo introduzido. A remoção eliminou muitos erros antigos de logística.

### Termos de logística ainda presentes (intencional, fora do escopo desta etapa)
- **Identidade Bellog (assets/backend):** símbolos `BellogLogo`/`BellogLogoMini` e arquivos `brand/bellog-*.svg|png` (Icon.tsx, icons/index.ts, components/index.ts, MainLayout, auth pages); bucket `bellog-files` (storage/attachment); coluna `bellog_arrival_date` e chave legada `bellog-current-page` (fallback proposital).
- **Schema logística no front:** `lib/supabase.ts` (interface `Database` com `trx_route`/`trx_fiscal_invoice`/`master_fleet_vehicle`/...) — schema não alterado nesta etapa.
- **`testing/factories.ts`:** `makeRoute`/`makeInvoice`/`makeVehicle`/`makeDriver` — mantido; adaptar na Etapa 9.
- **Acoplamento dentro de `companies`:** `canInactivateDestination`/`canInactivateSupplier` consultam `trx_fiscal_invoice`; `useRealtime` lista nomes de tabela logística; `attachments` tem tipos `fiscal_invoice`/`route_invoice_delivery`. Tratar ao adaptar `companies → organizations`.
- **Ícones logística em `shared/components`:** `RoutesIcon`/`RoutesByNotesIcon` e nomes (`road`, `delivery_truck_speed`, `pallet`...) — genéricos, podar quando conveniente.

### Recomendação de nome para `companies`
**`organizations`** (mantida a recomendação da Etapa 1). Cobre comunidade/prefeitura/secretaria/organização responsável; `communities` é estreito e `entities` colide com o `Entity` base de DDD. ⚠️ Ao renomear, limpar o acoplamento logística interno (`canInactivateDestination`/`canInactivateSupplier` → revisar regra de inativação sem `trx_fiscal_invoice`). Não renomeado ainda (é mudança grande).

---

---

## Etapa 3 — Domínio base de eventos ✅ (2026-06-24)

### Arquitetura criada (6 features, padrão Bellog `types/ api/ hooks/ index.ts`)
`features/events`, `features/event-slots`, `features/event-equipment`, `features/equipment`, `features/event-approvals`, `features/event-attendance`. O "banco em memória" (localStorage + acessores + seed + join) ficou centralizado em `features/events/mocks/` e os demais services o consomem. Tudo async (Promise), espelhando a futura API Supabase.

### Protótipo antigo
`src/modules/events/` (modelo `PublicEvent` simples) foi **mantido intacto** — não é importado por ninguém e será religado/substituído pelas telas da Etapa 4. O novo `usePublicEvents` vive em `features/events` (sem conflito).

### Types criados
- **events:** `EventMaster`, `EventFullView`, `CreateEventInput`, `WebEventFilters`
- **event-slots:** `EventSlot`, `SlotStatusCode` (`pending|approved|counter_proposed|rejected|inactive`), `CreateEventSlotInput`, `SLOT_STATUS_IDS`
- **equipment:** `Equipment`
- **event-equipment:** `EventEquipmentRequest`, `EquipmentRequestInput`
- **event-approvals:** `EventApproval`, `ApprovalDecisionCode` (`approved|counter_proposed|rejected`), `CreateEventApprovalInput`, `CounterProposalInput`, `APPROVAL_DECISION_IDS`
- **event-attendance:** `EventAttendance`, `AttendanceStatusCode` (`confirmed|cancelled`), `ConfirmAttendanceInput`, `CreateAttendanceInput`, `ATTENDANCE_STATUS_IDS`

### Services criados (todos Promise)
- **events.service:** createEvent, getEventById, listPublicApprovedEvents, listLeaderEventRequests, listPendingEventRequests, listWebEvents, deactivateEvent, reactivateEvent
- **event-slots.service:** createEventSlot, getEventSlot, acceptCounterDate, rejectCounterDate
- **event-equipment.service:** requestEventEquipment, listEventEquipmentRequests
- **equipment.service:** listEquipment, getEquipmentById
- **event-approvals.service:** approveEvent, proposeCounterDate, rejectEvent
- **event-attendance.service:** confirmAttendance, cancelAttendance, getMyAttendance, listMyAttendances, listEventAttendances

### Hooks criados
usePublicEvents, useEventById, useEventRequests, useWebEvents, useEventRequestFlow (orquestra createEvent→createEventSlot→requestEventEquipment), useEquipment, useEventSlot, useEventEquipment, useEventApproval, useEventAttendance, useMyAttendances. Query → `{ data, loading, error, refetch }`; mutação → função(ões) + `loading`/`error`.

### Chaves localStorage
`cidade-na-mao:events`, `cidade-na-mao:event-slots`, `cidade-na-mao:event-equipment-requests`, `cidade-na-mao:event-approvals`, `cidade-na-mao:event-attendances`, `cidade-na-mao:equipments`.

### Regras implementadas
Público só vê `slot_status === 'approved' && is_active`; participação = `id_event+id_slot+id_user` sem duplicidade ativa; cancelar = status `cancelled` (preserva histórico); aprovar → slot `approved`; contraproposta → slot `counter_proposed` + `counter_date`; reprovar → slot `rejected`; recusa de contraproposta → evento inativado + slot `inactive`.

### `buildEventFullView()`
Join em memória: para cada slot, busca o evento (Map por id), conta participações `confirmed` do trio evento/slot, anexa as solicitações de equipamento (join com catálogo) e devolve `EventFullView[]` — uma linha por slot. Simula `v_master_event_full`.

### Seed (`seedEventMockData()`)
Idempotente (só popula se a chave `events` não existir). 5 eventos cobrindo todos os estados (approved/pending/counter_proposed/rejected/inactive), 7 equipamentos (Microfone, Palco, Caixa de Som, Iluminação, Tenda, Mesa, Cadeira), solicitações de equipamento, 3 aprovações e 4 participações (3 confirmadas + 1 cancelada).

### Validação
- `tsc --noEmit`: **EXIT 0** ✅
- `vite build`: **EXIT 0** ✅ (bundle inalterado — features ainda não importadas pelas telas, tree-shaken)
- `eslint` nas features novas: **0 erros** ✅; total `src/` permanece **62** (pré-existentes), nenhum novo.

### Pendências
- Religar as telas (`modules/events`) ao novo domínio — Etapa 4.
- `id_reviewed_by` em aprovações usa default `user-admin-1` até a auth/perfis (Etapa 7).
- `id_tenant`/`id_user` virão do contexto de auth no futuro (hoje vêm como input).

---

---

## Etapa 4 — React Router + fluxo público religado ✅ (2026-06-24)

### Pacote instalado
`react-router-dom@^7.18.0` (dependência em `package.json`, lock atualizado, sem erro de instalação).

### Roteamento real (substitui o manual)
`main.tsx` agora envolve o app em `<BrowserRouter>` + `<AppRoutes/>`. Removidos `isMobilePath`/`window.location` da navegação principal.

| Rota | Tela | Status |
|---|---|---|
| `/` | → redireciona `/m/eventos` | ativo |
| `/m/eventos` | `PublicEventsPage` (domínio novo) | **religado** |
| `/m/eventos/:id` | `PublicEventDetailsPage` (domínio novo) | **religado** |
| `/m/meus-eventos` | `MyEventsPage` (domínio novo) | **religado** |
| `/m/eventos-solicitados` · `/:id` · `/m/solicitar-evento` | `Placeholder` líder | placeholder (Etapa 5) |
| `/web/eventos` · `/web/eventos/:id` | `Placeholder` admin (AdminWebLayout) | placeholder (etapa admin) |
| `/login`, `/reset-password` | `AdminApp` (auth Supabase legada) | preservado |
| `*` | 404 | ativo |

### Layouts
- `app/layouts/MobileLayout.tsx` — `/m/*`, container claro centralizado (max 560px), sem sidebar, com `<Outlet/>`.
- `app/layouts/AdminWebLayout.tsx` — `/web/*`, header simples + `<Outlet/>` (sidebar definitiva fica para a etapa admin).

### Telas conectadas ao domínio novo (`EventFullView`, não mais `PublicEvent`)
- `modules/public/events/PublicEventsPage` → `usePublicEvents()` (só `slot_status='approved' && is_active`); card navega para `/m/eventos/:id_event`.
- `modules/public/events/PublicEventDetailsPage` → `useEventById(id)` + `useEventAttendance(id_event, id_slot, user)`; botão "Quero participar!"/"Cancelar participação" via `confirmAttendance`/`cancelAttendance` (trio `id_event+id_slot+id_user`).
- `modules/public/events/MyEventsPage` → `useMyAttendances(user)` cruzado com `useWebEvents()`.
- `EventCard` (consome `EventFullView`, formata `requested_at`, mostra `confirmed_count`/`capacity`) e `EventsTabs` (navegação via `useNavigate`).
- Usuário mockado: `MOCK_PUBLIC_USER_ID = 'user-public-mock-001'` em `app/constants/currentUser.ts`.

### Arquivos criados
`app/layouts/MobileLayout.tsx`, `app/layouts/AdminWebLayout.tsx`, `app/constants/currentUser.ts`, `app/routes/Placeholder.tsx`, `utils/eventDate.ts`, `modules/public/events/{EventCard,EventsTabs,PublicEventsPage,PublicEventDetailsPage,MyEventsPage}.tsx`.

### Arquivos alterados
`main.tsx`, `app/routes/AppRoutes.tsx`, `app/routes/PublicRoutes.tsx`, `app/routes/AdminRoutes.tsx`, `package.json`/lock.

### Removidos
`modules/events/` (protótipo antigo `PublicEvent`, superseded) e `apps/mobile/` (placeholder substituído pelo router). Verificado: nenhum import remanescente.

### Roteamento manual antigo
Eliminado da navegação principal. Resta apenas dentro de `AdminApp` (legado, navegação por state `home/users` + leitura de `window.location` para o callback de reset), isolado nas rotas `/login` e `/reset-password`. Será reformulado na etapa admin.

### Decisão sobre layouts
Optou-se por **dois layouts** (`MobileLayout` para `/m/*`, `AdminWebLayout` para `/web/*`), conforme decisão 2 da Seção 13. `MainLayout` (Bellog) permanece apenas dentro do `AdminApp` legado.

### Validação
- `tsc --noEmit`: **EXIT 0** ✅
- `vite build`: **EXIT 0** ✅
- `eslint`: arquivos novos **0 erros**; total `src/` caiu 62→**58**; únicos erros nos alterados são 2 fast-refresh pré-existentes em `main.tsx` (eram 3). Nenhum erro novo.
- `vitest run`: **86/86** testes passam.
- Smoke test temporário (jsdom, depois removido): validou listar-aprovados → confirmar → aparecer em Meus Eventos → sem duplicidade → cancelar → sair de Meus Eventos → histórico `cancelled` preservado.

### Pendências para Etapa 5
- Placeholders do líder (`/m/eventos-solicitados`, `/m/solicitar-evento`, `/m/eventos-solicitados/:id`) → telas reais consumindo `useEventRequests`, `useEventRequestFlow`, `useEventSlot` (aceitar/recusar contraproposta).
- Auth real do público/líder (hoje `user-public-mock-001`).
- Reformular `AdminApp`/auth dentro do novo router (etapa admin).

---

---

## Etapa 5 — Fluxo do Líder da Comunidade ✅ (2026-06-24)

### Rotas do líder (saíram de placeholder)
| Rota | Tela | Hooks |
|---|---|---|
| `/m/eventos-solicitados` | `MyEventRequestsPage` | `useEventRequests(leader)` |
| `/m/solicitar-evento` | `RequestEventPage` (wizard 3 etapas) | `useEventRequestFlow`, `useEquipment` |
| `/m/eventos-solicitados/:id` | `EventRequestDetailsPage` | `useEventById`, `useEventSlot`, `useLatestApproval` |

### Arquivos criados
- **Páginas:** `modules/community-leader/event-requests/pages/{MyEventRequestsPage,RequestEventPage,EventRequestDetailsPage}.tsx`
- **Componentes:** `components/{EventRequestCard,EventRequestStatusBadge,RequestEventForm,RequestEventStepHeader,EquipmentRequestSelector,CounterProposalActions}.tsx`
- **Domínio (adições mínimas):** `features/event-approvals/api` → `getLatestApproval()` + `features/event-approvals/hooks/useLatestApproval.ts` (para exibir motivo da contraproposta/reprovação)

### Arquivos alterados
- `app/routes/PublicRoutes.tsx` (placeholders do líder → páginas reais)
- `app/constants/currentUser.ts` (+ `MOCK_LEADER_USER_ID = 'user-leader-mock-001'`, `MOCK_TENANT_ID = 'tenant-itabira'`)
- `features/events/mocks/event.mock.ts` (`LEADER` do seed → `user-leader-mock-001`, para o líder mock enxergar o seed)
- `features/event-slots/api/event-slots.service.ts` (`acceptCounterDate`/`rejectCounterDate` agora chamam `seedEventMockData()` — auto-suficientes)
- `features/event-approvals/index.ts` (exporta `getLatestApproval`/`useLatestApproval`)

### Wizard de solicitação (modelo real)
- **Etapa 1 (master_event):** nome, local, banner (URL), descrição.
- **Etapa 2 (trx_event_slot):** dia (`date`) + hora (`time`) → `requested_at`; vagas (`number`).
- **Etapa 3 (trx_event_equipment_request):** seletor de equipamentos (`useEquipment`), quantidade ≥ 1, impede item vazio, atualiza quantidade se já existir (com feedback).
- Submit → `useEventRequestFlow.submit` (createEvent → createEventSlot → requestEventEquipment) → navega para o detalhe; nasce `pending`.

### Comportamento por status (detalhe da solicitação)
| Status | Exibição | Ações |
|---|---|---|
| `pending` | "Aguardando análise da gestão" | — |
| `approved` | "Evento aprovado pela gestão" | — |
| `counter_proposed` | "Nova data proposta" + data + motivo | Aceitar (`acceptCounterDate` → `approved`) / Recusar (`rejectCounterDate` → `inactive` + evento inativado) |
| `rejected` | "Solicitação reprovada" + motivo (se houver) | — |
| `inactive` | "Solicitação inativa" | — |

Badge de status: pending=Aguardando aprovação, approved=Aprovado, counter_proposed=Nova data proposta, rejected=Reprovado, inactive=Inativo.

### Navegação
Somente `Link`/`useNavigate`/`useParams`. Tabs reutilizam `EventsTabs` (aba "Eventos Solicitados" fica ativa pela rota). Sem `window.location`/`localStorage` nas telas.

### Validação
- `tsc --noEmit`: **EXIT 0** ✅ · `vite build`: **EXIT 0** ✅
- `eslint`: total `src/` permanece **58** (pré-existentes); 1 erro novo foi introduzido e **corrigido** (const exportada em arquivo de componente → tornada local). Nenhum erro novo remanescente.
- `vitest run`: **86/86** ✅
- Smoke test temporário (jsdom, removido): líder vê 5 solicitações do seed (1 de cada status); fluxo create→slot→equipment nasce `pending` e aparece na lista; aceitar contraproposta → `approved`; recusar → `inactive` + evento inativado.

### Pendências para Etapa 6
- Auth/perfil real (hoje `user-leader-mock-001`/`user-public-mock-001`).
- Motivo da contraproposta/reprovação depende de `getLatestApproval` (mock) — virá da tabela `trx_event_approval` no backend.

---

---

## Etapa 6 — Tela web/admin de eventos (listagem) ✅ (2026-06-25)

### Rota
`/web/eventos` (placeholder → `WebEventsPage`) sob `AdminWebLayout`. `/web/eventos/:id` permanece placeholder (detalhe admin = próxima etapa).

### Arquivos criados
- `modules/admin/events/pages/WebEventsPage.tsx`
- `modules/admin/events/components/{WebEventsToolbar,WebEventCard,WebEventsPagination,EventStatusBadge}.tsx`

### Arquivos alterados
- `app/routes/AdminRoutes.tsx` (liga `WebEventsPage`)
- `docs/MIGRACAO-CIDADE-NA-MAO.md`

### Componentes / hooks
- Hook: `useWebEvents()` (domínio novo, `EventFullView`). Sem mock antigo, sem `PublicEvent`.
- Reaproveitado: `AdminWebLayout`, `MaterialIcon` (Material Symbols), `formatEventDateTime`, `buildPath`/`ADMIN_ROUTES`.

### Filtros (frontend)
- **Busca por nome:** filtra `title` em tempo real (botão de busca = submit no-op, filtro já é live).
- **Toggle "Mostrar apenas Pendentes":** quando ativo, só `slot_status === 'pending'`.
- Mudança de filtro reseta a paginação para a página 1 (sem `useEffect` — feito nos handlers, para não violar lint `set-state-in-effect`).

### Paginação (frontend)
9 cards por página; controles `<<` `<` "X de Y" `>` `>>`; botões desabilitam na primeira/última página; `currentPage` é clampada ao total.

### Status badge (admin)
pending→"Pendente" (amarelo) · approved→"Confirmado" (verde) · counter_proposed→"Validando nova data" (azul) · rejected→"Reprovado" (vermelho) · inactive→"Inativo" (cinza).

### Placeholders não-bloqueantes (modal "Entendi")
- **Adicionar Novo:** "Criação pelo admin será definida depois."
- **Calendário:** "Filtro por data será definido em breve."
- **Editar (lápis):** "Edição de \"<título>\" será definida em breve."

### "Abrir Informações"
Navega para `/web/eventos/:id_event` via `useNavigate` + `buildPath` (sem `window.location`).

### Layout / responsividade
Toolbar `flex-wrap` (linha no desktop, quebra sem estourar no mobile/tablet). Grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (mobile 1 / tablet 2 / desktop 3, igual ao Figma), cards `aspect-[16/9]`, sem largura fixa, sem scroll horizontal.

### Validação
- `tsc --noEmit`: **EXIT 0** ✅ · `vite build`: **EXIT 0** ✅
- `eslint`: total `src/` permanece **58** (pré-existentes); 1 erro novo introduzido (`set-state-in-effect`) e **corrigido**. Nenhum novo remanescente.
- `vitest run`: **86/86** ✅
- `/web/eventos` e `/web/eventos/evt-1` → HTTP 200 no dev server.

### Pendências (próxima etapa)
Detalhe admin `/web/eventos/:id`: Informações, Pessoas Confirmadas, Equipamentos Solicitados, Aprovar, Reprovar, Propor nova data (`useEventById`, `useEventApproval`, `listEventAttendances`, `listEventEquipmentRequests`). Modal de edição e "Adicionar Novo" definitivos.

---

---

## Etapa 6.1 — Modal "Novo Evento" (web/admin) ✅ (2026-06-25)

### Arquivos criados
- `modules/admin/events/components/NewEventModal.tsx` (overlay + shell + validação)
- `modules/admin/events/components/NewEventInfoStep.tsx` (campos do formulário)
- `modules/admin/events/components/BannerUploadField.tsx` (upload base64 + preview + remover)
- `modules/admin/events/components/newEvent.model.ts` (tipos + `EMPTY_NEW_EVENT_FORM`, separados para não violar lint fast-refresh)

### Arquivos alterados
- `modules/admin/events/pages/WebEventsPage.tsx` (estado `isNewEventModalOpen`; "Adicionar Novo" abre o modal)
- `docs/MIGRACAO-CIDADE-NA-MAO.md`

### Comportamento
- **Adicionar Novo:** abre o modal "Novo Evento" (painel branco à direita, overlay escuro).
- **Voltar / clicar fora:** fecha o modal e limpa o formulário.
- **Continuar:** valida obrigatórios (banner, nome, dia, hora, local, vagas≥1, descrição). Se faltar algo → bordas vermelhas + "Preencha todos os campos obrigatórios". Se ok → placeholder interno "Etapa de equipamentos será implementada em seguida" (sem fechar, sem criar evento).
- **Banner:** `FileReader` → base64 no estado; preview `aspect-[16/9]` com botão remover. Sem storage.

### Layout
Header `calendar_month` + "Novo Evento" + divisória; conteúdo com scroll interno; rodapé fixo com divisória e Voltar/Continuar. `w-full max-w-2xl` (sem largura fixa), painel full-height à direita (`sm:justify-end`), 1 coluna no mobile / Dia+Hora em 2 colunas no `sm+`. Inputs 45px, borda `#0f3255`, foco `#1e558b`, radius 5px. Ícones Material Symbols (`calendar_month`, `attach_file`, `close`).

### Validação
- `tsc --noEmit`: **EXIT 0** ✅ · `vite build`: **EXIT 0** ✅
- `eslint`: total `src/` = **58** (pré-existentes); 1 erro novo (`only-export-components`) introduzido e **corrigido** (modelo movido para `newEvent.model.ts`). Nenhum novo remanescente.
- `vitest run`: **86/86** ✅ · `/web/eventos` → HTTP 200; `/m/eventos` intacto.

### Pendências
- Próxima etapa do modal: equipamentos + criação definitiva (`useEventRequestFlow` ou service admin) e persistência do banner.

---

---

## Etapa 6.2 — Modal "Editar Evento" / aba Equipamentos Solicitados ✅ (2026-06-25)

### Arquivos criados
- `modules/admin/events/components/EditEventModal.tsx` (shell + abas + footer + save)
- `modules/admin/events/components/EditEventEquipmentTab.tsx` (tabela add/remover; exporta `type EquipItem`)
- `modules/admin/events/components/EditEventInfoTab.tsx` (resumo read-only — placeholder)

### Arquivos alterados
- `features/event-equipment/api/event-equipment.service.ts` → **novo** `updateEventEquipmentRequests(idEvent, items)` (substitui os equipamentos do evento no localStorage, preserva os demais; async/Promise; retorna lista com join do catálogo)
- `features/event-equipment/index.ts` (exporta a nova função)
- `modules/admin/events/pages/WebEventsPage.tsx` (estado `editingEvent`; botão editar abre o modal; `refetch` no `onSaved`; `key` por evento para reinicializar)
- `docs/MIGRACAO-CIDADE-NA-MAO.md`

### Comportamento
- **Botão editar (lápis)** no card → `setEditingEvent(event)` abre o modal "Editar Evento" (overlay escuro; `key={id_event}` garante estado fresco por evento).
- **Abas:** "Informações" (read-only por enquanto) e "Equipamentos Solicitados" (ativa por padrão), com underline azul na ativa.
- **Tabela de equipamentos:** carrega de `event.equipment_requests`; catálogo via `useEquipment`. Linha de adição (select equipamento + select quantidade 1–20 + botão `add_circle`). Regras: exige equipamento; quantidade ≥ 1; se já existe → atualiza a quantidade (com feedback); remover por linha (`delete`).
- **Cancelar / X / clicar fora:** fecham e **descartam** alterações (estado local some no remount via `key`).
- **Salvar:** `updateEventEquipmentRequests(id_event, items)` → `onSaved` (refetch da lista) → fecha. Reabrir mostra os equipamentos persistidos.

### Service
**Criado** `updateEventEquipmentRequests` (não existia). Mantém o padrão do domínio (Etapa 3), só toca o evento alvo.

### Validação
- `tsc --noEmit`: **EXIT 0** ✅ · `vite build`: **EXIT 0** ✅
- `eslint`: total `src/` = **58** (pré-existentes), **nenhum erro novo** (tipos separados/exports de componente OK).
- `vitest run`: **86/86** ✅ + smoke test temporário (removido): substituir equipamentos do `evt-1` não afeta `evt-2`; persistência confirmada.
- `/web/eventos` → HTTP 200; `/m/eventos` e fluxo do líder intactos.

### Pendências
- Aba "Informações" do editar: edição real dos dados do evento (hoje read-only).
- "Novo Evento": etapa de equipamentos + criação definitiva.

---

---

## Etapa 7 — Detalhe admin `/web/eventos/:id` (aprovar / sugerir nova data) ✅ (2026-06-25)

### Rota
`/web/eventos/:id` (placeholder → `WebEventDetailsPage`) sob `AdminWebLayout`. Aberto via "Abrir Informações" no card. `X` → `useNavigate(ADMIN_ROUTES.events)`.

### Arquivos criados
- `pages/WebEventDetailsPage.tsx`
- `components/{EventDetailsInfoTab,EventConfirmedPeopleTab,EventRequestedEquipmentTab,ApproveEventModal,SuggestNewDateModal}.tsx`
- `data/confirmedPeople.mock.ts` (gera Nome/Email determinístico a partir de `confirmed_count` + `buildPeopleCsv`)

### Arquivos alterados
- `app/routes/AdminRoutes.tsx` (liga `WebEventDetailsPage`; remove placeholder)
- `app/constants/currentUser.ts` (+ `MOCK_ADMIN_USER_ID`)
- `utils/eventDate.ts` (+ `formatEventDay`, `formatEventTime`)
- `docs/MIGRACAO-CIDADE-NA-MAO.md`

### Abas
- **Informações:** Status (badge), Banner, Nome, Dia (`calendar_month`), Hora, Local (`location_on`), Descrição, Vagas.
- **Pessoas Confirmadas:** total ("N pessoas confirmadas") + botão "Baixar relação" (CSV Nome,Email via Blob) + tabela Nome/Email (mock derivado de `confirmed_count`).
- **Equipamentos Solicitados:** tabela Equipamento/Quantidade de `event.equipment_requests`; estado vazio "Nenhum equipamento solicitado".

### Footer (por status)
- `pending` → "Sugerir nova Data" + "Aprovar".
- `approved`/`rejected`/`inactive`/`counter_proposed` → sem ações; mostra badge + nota ("Evento confirmado.", "Validando nova data sugerida.", etc.).

### Modal "Aprovar Evento"
Título + texto + tabela Equipamentos/Quantidade. **Cancelar** fecha sem alterar. **Aprovar** → `useEventApproval.approve(id_event, id_slot)` → refetch do detalhe → status `approved` → card vira "Confirmado" ao voltar.

### Alerta de equipamentos indisponíveis (regra mock)
Indisponível quando `quantidade_solicitada > equipment.quantity` (catálogo). Linha em vermelho + mensagem "Os equipamentos marcados não estão disponíveis na data solicitada". **Decisão: botão "Aprovar" permanece HABILITADO** (conforme o Figma) — é apenas aviso visual nesta etapa.

### Modal "Sugerir Nova Data"
Data Inicial (read-only, data atual do evento) + Data sugerida (`type=date`, obrigatória). **Sugerir** → `useEventApproval.proposeCounter({ id_event, id_slot, id_reviewed_by, counter_date, reason })` (reason padrão "Nova data sugerida pela gestão"; mantém a hora original na nova data) → refetch → status `counter_proposed` → card vira "Validando nova data".

### Services/hooks
`useEventById` (+refetch), `useEventApproval` (`approve`/`proposeCounter`), `EventFullView` (`equipment_requests`/`confirmed_count`/`counter_date`). Sem novos services no domínio. Reaproveitados: `EventStatusBadge`, `MaterialIcon`, `formatEventDay`/`formatEventTime`/`formatEventDateTime`, `AdminWebLayout`.

### Validação
- `tsc --noEmit`: **EXIT 0** ✅ · `vite build`: **EXIT 0** ✅
- `eslint`: total `src/` = **58** (pré-existentes), **nenhum erro novo**.
- `vitest run`: **86/86** ✅ + smoke test temporário (removido): aprovar pendente→`approved`; sugerir→`counter_proposed`+`counter_date`; pessoas mock = `confirmed_count`.
- `/web/eventos/:id` e `/m/eventos` → HTTP 200.

### Pendências
- "Reprovar" (existe `rejectEvent` no domínio; o Figma deste detalhe só traz Aprovar/Sugerir — adicionar quando houver tela).
- Disponibilidade real de equipamento por data (`v_master_equipment_availability`) no backend.
- Pessoas confirmadas reais (nome/e-mail) quando houver cadastro de usuários.
- Edição real de informações; criação definitiva pelo admin ("Novo Evento").

---

---

## Etapa 8 — Tela web/admin de Equipamentos ✅ (2026-06-25)

### Rota / menu
`/web/eventos` e `/web/eventos/:id` mantidas; **adicionada** `/web/equipamentos` → `WebEquipmentPage`. `AdminWebLayout` agora tem menu superior com **Eventos** | **Equipamentos** (`NavLink`, ativo destacado).

### Arquivos criados
- `modules/admin/equipment/pages/WebEquipmentPage.tsx`
- `modules/admin/equipment/components/{EquipmentToolbar,EquipmentTable,EquipmentPagination,CreateEquipmentModal,EquipmentDetailsModal,EquipmentForm}.tsx`
- `modules/admin/equipment/components/equipmentForm.model.ts` (tipos/validação/conversão do form)
- `features/equipment/hooks/useAllEquipment.ts`

### Arquivos alterados
- `features/equipment/api/equipment.service.ts` → **novos**: `listAllEquipment`, `createEquipment`, `updateEquipment`, `setEquipmentActive` (+ tipo `EquipmentInput`). `listEquipment` (público/líder, só ativos) **inalterado**.
- `features/equipment/index.ts` (exports)
- `app/routes/AdminRoutes.tsx` (rota equipamentos), `app/layouts/AdminWebLayout.tsx` (menu)
- `docs/MIGRACAO-CIDADE-NA-MAO.md`

### Listagem
Tabela com cabeçalho azul-escuro (#0f3255, texto branco), linhas alternadas (branco/cinza), colunas **Nome / Quantidade / Status / Ações** (`open_in_new`). Busca por nome (tempo real), toggle "Mostrar apenas Inativados" (ativo → `is_active=false`; desativado → todos), paginação frontend (10/página, controles `<< < X de Y > >>`). Tabela com `overflow-x-auto` (scroll só na tabela no mobile, sem estourar a página). Calendário = placeholder (aviso).

### Modal Criar Equipamento
Painel à direita, header `inventory_2` + "Criar Equipamento", `EquipmentForm` (Nome, Quantidade `number`, Descrição). Validação: nome obrigatório, quantidade obrigatória ≥ 0, descrição obrigatória. **Salvar** → `createEquipment` (status inicial ativo) → refetch → fecha e limpa. **Voltar/fora** fecham e descartam.

### Modal Detalhe do Equipamento
Header `inventory_2` + nome + `X`. **Visualização:** Status, Nome, Quantidade, Descrição. Rodapé: **Inativar** (vermelho) / **Ativar** (verde, quando inativo) + **Editar** (azul). **Editar** troca para `EquipmentForm` no mesmo modal (Cancelar/Salvar → `updateEquipment` → volta para visualização com dado atualizado). Inativar/Ativar → `setEquipmentActive` → atualiza visualização + refetch da tabela. Tudo persiste no localStorage. `key={id}` no parent reinicializa por equipamento.

### Services criados/alterados
**Criados:** `listAllEquipment`, `createEquipment`, `updateEquipment(id,input)`, `setEquipmentActive(id,isActive)` + hook `useAllEquipment`. Padrão async/Promise da Etapa 3, sobre o mesmo `STORAGE_KEYS.equipments`.

### Validação
- `tsc --noEmit`: **EXIT 0** ✅ · `vite build`: **EXIT 0** ✅
- `eslint`: total `src/` = **58** (pré-existentes), **nenhum erro novo**.
- `vitest run`: **86/86** ✅ + smoke test temporário (removido): criar (ativo+persist), atualizar, inativar (some do catálogo público, fica no admin).
- `/web/equipamentos`, `/web/eventos`, `/m/eventos` → HTTP 200.

### Pendências
- Filtro por data (calendário) é placeholder.
- Equipamentos compartilham o mesmo seed dos eventos (catálogo de 7); "1 de N" reflete o total real.

---

---

## Etapa 9 — Renomeação de pastas/identidade (Bellog → Cidade na Mão) ✅ (2026-06-25)

### Estrutura antes
```
C:\Users\User\Documents\bellog - Copia\        (workspace root)
├── .agents\
├── atomic-component-library\
├── supabase\                                  (legado/stray — o app tem o seu próprio)
└── bellog\                                     ← APP real
    ├── package.json (name: cidade-na-mao)
    ├── bellog.code-workspace  (path: "..")
    ├── src\  supabase\  docs\  ...
```

### Estrutura depois (alvo)
```
C:\Users\User\Documents\cidade-na-mao\          ← APP (flat, sem pasta "bellog")
    ├── package.json
    ├── cidade-na-mao.code-workspace  (path: ".")
    ├── src\  supabase\  docs\  ...
```
(Os siblings `.agents`/`atomic-component-library`/`supabase` legado permanecem em `bellog - Copia` para decisão posterior — não fazem parte do app.)

### Feito nesta sessão (in-place, seguro)
- `bellog.code-workspace` → **renomeado** para `cidade-na-mao.code-workspace`; `folders[0].path` `".."` → `"."` (para apontar para a própria raiz do app após o move flat).
- `CLAUDE.md`: título "# Bellog — Guia Técnico" → "# Cidade na Mão — Guia Técnico" + nota de migração.
- Dev server parado (libera a pasta para o move).

### Move de pasta — executado pelo usuário no terminal (editor + dev fechados)
```powershell
Move-Item "C:\Users\User\Documents\bellog - Copia\bellog" "C:\Users\User\Documents\cidade-na-mao"
```
> Motivo de não ser feito pela sessão: o diretório de trabalho atual é `bellog - Copia`; renomear a pasta em uso quebraria caminhos/validação no meio da operação. Não há `.git` (nada de histórico a preservar).

### Auditoria "bellog" restante
**A — corrigir agora:** nenhum. A identidade visível já havia sido tratada (Etapa 1); o move de pasta + workspace + título cobrem o resto do nível de nomes.

**B — legado técnico (manter; pendência):**
- Bucket `bellog-files` (`features/storage/.../storage.service.ts`, `features/attachments/.../attachment.service.ts`)
- Coluna `bellog_arrival_date` (`lib/supabase.ts`, interface `Database` legada)
- SQL/migrations: `create_bellog_files_storage_policies.sql`, `hotfix_bellog_files_storage_mobile_upload.sql`, `enable_realtime.sql`, `202606010000/1_*.sql`; `supabase/.temp/linked-project.json`
- Assets de marca + símbolos: `brand/bellog-*.svg|png`, `BellogLogo`/`BellogLogoMini` (`shared/icons/index.ts`, `shared/components/Icon.tsx`, `layouts/MainLayout.tsx`, auth pages) — trocar junto com a nova identidade visual
- Chave localStorage legada `bellog-current-page` (fallback proposital em `apps/admin/App.tsx`)

**C — documentação histórica (manter):** `docs/RELATORIO-CIDADE-NA-MAO.md`, `docs/MIGRACAO-CIDADE-NA-MAO.md`, `docs/IS_TEST_ENVIRONMENT.md`, `docs/deploy-edge-function.md`, `CLAUDE.md`.

### Validação (no local atual, pré-move)
- `tsc --noEmit`: **EXIT 0** ✅ · `vite build`: **EXIT 0** ✅ · `eslint` src/: **58** (pré-existentes, sem novos) · `vitest run`: **86/86** ✅
- Nenhum arquivo referencia caminho absoluto antigo; app não depende dos siblings → relocável sem ajustes de import.

---

---

## Etapa 9.1/9.2 — Auth real + contexto do usuário ✅ (2026-06-25)

Pré-requisito concluído: **Fase 1 Auth/RLS aplicada e validada** no banco de teste/homolog (ver [MIGRACAO-SUPABASE-AUTH-RLS.md](./MIGRACAO-SUPABASE-AUTH-RLS.md)).

### Criado
- `src/features/auth/` — `types/auth.types.ts`, `api/auth.service.ts`, `context/AuthContext.ts`, `context/AuthProvider.tsx`, `hooks/useCurrentUser.ts`, `index.ts`.
- `src/app/routes/ProtectedRoute.tsx` — guard de `/web/*` (sessão + role `admin`).

### Alterado
- `main.tsx` (envolto em `<AuthProvider>`), `app/routes/AdminRoutes.tsx` (`/web/*` protegido), `app/layouts/AdminWebLayout.tsx` (usuário + logout), `apps/admin/App.tsx` (redirect `/login`→`/web/eventos` após login), `modules/auth/LoginPage.tsx` (remove sync `master_system_user`), `apps/admin/providers/AdminAuthProvider.tsx` (corrigido + superseded), `app/constants/currentUser.ts` (fallback dev documentado).

### Comportamento
- `/m/eventos` (e demais `/m/*`) **continuam públicos/anônimos**.
- `/web/*` exige sessão + role `admin` (senão → `/login` ou "acesso restrito").
- Após login admin, `equipment.service` lê `master_equipment` real (sai do mock).
- Escrita (approve/reject/confirm/etc.) **inalterada** (mock) — Fase M5.

### Validação
- `tsc --noEmit` EXIT 0 ✅ · `vite build` EXIT 0 ✅ · `vitest run` 86/86 ✅ · `eslint` sem erros novos (total pré-existente inalterado).

### Pendências
- Auth do público/líder (`/m/*` ainda mock `currentUser.ts`).
- Fase M4 (views seguras por tenant) e Fase M5 (RPCs de escrita).

---

---

## Fase M4 — Views seguras por tenant ✅ (2026-06-25)

### Migration
`supabase/migrations/202606250002_secure_event_views.sql` (aplicada no banco de teste/homolog via MCP).

### Mudanças
- **Nova view pública** `v_public_approved_events` (DEFINER, anon): approved+is_active, dados mínimos (sem `id_user`/creator), com `confirmed_count`. Grant SELECT anon+authenticated.
- **`v_master_event_full`, `v_master_equipment_availability`, `v_trx_slot_attendance_count`** → `security_invoker = on` (RLS filtra por tenant/role; anon = 0).
- `events.service`: público (`listPublicApprovedEvents` + fallback de `getEventById`) → `v_public_approved_events`; admin (`listWebEvents`/`listPendingEventRequests`/`listLeaderEventRequests` + caminho autenticado de `getEventById`) → `v_master_event_full`. `equipment.service` inalterado.

### Validação
- Banco: anon → admin views = 0, pública = approved/ativos; admin → só tenant (distinct id_tenant=1).
- `tsc` EXIT 0 ✅ · `build` EXIT 0 ✅ · `vitest` 86/86 ✅ · `eslint` sem erros novos.

### Comportamento preservado
`/m/eventos` continua anônimo (agora via view pública); `/web/*` autenticado/admin por tenant.

### Pendências
- Fase M5 (RPCs transacionais de escrita) — escrita ainda em mock.
- Auth do público/líder em `/m/*` (ainda mock).

---

---

## Fase M5 (bloco admin) — RPCs transacionais de decisão ✅ (2026-06-25)

### Migration
`supabase/migrations/202606250003_admin_event_decision_rpcs.sql` (aplicada no banco de teste/homolog via MCP).

### RPCs criadas (SECURITY DEFINER, só `authenticated`)
- `approve_event(p_id_event, p_id_slot)` — aprova slot (pending/counter_proposed), registra decisão, aloca equipamentos solicitados (idempotente).
- `reject_event(p_id_event, p_id_slot, p_reason)` — reprova (reason obrigatório).
- `propose_counter_date(p_id_event, p_id_slot, p_counter_date, p_reason)` — contraproposta (reason+data obrigatórios; `approved_at = counter_date`).
- Validam admin + tenant pelo contexto de auth (não recebem tenant/user do frontend). `EXECUTE` revogado de PUBLIC/anon.

### Service alterado
`features/event-approvals/api/event-approvals.service.ts`: `approveEvent`/`rejectEvent`/`proposeCounterDate` → `supabase.rpc(...)` (fallback mock só em dev). Hooks/modais inalterados.

### Testes
- Banco: anon → `permission denied`; admin → 3 decisões persistidas + alocação no approve; `id_reviewed_by` derivado do auth.
- `tsc` EXIT 0 ✅ · `build` EXIT 0 ✅ · `vitest` 86/86 ✅ · `eslint` sem erros novos.

### Pendências
- RPCs: `create_event_request`, `accept_counter_date`, `reject_counter_date`, `confirm_attendance`, `cancel_attendance`.
- `getLatestApproval` ainda em mock; remoção de mocks/fallbacks; auth público/líder.

---

## Leitura real de aprovações ✅ (2026-06-25)
`getLatestApproval` migrado de mock → `trx_event_approval` (+ `ref_approval_decision`), `reviewed_at desc`, filtro `id_event` (+`id_slot` opcional). Motivo/contraproposta agora vêm do banco (admin/líder via RLS; anon=0). Fallback mock mantido em dev. `EventApproval` ganhou `decision_code`/`decision_name`/`reviewed_at`. Sem mudança de UI (o detalhe do líder já exibe `approval.reason`). Validação: tsc/build/vitest 86/86/lint sem erro novo.

## Auth real para `/m/*` (público/líder) ✅ (2026-06-25)

### Criado
- `src/app/routes/ProtectedMobileRoute.tsx` — guard mobile (`requireAuth`, `allowedRoles?`), com CTA "Entrar" e "Acesso restrito" (sem redirect agressivo).

### Alterado
- `app/routes/PublicRoutes.tsx`: `/m/eventos` e `/m/eventos/:id` **públicos**; `/m/meus-eventos` exige login; `/m/eventos-solicitados`, `/m/solicitar-evento`, `/m/eventos-solicitados/:id` exigem login + `community_leader`.
- `MyEventRequestsPage`, `MyEventsPage`, `RequestEventPage`/`RequestEventForm` → usam `useCurrentUser().masterUserId/tenantId` (sem `MOCK_*`); o wizard bloqueia envio sem sessão.
- `app/constants/currentUser.ts`: `@deprecated` para fluxos autenticados (resta fallback dev/seed).

### Comportamento
- `/m/eventos` segue anônimo (via `v_public_approved_events`); `/web/*` segue admin.
- Sem login: rotas líder/meus-eventos pedem login; rotas públicas abrem.
- Admin logado: vê "acesso restrito" nas rotas de líder (admin ≠ community_leader).
- Criação de evento ainda **mock** (RPC no próximo bloco); presença ainda mock.

### Pendência de teste
Não há auth user com role `community_leader` no banco — as rotas de líder só serão testáveis após criar/vincular um (com autorização). Código pronto para quando existir.

### Validação
`tsc` EXIT 0 ✅ · `build` EXIT 0 ✅ · `vitest` 86/86 ✅ · `eslint` sem erro novo.

---

## Login mobile via token SASI (ponte SASI → sessão Supabase) — 2026-06-25

Deep-link `/m/*?sasi-token=<JWT>` faz login real no Supabase Auth. Feature `features/sasi-token` (captura + troca), edge function `exchange-sasi-token` (`verify_jwt=false`) valida na SASI → resolve `master_user` → garante `auth.users` → `generateLink(magiclink)`; o front conclui com `verifyOtp` e limpa o token. `ProtectedMobileRoute` autoriza só por sessão Supabase real. Detalhes técnicos e RLS em [MIGRACAO-SUPABASE-AUTH-RLS.md](MIGRACAO-SUPABASE-AUTH-RLS.md).

### Runtime (projeto `tfupwytzrkpzocfxheeq`)
- Edge function **deployada** (MCP, ACTIVE, v1). Token SASI real valida na `api.sasi.io` (HTTP 200).
- **Pendente:** secret `SASI_API_URL` (não há CLI/tool aqui) e um token de líder cujo e-mail exista em `master_user` (o token testado é provider Bellog, sem `master_user` → 403 correto).

### Validação
`tsc` EXIT 0 ✅ · `build` EXIT 0 ✅ · `vitest` 112/112 ✅ · `eslint` baseline inalterado (76 problems, nenhum novo).

## Próxima etapa
**Sugestões:** (a) configurar `SASI_API_URL` e testar com token de líder; (b) RPCs do líder (`accept/reject_counter_date`) + `create_event_request`; (c) RPCs do público (`confirm/cancel_attendance`). Aguardando direção.
