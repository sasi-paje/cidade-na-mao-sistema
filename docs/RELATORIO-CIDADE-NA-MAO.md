# Relatório Técnico — Migração Bellog → Cidade na Mão

> Documento de análise. **Nenhuma alteração de código foi feita.** Nada foi apagado, renomeado, conectado a Supabase ou implementado. Este relatório serve de base para decidir a transformação. Aguardando autorização para iniciar a Etapa 1.

---

## 1. Resumo executivo

O Bellog é uma SPA **React 19 + TypeScript 5 + Vite 8 + Tailwind 3**, com backend **Supabase**, organizada em arquitetura **feature-based** madura. Há uma separação clara e reaproveitável entre **infraestrutura genérica** (componentes, hooks, layout, design system, padrão de service/test) e **domínio de logística** (rotas, notas fiscais, motoristas, veículos, entregas).

**Conclusão central:** a base técnica é excelente para reaproveitamento, mas o domínio é ~70% específico de logística. A transformação correta **não é "trocar o layout"** — é:

1. **Preservar** a casca técnica (`src/shared`, `src/lib`, design tokens, layout genérico, padrão de service/hook/test, roteamento).
2. **Remover** todo o domínio de logística (`features` e `modules` de rota/nota/motorista/veículo/entrega).
3. **Reconstruir** o domínio de eventos do zero, seguindo os mesmos padrões.
4. **Renomear** a identidade Bellog → Cidade na Mão.

Risco principal de fazer errado: entidades de logística "vazando" para o novo sistema e um backend nascendo com modelo errado. Por isso a ordem das etapas importa (renomear → limpar → reconstruir → backend por último).

| Métrica | Valor |
|---|---|
| Features (`src/features`) | 17 |
| Módulos (`src/modules`) | 11 (10 logística/auth + 1 protótipo `events`) |
| Reaproveitável como infra | ~5 features + quase todo `src/shared` + layout + design tokens |
| A remover (domínio logística) | ~12 features + 8 módulos |
| Roteamento | **Manual** (`window.location.pathname` + state), **sem react-router** |
| Testes | Vitest + Testing Library, 83 testes, factories em `src/testing` |

---

## 2. O que o Bellog tem hoje (Diagnóstico — Seção A)

### 2.1 Padrão arquitetural
- **Feature-based** com duas camadas distintas:
  - **`src/features/<dominio>/`** → lógica/dados: `api/` (services), `hooks/`, `types/`, `index.ts`. **Sem UI.**
  - **`src/modules/<tela>/`** → UI: `pages/`, `components/`, `types/`. Consome `features/`.
  - Relação: **`modules` (UI) → consome → `features` (lógica)**.
- **`src/shared/`** → biblioteca genérica (componentes, ícones, base DDD, types compartilhados).
- **`src/apps/`** → dois "apps": `admin/` (web) e `mobile/` (motorista), montados condicionalmente.
- **`src/lib/supabase.ts`** → client único + flags de ambiente (`IS_TEST`).

### 2.2 Organização de pastas (atual)
```
src/
  apps/          admin/ (web, Supabase Auth)  |  mobile/ (token SASI)
  features/      17 domínios (services + hooks + types)
  modules/       11 telas (pages + components)
  shared/        base/ components/ icons/ types/  (genérico)
  hooks/         13 hooks (genéricos + específicos)
  layouts/       MainLayout + Sidebar (AppSidebar)
  lib/           supabase.ts (client + IS_TEST + Database types)
  utils/         date.ts
  testing/       factories.ts
  test/          setup.ts
  assets/  components/  shared/icons/brand/ (logos Bellog)
```

### 2.3 Padrão de services
- Objeto literal com métodos `async` retornando `Promise<T>`.
- Acessam `supabase` diretamente; filtram por ambiente: `const isTest = getEnvironment() !== 'production'` + helper `withTestFilter(query, isTest)` → `.eq('is_test', isTest)`.
- Erro: `if (error) throw new Error(error.message)` — **sem try/catch interno**, o caller captura.
- Otimizações: `Promise.all` para refs em paralelo, `Map()` para lookup, paginação embutida.
- Exemplo:
  ```ts
  async list(params?): Promise<{ data: T[]; total: number }> { ... }
  ```

