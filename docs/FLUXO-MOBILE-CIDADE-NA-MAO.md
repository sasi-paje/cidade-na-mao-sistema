# Fluxo do Mobile `/m/*` — Cidade na Mão (estado atual)

> Mapa da arquitetura **atual** do mobile (área `/m/*`): rotas, layout, autenticação por token
> SASI, proteção por role, leitura de dados, telas públicas e protegidas. Documento descritivo —
> **nenhum código/banco foi alterado**.
>
> Data: 2026-06-28. Relacionados: [INTEGRACAO-SASI-MOBILE.md](./INTEGRACAO-SASI-MOBILE.md) ·
> [RELATORIO-PRONTIDAO-PRODUCAO.md](./RELATORIO-PRONTIDAO-PRODUCAO.md) ·
> [SMOKE-SASI-TOKEN.md](./SMOKE-SASI-TOKEN.md)

---

## 1. Visão geral do mobile

A área `/m/*` é o app web mobile-first do Cidade na Mão (layout em coluna estreita ~460px,
paleta `#0f3255`/`#1e558b`, tipografia Inter, guia "SASI Eventos Mobile"). Perfis:

- **Público geral** (anônimo ou autenticado): vê eventos aprovados, abre detalhe, confirma/cancela
  presença, vê "Meus Eventos".
- **Líder comunitário** (`community_leader`, autenticado via SASI): solicita eventos, acompanha
  status e responde contrapropostas do admin.
- **Admin**: **não** usa `/m/*` para gerir — atua em `/web/*`. A interação é **indireta**: o admin
  aprova/reprova/contrapropõe (RPCs reais no web) e o resultado aparece ao líder/público no mobile
  (status do slot e motivo via `getLatestApproval`).

## 2. Rotas mobile existentes

Definidas em `src/app/routes/PublicRoutes.tsx` + `routePaths.ts` (`PUBLIC_ROUTES`,
`LEADER_ROUTES`), todas sob `MobileLayout`.

| Rota | Tela (componente) | Pública/Protegida | Role exigida | Fonte dos dados |
|---|---|---|---|---|
| `/m/eventos` | `PublicEventsPage` | Pública | — | `usePublicEvents` → `v_public_approved_events` (**real**, fallback mock) |
| `/m/eventos/:id` | `PublicEventDetailsPage` | Pública | — | `useEventById` (**real** via view) + `useEventAttendance` (**mock**) |
| `/m/meus-eventos` | `MyEventsPage` | Protegida | qualquer autenticada | `useMyAttendances` (**mock**) × `useWebEvents` → `v_master_event_full` (**real**, RLS) |
| `/m/eventos-solicitados` | `MyEventRequestsPage` | Protegida | `community_leader` | `useEventRequests` → `listLeaderEventRequests` / `v_master_event_full` (**real**, RLS) |
| `/m/eventos-solicitados/:id` | `EventRequestDetailsPage` | Protegida | `community_leader` | `useEventById` (**real**) + `useEventSlot` accept/reject (**mock**) + `useLatestApproval` → `trx_event_approval` (**real**) |
| `/m/solicitar-evento` | `RequestEventPage` | Protegida | `community_leader` | `useEventRequestFlow` (create event+slot+equipment — **mock**) + catálogo de equipamentos (**mock**) |

## 3. Fluxo visual do usuário público

1. Entra em **`/m/eventos`** → `PublicEventsPage` renderiza abas (`EventsTabs`) + painel
   (`EventsPanel`) com cards (`EventCard`); filtro por data via `EventCalendarModal`/
   `useEventDateFilter`. **Dados reais** da view `v_public_approved_events`.
2. **Vê eventos aprovados** (apenas `approved` + `is_active`, dados mínimos).
3. **Abre o detalhe** em `/m/eventos/:id` → `PublicEventDetailsPage` (banner, descrição, data,
   local, "X confirmaram · Y vagas"). Evento via `useEventById` (**real**); contagem
   `confirmed_count` vem da view.