### 2.4 Padrão de hooks
- Retornam `{ data, total, loading, error, fetch..., create..., update... }`.
- Genéricos: `useLoadingFeedback`, `useLoadingState`, `useRefData`, `useRealtime`.
- Específicos (logística): `useFiscalInvoices`, `useMotivos`, `useVehicles`, `useDrivers`, etc.
- O protótipo `usePublicEvents` (criado recentemente) já segue o padrão `{ events, isLoading, error }`.

### 2.5 Padrão de types
- **Interfaces** (quase nunca `type`, exceto unions discriminadas).
- **Sem enums nativos**: status vêm de tabelas `ref_*` (id/slug/label) ou string-literal unions (`'available' | 'in_progress' | 'completed'`).
- Types de banco centralizados na interface `Database` em `src/lib/supabase.ts`.
- Types de UI em `*.types.ts` por módulo.

### 2.6 Padrão de rotas
- **Sem react-router.** Roteamento manual:
  - **`src/main.tsx`**: `isMobilePath(pathname)` decide entre `<MobileApp/>` e `<AdminApp/>`.
  - **Mobile** (`src/apps/mobile/App.tsx`): match por `window.location.pathname` (`/my-routes`, `/delivery`, `/chegada`) + `?sasi-token=`.
  - **Admin** (`src/apps/admin/App.tsx`): navegação por **state interno** `currentPage` persistido em `localStorage` (`bellog-current-page`), **sem URLs reais** por página.
- **Implicação importante:** as rotas pedidas para o Cidade na Mão (`/m/eventos/:id`, `/web/eventos`, etc.) **não existem como rotas reais hoje**. Para tê-las de forma profissional, **recomenda-se adotar react-router** (ver Seção 7).

### 2.7 Padrão de componentes (shared)
Biblioteca quase 100% genérica e reaproveitável: `SharedTable`, `Modal`, `Drawer`, `Pagination`, `FormInput`, `FormDropdown`, `MultiSelectDropdown`, `Tabs`, `ActionButtons`, `StatusBadge` (tem mapa de status hardcoded → adaptar), `LoadingFeedback`/`LoadingButton`, `PageHeader`, `PageToolbar`, `ErrorBoundary`/`AsyncErrorBoundary`/`AppErrorBoundary`, `NotFoundPage`, `LoadingGate`, `MobilePageShell`, `MobileCardLayout`.

### 2.8 Padrão de layout
- **`MainLayout`** (sidebar + conteúdo) — **acoplado ao menu de logística** (Rotas, Notas, Atribuir Notas...). Adaptar.
- **`AppSidebar`** — **genérico**: recebe `menuItems`/`footerItems`/`dashboardItem` por props. Manter.

### 2.9 Padrão de testes
- **Vitest 4 + Testing Library**, jsdom, globals, coverage v8.
- Factories em `src/testing/factories.ts` (geram IDs únicos, `is_test: true`).
- Mock de Supabase via query-builder chainable (`qb()`).
- Setup em `src/test/setup.ts`. 83 testes hoje (services, regras de negócio, alguns componentes).

### 2.10 Integração Supabase
- Client único em `src/lib/supabase.ts` (URL + anon key via env).
- Convenção de tabelas: `master_*` (catálogo), `ref_*` (lookup), `trx_*` (transação), `rel_*` (N:N), `stg_*`/`etl_*` (staging/ETL).
- Flag `is_test` em quase todas as queries (separação teste/prod em build-time via `VITE_IS_TEST`).
- **Edge functions:** `send-email`, `invite-user`, `send-password-reset`, `consult-cnpj`, `register-route-arrival`, `get-route-arrival`, `create-route-history-table`.
- **Storage:** bucket `bellog-files` (renomear).

---

## 3. O que pode ser reaproveitado (Seção B)

Legenda: 🟢 manter igual · 🟡 manter adaptando · 🔴 remover · 🔵 substituir/criar

| Item | Ação | Observação |
|---|---|---|
| `src/shared/components/*` (Table, Modal, Drawer, Pagination, Form*, Tabs, ActionButtons...) | 🟢 | Genéricos; base do design system |
| `src/shared/components/StatusBadge` | 🟡 | Tem mapa de status de logística hardcoded → tornar configurável p/ status de evento |
| `src/shared/icons` (`AppIcon`, `MaterialIcon`, SVGs) | 🟢 | Material Symbols; só trocar logos de marca |
| `src/shared/base` (Entity, ValueObject — DDD) | 🟢 | Base sólida |
| `src/shared/types/routes.ts` | 🔴 | Específico de rota → remover (ou mover) |
| `src/hooks` genéricos (`useLoadingFeedback`, `useLoadingState`, `useRefData`, `useRealtime`) | 🟢 | |
| `src/hooks` específicos (`useFiscalInvoices`, `useMotivos`, `useVehicles`, `useDrivers`, `useRouteHistory`, `useAssignments`, `useCompanies`, `useRoutes`) | 🔴 | Domínio logística |
| `src/layouts/AppSidebar` | 🟢 | Genérico via props |
| `src/layouts/MainLayout` | 🟡 | Extrair menu p/ config; criar `AdminLayout` de eventos |
| `src/utils/date.ts` | 🟢 | Genérico |
| `tailwind.config.js` (tokens) | 🟡 | Manter sistema; ajustar paleta p/ tokens Cidade na Mão |
| `src/index.css` | 🟢 | Reset + dvh + currentColor em SVG |
| `src/lib/supabase.ts` (client + IS_TEST + helpers) | 🟡 | Manter infra; **remover** a interface `Database` de logística e recriar com tabelas de evento |
| Padrão de service (async/Promise/throw) | 🟢 | Replicar nos novos services |
| Padrão de hook (`{data,loading,error,refetch}`) | 🟢 | Replicar |
| Estrutura de testes (Vitest + factories + qb) | 🟢 | Reusar setup; criar novas factories de evento |
| `feature email` (wrapper de edge functions) | 🟢 | Notificação genérica |
| `feature storage` | 🟡 | Genérico; renomear bucket `bellog-files` |
| `feature attachments` | 🟡 | Genérico, hoje preparado p/ logística; ajustar tipos de entidade |
| `feature roles` (RBAC) | 🟢 | Controle de acesso universal — **chave para os 3 perfis** |
| `feature users` (usuários/páginas/permissões) | 🟢 | Genérico |
| `module auth` (Login/FirstAccess/ForgotPassword) | 🟢 | Genérico (Supabase Auth) |
| `module users` | 🟢 | Administrativo genérico |
| `module events` (protótipo) | 🟡 | Já criado; vira base do domínio público |
| `feature companies` | 🟡/🔴 | CRUD genérico mas papéis SUPPLIER/DESTINATION são logística; provavelmente remover |
| `AppErrorBoundary`, `LoadingGate`, `NotFoundPage` | 🟢 | |

---

## 4. O que precisa ser removido (Seção C)

### 4.1 Features de logística → 🔴 remover
`routes`, `routes-history`, `routes-card` (legacy), `assignments`, `notes` (fiscal-invoice), `import`, `xml-import`, `vehicles`, `drivers`, `cnpj`, `company-resolver`, e provavelmente `companies`.

### 4.2 Módulos de logística → 🔴 remover
`arrival-client`, `assign-notes`, `delivery`, `my-routes`, `notes`, `routes`, `vehicles`. Em `settings`: remover páginas de Motoristas, Destinos, Recusas, Abortadas, Fornecedores (manter o padrão de CRUD/Drawer como referência).

### 4.3 Apps/serviços mobile de motorista → 🔴 remover/substituir
`src/apps/mobile/services/` (driver.repository, external-provider.api, mobile-auth via token SASI). O Cidade na Mão tem perfis diferentes (público/líder/admin) — a estratégia de auth mobile precisa ser repensada.