4. **Confirma presença**: botão "Quero participar!" → diálogo "Confirme seus dados" (nome/e-mail
   do `useCurrentUser`) → `confirm()`. ⚠️ **Persistência é mock/localStorage** (`event-attendance.service`).
   Sem sessão, usa `MOCK_PUBLIC_USER_ID` como fallback.
5. **Acessa "Meus Eventos"** (`/m/meus-eventos`, protegida): cruza participações confirmadas
   (`useMyAttendances`, **mock**) com a view de eventos (`useWebEvents`, **real**). Toggle "Mostrar
   eventos passados".
6. **Cancela presença**: no detalhe, "Cancelar meu ingresso" → diálogo → `cancel()` (status
   `cancelled`, preserva histórico). ⚠️ **Mock**.

**Real hoje:** lista/detalhe/contagem de eventos (views Supabase). **Mock hoje:** confirmar,
cancelar e "Meus Eventos" (a parte de participação).

## 4. Fluxo visual do líder comunitário

1. **Entra com token SASI na URL** (`/m/...?token=<TOKEN_SASI>`).
2. **Token capturado** pelo boundary global (`useSasiTokenCapture`) e guardado em `sessionStorage`.
3. **Token trocado por sessão Supabase** (`exchange-sasi-token` → `verifyOtp`).
4. **`useCurrentUser` resolve** `masterUserId` / `tenantId` / `role` (via `auth.uid()` +
   `current_user_id/tenant/role`).
5. **Acessa `/m/eventos-solicitados`** → `MyEventRequestsPage` lista os eventos do próprio líder
   (`v_master_event_full` filtrado por `id_user`, RLS). **Real**.
6. **Cria solicitação em `/m/solicitar-evento`** (`RequestEventForm` + `useEventRequestFlow`).
   ⚠️ **Persistência mock** (createEvent+slot+equipment em localStorage).
7. **Acompanha status** no detalhe `/m/eventos-solicitados/:id`: badge de status, dados do evento,
   equipamentos, e motivo de reprovação via `useLatestApproval` (**real**, lê `trx_event_approval`).
8. **Aceita/recusa contraproposta**: quando `slot_status === 'counter_proposed'`, botão "Revisar" →
   diálogo mostra a nova data (`counter_date`) e o motivo → "Aceitar nova data" / "Recusar"
   (`useEventSlot.acceptCounter/rejectCounter`). ⚠️ **Mock** (`event-slots.service`).

**Real hoje:** listagem das solicitações do líder e leitura da decisão do admin
(`getLatestApproval`). **Depende das RPCs M5-B:** criar solicitação (`create_event_request`),
aceitar/recusar contraproposta (`accept_counter_date`/`reject_counter_date`).

> ⚠️ Divergência a reconciliar: o mock `rejectCounterDate` hoje também marca
> `master_event.is_active = false`; a migration M5-B rascunhada **não** altera `is_active`
> (só o slot vira `inactive`). Alinhar na hora de ligar o frontend à RPC.

## 5. Fluxo SASI token

```
/m/eventos?token=<TOKEN_SASI>
        ↓
SasiSessionBoundary global (main.tsx, dentro de BrowserRouter + AuthProvider)
        ↓
SasiAuthProvider
        ↓
captura token da URL (useSasiTokenCapture)
        ↓
sessionStorage temporário (chave `sasi-token` + `sasi-token-kind`)
        ↓
exchange-sasi-token (Edge Function)  →  valida no SASI + resolve master_user
        ↓
tokenHash (magiclink Supabase)
        ↓
verifyOtp({ type: 'magiclink', token_hash })
        ↓
sessão Supabase real
        ↓
AuthProvider / useCurrentUser  (onAuthStateChange)
        ↓
RLS + roles internas (current_user_id / current_tenant_id / current_user_role)
```