### 4.4 Backend/infra de logística → 🔴 remover/recriar
- Edge functions: `register-route-arrival`, `get-route-arrival`, `create-route-history-table`.
- Tabelas de logística (`trx_route*`, `trx_fiscal_invoice*`, `master_fleet_vehicle`, `master_person_driver`, `rel_route_*`, `ref_route_*`, `stg_*`, `etl_*`) — **não migrar** (backend é etapa final).
- A interface `Database` em `src/lib/supabase.ts` (toda tipada p/ logística).

### 4.5 Textos/identidade → 🔴 substituir
Todo texto visível ligado a logística (Rotas, Notas, Entregas, Motoristas...) e à marca Bellog (ver Seção 9).

---

## 5. Nova arquitetura recomendada (Seções D + E)

### 5.1 A estrutura proposta combina com o Bellog?
**Sim, com 2 ajustes:**
1. O Bellog **não tem `src/app/routes` nem react-router** — hoje é navegação manual. Para suportar `/m/eventos/:id`, `/web/eventos/:id` etc. de forma profissional, **recomendo adotar `react-router-dom`** e criar `src/app/routes/`. (Alternativa: manter o esquema manual, mas escala mal com rotas dinâmicas e proteção por perfil.)
2. A separação `features` (lógica) vs `modules` (UI) **já existe** e bate exatamente com a proposta — manter.

### 5.2 Estrutura de pastas proposta
```
src/
  app/
    routes/        # react-router: definição + guards por perfil
    providers/     # AuthProvider, QueryProvider, ThemeProvider
    layouts/       # PublicLayout, LeaderLayout, AdminLayout
  shared/
    components/  hooks/  services/  types/  utils/  constants/
  features/                      # lógica/dados (services + types + hooks)
    events/        api/ types/ hooks/
    event-slots/   api/ types/ hooks/
    event-requests/api/ types/ hooks/
    event-attendance/ api/ types/ hooks/
    equipment/     api/ types/ hooks/
    approvals/     api/ types/ hooks/
    users/         api/ types/ hooks/      # reaproveitado
    permissions/   api/ types/ hooks/      # reaproveitado (roles)
  modules/                       # UI por perfil
    public/
      events/  event-details/  my-events/
    community-leader/
      event-requests/  request-event/  request-details/
    admin/
      events/  event-details/  equipment/  users/  dashboard/
  lib/
    supabase/      # client + Database types (eventos) + helpers IS_TEST
    permissions/   # matriz perfil → permissões
    tenant/        # tenant_id helpers (RLS futura)
```
**Observação:** `shared/services`, `shared/constants` e `shared/utils` são adições à estrutura atual (hoje só há `utils/date.ts`). Recomendo criá-las para abrigar service base, constantes de status e helpers genéricos.

### 5.3 Perfis e permissões (Seção D)
| Perfil | Pode |
|---|---|
| **Público Geral** | ver eventos aprovados, abrir detalhe, confirmar/cancelar participação, ver "Meus Eventos" |
| **Líder da Comunidade** | tudo do público + solicitar evento, solicitar equipamentos, acompanhar próprias solicitações, responder contraproposta de data |
| **Admin** | ver solicitações pendentes, aprovar/reprovar, propor nova data, inativar/editar evento, ver pessoas confirmadas, ver equipamentos solicitados, gerenciar equipamentos, gerenciar usuários/perfis (futuro) |

Implementar via `feature roles`/`permissions` (já existe RBAC) + guards de rota por perfil.

---

## 6. Novo mapa de módulos, types, services e hooks (Seção H + parte de E)

### 6.1 Modelo de dados → types de frontend (Seção H)
Tabelas reais previstas → interfaces (seguindo o padrão `Database` + `*.types.ts`):

| Tabela / View | Type de frontend | Notas |
|---|---|---|
| `master_event` | `EventMaster` | dados base do evento |
| `trx_event_slot` | `EventSlot` | data/hora/vagas; carrega `slotStatus` |
| `trx_event_equipment_request` | `EventEquipmentRequest` | equipamentos pedidos por slot |
| `master_equipment` | `Equipment` | catálogo de equipamentos |
| `trx_event_approval` | `EventApproval` | decisão admin (+ contraproposta de data) |
| `trx_event_attendance` | `EventAttendance` | participações confirmadas |
| `trx_equipment_availability` | `EquipmentAvailability` | disponibilidade por data |
| `ref_slot_status` | `SlotStatusCode` (union) | `'draft'|'requested'|'approved'|'rejected'...` |
| `ref_approval_decision` | `ApprovalDecisionCode` (union) | `'approved'|'rejected'|'counter_proposed'` |
| `ref_attendance_status` | `AttendanceStatusCode` (union) | `'confirmed'|'cancelled'` |
| `v_master_event_full` | `EventFullView` | view de leitura (join pronto p/ listagem) |
| `v_trx_slot_attendance_count` | `SlotAttendanceCount` | contagem de confirmados por slot |

**Convenção:** manter `ref_*` como fonte de status (id/slug/label) e expor no front como **string-literal unions** + objetos de label, como o Bellog já faz.

### 6.2 Services esperados (padrão Bellog, retornando Promise)
- `eventsService.listApproved()`, `getById()` → público.
- `eventSlotsService.listByEvent()`, `create()`.
- `eventRequestsService.create()`, `listMine(userId)`, `getById()` → líder.
- `eventAttendanceService.confirm()`, `cancel()`, `listMine(userId)`, `countBySlot()`.
- `equipmentService.list()`, `create()`, `update()` → admin.
- `approvalsService.approve()`, `reject()`, `proposeNewDate()`, `listPending()` → admin.

### 6.3 Hooks esperados (com loading/error/refetch)
`usePublicEvents` (já existe), `useEventDetails`, `useMyAttendance`, `useEventRequests`, `useEquipment`, `usePendingApprovals`. Todos no padrão `{ data, isLoading, error, refetch }`.

---

## 7. Novo mapa de rotas (Seção G)

> Hoje **não há react-router**. Recomendação: adotá-lo. Abaixo, a proposta e o veredito por rota.

| Rota | Perfil | Origem | Proteção |
|---|---|---|---|
| `/` | Público | 🔵 criar (landing/redirect) | pública |
| `/m/eventos` | Público | 🟡 base no protótipo `events` | pública |
| `/m/eventos/:id` | Público | 🔵 criar | pública |
| `/m/meus-eventos` | Público | 🔵 criar | autenticado |
| `/m/eventos-solicitados` | Líder | 🔵 criar | guard líder |
| `/m/eventos-solicitados/:id` | Líder | 🔵 criar | guard líder + dono |
| `/m/solicitar-evento` | Líder | 🔵 criar | guard líder |
| `/web/eventos` | Admin | 🟡 base no padrão `RoutesPage` (tabela/toolbar/drawer) | guard admin |
| `/web/eventos/:id` | Admin | 🟡 base no padrão de detalhe de rota | guard admin |
| `/web/equipamentos` | Admin | 🟡 base no padrão `settings` CRUD | guard admin |
| `/web/usuarios` (futuro) | Admin | 🟢 reusar `module users` | guard admin |
| `/web/dashboard` (futuro) | Admin | 🔵 criar | guard admin |

- **Reutilizam estrutura Bellog:** telas admin (`/web/*`) aproveitam o padrão tabela + toolbar + drawer + paginação. A tela pública `/m/eventos` aproveita o protótipo `events`.
- **Criar do zero:** todo o fluxo de líder (`solicitar-evento`, `eventos-solicitados`) e detalhes públicos.
- **Rotas antigas a remover:** `/my-routes`, `/delivery`, `/chegada`, `/arrival-client` e todas as páginas-state do admin de logística.
- **Proteção por perfil:** guards em `src/app/routes/` que leem o perfil (via `feature permissions`) e redirecionam; RLS no backend (etapa final) reforça com `tenant_id`/`user_id`.

---

## 8. Fluxos funcionais (Seção I)

**1. Público visualiza evento:** lista `eventsService.listApproved()` (filtra `slot_status = approved`) → abre `/m/eventos/:id` → `confirm()` cria `trx_event_attendance` → `cancel()` marca cancelado → "Meus Eventos" lista via `listMine(userId)`.