- **Query params aceitos** (ordem de prioridade): `token` → `sasi-token` → `sasiToken` →
  `sasi-refresh-token` → `sasiRefreshToken`. Os dois últimos = **refresh** (enviados como
  `refreshToken`; caminho ainda **gated/501** na Edge Function); os demais = **access** (`token`).
- **Limpeza da URL**: após capturar, remove **apenas** o param do token via `setSearchParams(...,
  { replace: true })`, preservando os outros (`?token=abc&page=1` → `?page=1`).
- **Armazenamento temporário**: somente `sessionStorage` (nunca `localStorage`).
- **Quando é removido**: após `verifyOtp` com sucesso (`clearSasiToken`); em falha também é limpo
  e exibido erro controlado.
- **Por que o token SASI não autoriza direto**: ele é só **mecanismo de login**. A autorização é
  sempre a **sessão Supabase real** (`auth.uid()`), que dirige RLS e roles — assim o front nunca
  decide acesso com base num token externo.

## 6. Proteção de rotas

- **Públicas (sem guard):** `/m/eventos`, `/m/eventos/:id`.
- **Exigem sessão (qualquer role):** `/m/meus-eventos` (`ProtectedMobileRoute requireAuth`).
- **Exigem `community_leader`:** `/m/eventos-solicitados`, `/m/eventos-solicitados/:id`,
  `/m/solicitar-evento` (`ProtectedMobileRoute requireAuth allowedRoles={['community_leader']}`).
- **Sem sessão** numa rota protegida → tela neutra **"Acesso pelo app SASI / Esta área abre pelo
  link do aplicativo SASI"** (sem botão; entrada é pelo deep-link `?token=`).
- **Role errada** (autenticado, mas não é líder) → **"Acesso restrito"** com botão "Ir para
  eventos" (`/m/eventos`).
- **Durante a troca SASI** (`useSasiAuth().loading`) → spinner, para não decidir acesso antes da
  sessão (sem flicker).
- **Diferença `/m/*` × `/web/*`:** ambos passam pelo mesmo `SasiSessionBoundary` global. No `/m/*`
  o padrão é CTA amigável; no `/web/*` (`ProtectedRoute requireAdmin`) exige sessão **+ role
  `admin`** e mostra "Acesso não autorizado"/"Acesso restrito".

## 7. Fontes de dados

| Tela/Fluxo | Fonte atual | Real ou mock | Observação |
|---|---|---|---|
| `/m/eventos` (lista) | `v_public_approved_events` | **Real** | Fallback localStorage se Supabase falhar/0 linhas |
| `/m/eventos/:id` (evento) | `v_public_approved_events` / `v_master_event_full` | **Real** | `useEventById` |
| Detalhe — confirmar/cancelar | `event-attendance.service` (localStorage) | **Mock** | `confirm/cancelAttendance` |
| `/m/meus-eventos` (participações) | `event-attendance.service` (localStorage) | **Mock** | Cruzado com a view real de eventos |
| `/m/meus-eventos` (eventos) | `v_master_event_full` | **Real** | RLS por tenant/role |
| `/m/eventos-solicitados` (lista) | `v_master_event_full` (por `id_user`) | **Real** | RLS — líder vê os próprios |
| Detalhe solicitação — evento | `v_master_event_full` | **Real** | `useEventById` |
| Detalhe — decisão/motivo | `trx_event_approval` | **Real** | `getLatestApproval` |
| Detalhe — aceitar/recusar contraproposta | `event-slots.service` (localStorage) | **Mock** | `accept/rejectCounterDate` |
| `/m/solicitar-evento` (submit) | `events`+`event-slots`+`event-equipment` services | **Mock** | `useEventRequestFlow` (localStorage) |
| Catálogo de equipamentos (form) | `equipment.service` | **Mock** | RLS bloqueia anon → cai no mock |