**2. Líder solicita evento:** form de evento (`master_event`) → define slot (`trx_event_slot`: data/hora/vagas) → solicita equipamentos (`trx_event_equipment_request`) → acompanha `listMine(userId)` → se admin manda contraproposta (`approval.decision = counter_proposed`), líder **aceita** (cria novo slot/atualiza) ou **recusa**.

**3. Admin gerencia evento:** fila `listPending()` → abre detalhe → **aprova** / **reprova** / **propõe nova data** (grava em `trx_event_approval`) → vê equipamentos solicitados e pessoas confirmadas (`v_trx_slot_attendance_count`) → inativa/edita quando necessário.

---

## 9. Plano de renomeação (Seção F)

| De | Para |
|---|---|
| Bellog / bellog | Cidade na Mão / cidade-na-mao |
| logística, rotas, notas, entregas, motoristas, veículos | eventos, solicitações, equipamentos, participações, comunidade |

**Locais exatos a alterar (inventário):**
- `package.json` → `"name": "bellog"`
- `index.html` → `<title>bellog</title>`
- `src/main.tsx` (~linha 62) → "Carregando Bellog..."
- `src/apps/admin/App.tsx` (linhas 48, 127) → chave localStorage `'bellog-current-page'`
- `src/layouts/MainLayout.tsx` (~118-126) → alt/logos + menu de logística
- `src/modules/auth/LoginPage.tsx` (~106) → `alt="Bellog Logo"`
- **Logos/brand** em `src/shared/icons/brand/`: `bellog-logo.svg`, `bellog-logo-mini.svg`, `bellog-logo-login.png`, `bellog-login.svg` (+ `sasi-logo.svg`) e os exports em `src/shared/icons/index.ts`
- `src/shared/components/Toolbar/ToolbarTokens.ts` (comentário)
- **Storage bucket** `'bellog-files'` em `attachment.service.ts` (~245), `RouteNoteDetail.tsx` (~293), `NoteDetailsDrawer.tsx` (~92), `ImportNotesMetadataModal.tsx`
- `src/lib/supabase.ts` (~414) campo `bellog_arrival_date`
- `CLAUDE.md` (título), `.env.example` (cabeçalho), `README.md`
- SQL: `sql/hotfix_bellog_files_storage_mobile_upload.sql`, `supabase/migrations/create_bellog_files_storage_policies.sql`
- **Env vars:** `VITE_EXTERNAL_API_URL` (API SASI mobile) provavelmente sai; revisar `VITE_APP_URL`.
- **Edge/functions Supabase:** renomear/recriar conforme novo domínio (etapa final).

---

## 10. Plano de limpeza (Seção C consolidada)

1. Remover `features` de logística (lista 4.1) e seus testes.
2. Remover `modules` de logística (lista 4.2).
3. Remover serviços mobile de motorista (4.3).
4. Limpar `src/hooks` específicos de logística.
5. Remover `src/shared/types/routes.ts`.
6. Esvaziar a interface `Database` de logística em `src/lib/supabase.ts` (recriar depois com tabelas de evento).
7. Remover assets de marca Bellog (após ter os novos).
8. Remover edge functions de logística.

> **Importante:** nada disso será executado agora. É o roteiro da Etapa 2.

---

## 11. Plano de implementação por etapas (Seção M)

| Etapa | Objetivo | Entregável |
|---|---|---|
| **1** | Renomear projeto / limpar identidade Bellog | package.json, title, logos, textos, env |
| **2** | Remover módulos/features de logística | árvore enxuta só com infra genérica |
| **3** | Domínio base de eventos | types + services (Promise) + hooks + mocks |
| **4** | Rotas públicas | `/m/eventos`, `/m/eventos/:id`, `/m/meus-eventos` |
| **5** | Rotas do líder | `eventos-solicitados`, `solicitar-evento`, detalhe |
| **6** | Rotas admin | `/web/eventos`, detalhe, `/web/equipamentos` |
| **7** | Permissões + proteção de rotas | guards por perfil + matriz de permissões |
| **8** | Layout e design | PublicLayout/LeaderLayout/AdminLayout + tokens novos |
| **9** | Testes | cobrir fluxos (Seção 13) |
| **10** | Supabase/backend | só agora: tabelas, views, RLS, edge functions |

**Pré-requisito recomendado antes da Etapa 4:** decidir adoção do **react-router** (impacta 4–7).

---

## 12. Riscos (Seção N)

| Risco | Impacto | Mitigação |
|---|---|---|
| Copiar e só trocar layout | Entidades de logística vazam para eventos | Seguir plano de limpeza (Etapa 2) antes de construir |
| Nomes errados no código (route/invoice/driver em contexto de evento) | Confusão e bugs | Renomear na Etapa 1; revisão de naming |
| Rotas antigas acessíveis | Telas de logística ainda abríveis | Remover paths + guards |
| Services incompatíveis | Reuso indevido de service de rota p/ evento | Recriar services no padrão, não adaptar de logística |
| Backend nascer com modelo errado | Retrabalho caro no Supabase | Backend é **última** etapa, sobre modelo de evento já validado |
| Permissões erradas entre perfis | Vazamento de dados (líder vê de outro líder) | RBAC + guards + RLS (`tenant_id`/`user_id`) |
| `Database` types de logística sobrando | Type-safety falsa | Recriar interface `Database` na Etapa 3/10 |
| Misturar protótipo `events` com produção | Mocks indo p/ prod | Tratar protótipo como base, substituir dados na Etapa 3 |

---

## 13. Checklist final antes de implementar

**Decisões pendentes (precisam da sua resposta):**
- [ ] Adotar **react-router** ou manter roteamento manual?
- [ ] Manter dois "apps" (mobile/web) como hoje, ou unificar com layouts por perfil?
- [ ] `feature companies` sai por completo ou vira "organização/comunidade"?
- [ ] Estratégia de auth do público/líder (Supabase Auth para todos? token externo?).
- [ ] Tokens de cor: aplicar a nova paleta (`#0f3255 / #1e558b / #bdcde8 / #919191`) substituindo a atual (`#1f30a7 / #161a36`)?

**Garantias técnicas (preservar):**
- [ ] Padrão de service (async/Promise/throw) replicado.
- [ ] Hooks com `loading/error/refetch`.
- [ ] Componentes shared reaproveitados (Table/Modal/Drawer/Pagination/Tabs/Form*).
- [ ] Material Symbols como padrão de ícones.
- [ ] Estrutura de testes (Vitest + factories + qb) mantida.
- [ ] `IS_TEST` / separação teste-prod preservada.
- [ ] Preparação para RLS (`tenant_id`, `user_id`) nos types/services.

**Regras respeitadas neste relatório:** sem implementação, sem apagar/renomear arquivos, sem conectar Supabase, sem backend/tabela/RLS.

---

### Layout & design (Seção J) — resumo
- **Reaproveitar:** `AppSidebar`, todos os componentes shared, `MobilePageShell`/`MobileCardLayout`, tokens de spacing/radius/height, Material Symbols.
- **Adaptar:** `MainLayout` (menu), `StatusBadge` (cores de status), paleta de cores.
- **Mudar visualmente:** identidade/logo, paleta para `#0f3255 / #1e558b / #bdcde8 / #919191`.
- **Layouts novos:** `PublicLayout` (mobile simples), `LeaderLayout` (foco em solicitações), `AdminLayout` (painel web no estilo atual).

### Supabase & backend (Seção K) — resumo
- **Reaproveitar:** client/`IS_TEST`/helpers, padrão de service, `feature email/storage/roles/users`, factories de teste.
- **Remover:** tabelas/edge functions de logística, interface `Database` atual.
- **Renomear:** bucket `bellog-files`, env vars, funções.
- **Recriar:** tabelas `master_event`/`trx_event_*`/`ref_*`/views, RLS com `tenant_id`+`user_id`, edge functions de evento.
- **Preparar agora (sem backend):** services retornando `Promise`, hooks com `loading/error/refetch`, separação por perfil (público/líder/admin).