**Risco de fallback mock em produção:** os services de leitura seguem o padrão
`if (hasSupabaseEnv()) { try real } catch {} return mock`. Em produção, falha de rede/RLS cai
**silenciosamente** no mock — recomendado fail-closed quando `IS_TEST=false` (ver relatório de
prontidão).

## 8. Componentes principais

**Layout/navegação**
- `MobileLayout` — shell mobile (coluna estreita) com `<Outlet/>`; **não** monta mais provider SASI.
- `EventsTabs` — abas "Todos os eventos" / "Meus Eventos".
- `EventsPanel` — painel branco com título e ações (ex.: botão de calendário).

**Cards/visuais**
- `EventCard` — card de evento (banner, título, data, local; marca "confirmado").
- `eventVisuals` (`EventBanner`, `EventDateLine`) — banner com placeholder e linha de data.
- `EventRequestCard` / `EventRequestStatusBadge` — card e badge de status da solicitação do líder.
- `MobileDialog` — modal mobile (confirmar/cancelar/revisar).
- `EventCalendarModal` + `useEventDateFilter` — filtro por data da lista pública.

**Formulários**
- `RequestEventForm` — formulário de solicitação de evento (página única).

**Hooks (estado/dados)**
- `usePublicEvents`, `useEventById`, `useWebEvents`, `useEventRequests` — leitura de eventos.
- `useEventAttendance`, `useMyAttendances` — presença (mock).
- `useEventSlot`, `useLatestApproval` — slot/decisão.
- `useEventRequestFlow` — orquestra criar evento+slot+equipamentos.
- `useCurrentUser` — identidade/sessão (masterUserId/tenantId/role).
- `useSasiAuth` — estado da troca SASI (loading/error).

**Services**
- `events.service`, `event-slots.service`, `event-attendance.service`, `event-equipment.service`,
  `event-approvals.service` (decisões admin — RPC real), `equipment.service`.
- `sasi-token.service` (captura/armazenamento), `sasi-auth.service` (troca → sessão).

**Providers/guards**
- `AuthProvider`/`SasiSessionBoundary`(→`SasiAuthProvider`) — sessão Supabase + login SASI.
- `ProtectedMobileRoute` — guard de sessão/role do `/m/*`.

## 9. Fluxo de criação de solicitação (`/m/solicitar-evento`)

Form `RequestEventForm` (página única):
- **Campos:** Banner (cola **URL** de imagem — **não há upload**, só link), Nome do Evento, Dia
  (`date`), Hora (`time`), Local, Vagas (numérico), Equipamentos (multiseleção do catálogo),
  Descrição.
- **Validações (`canSubmit`):** título não vazio, data e hora preenchidas, local não vazio,
  vagas > 0, e **identidade válida** (`leaderUserId` + `tenantId` da sessão). Sem identidade →
  "Sessão inválida: faça login como líder".
- **Banner/upload:** apenas link colado (preview via `EventBanner`); sem upload para Storage.
- **Equipamentos:** vêm do catálogo (`useAllEquipment`/`equipment.service`, hoje **mock**);
  quantidade fixada em `1` por item selecionado.
- **Data/hora/local:** `requested_at = new Date(`${date}T${time}`).toISOString()`.
- **Submit:** `onSubmit({ event, slot, equipment })` → `useEventRequestFlow.submit` →
  `createEvent` → `createEventSlot` (status `pending`) → `requestEventEquipment`.
- **Onde salva hoje:** tudo em **localStorage/mock** (nenhuma escrita no Supabase).
- **RPC futura que deve substituir o mock:** **`create_event_request`** (bloco M5-B) —
  transacional, cria `master_event` + `trx_event_slot` (pending) + `trx_event_equipment_request`,
  com tenant/user do contexto.

## 10. Fluxo de confirmação de presença

- **Confirma:** `/m/eventos/:id` → "Quero participar!" → diálogo "Confirme seus dados" →
  `useEventAttendance.confirm()`.
- **Cancela:** mesma tela → "Cancelar meu ingresso" → diálogo → `cancel()` (status `cancelled`).
- **Lista "Meus Eventos":** `/m/meus-eventos` → `useMyAttendances` (confirmadas do usuário)
  cruzado com a view real de eventos.
- **Estado:** **mock/localStorage** (`event-attendance.service`); a contagem exibida no detalhe
  (`confirmed_count`) vem da **view real**, então **não bate** com o que o mock registra.
- **RPCs futuras:** **`confirm_attendance`** e **`cancel_attendance`** (bloco M5-B), escrevendo em
  `trx_event_attendance` (unique `id_slot+id_user`), respeitando capacidade e RLS
  (`id_user = current_user_id()`).

## 11. Pendências do mobile

### Bloqueadoras de produção
- **Ponte SASI em runtime não validada** — secret `SASI_API_URL` ausente; Edge Function retorna
  `500`; nenhuma sessão real criada ainda.
- **Secret/deploy da Edge Function pendente** — ver `scripts/supabase/deploy-exchange-sasi-token.ps1`
  e [SMOKE-SASI-TOKEN.md](./SMOKE-SASI-TOKEN.md) (requer Supabase CLI/MCP).
- **RPCs M5-B pendentes / não ligadas ao frontend** — `create_event_request`,
  `confirm_attendance`, `cancel_attendance`, `accept_counter_date`, `reject_counter_date`
  (migration rascunhada, **não aplicada**; frontend ainda em mock).
- **Mocks/localStorage restantes** — solicitar evento, presença, "Meus Eventos", aceitar/recusar
  contraproposta, catálogo de equipamentos.
- **Banco de produção limpo** — hoje só homologação com carga `@loadtest`.
- **Tenant/admin/líder reais** — inexistentes; necessários para validar fluxo autenticado E2E.

### Importantes
- **Fail-closed do fallback mock** quando `IS_TEST=false` (evitar servir dados falsos em produção).
- **Contagem de presença divergente** (view real × mock) — resolve ao ligar `confirm_attendance`.
- **Divergência `rejectCounterDate`** (mock inativa o evento; M5-B não) — alinhar ao ligar a RPC.
- **`MOCK_PUBLIC_USER_ID`/`DEFAULT_REVIEWER`** — remover ao migrar a participação para RPC real.

### Melhorias visuais
- **Logout no mobile** — não há ação de sair no `/m/*` autenticado.
- **Upload de banner** — hoje só aceita URL colada (sem Storage).
- **Estados de erro/loading** — revisar mensagens por tela após o fluxo real.

## 12. Diagrama textual final

```
Usuário abre /m/eventos
  ├─ sem token → navegação pública
  │     ├─ /m/eventos            (lista — view real)
  │     └─ /m/eventos/:id        (detalhe — view real; confirmar/cancelar = mock)
  │
  └─ com token SASI (?token=… e aliases)
        └─ SasiSessionBoundary → exchange-sasi-token → verifyOtp
              └─ sessão Supabase (useCurrentUser: user/tenant/role)
                  ├─ público autenticado
                  │     ├─ /m/meus-eventos     (eventos = view real; participação = mock)
                  │     └─ confirmar/cancelar  (mock → futuro confirm/cancel_attendance)
                  └─ community_leader
                        ├─ /m/eventos-solicitados      (lista — view real)
                        ├─ /m/eventos-solicitados/:id  (decisão = real; aceitar/recusar = mock)
                        └─ /m/solicitar-evento         (mock → futuro create_event_request)
```

---

## 13. Status

Frontend do mobile **implementado** e validado localmente (boundary global SASI, captura
`?token=`, guards, leitura pública/admin real). **Escrita** (solicitar/confirmar/contraproposta)
ainda **mock**, dependente das RPCs M5-B e da ponte SASI em runtime. Sem alterações de código,
banco ou Supabase neste documento.
