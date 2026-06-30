# Análise de Prontidão — Tela Web Admin `/web/eventos`

**Data:** 2026-06-29 · **Ambiente:** homologação `tfupwytzrkpzocfxheeq` · **Escopo:** `/web/eventos` + `/web/eventos/:id` · **Modo:** auditoria (sem alterar código/banco).

> Status geral: 🟡 **PARCIAL — funcional COMPLETO; falta hardening/infra de produção.** Todas as ações de eventos (admin + público) já persistem real no banco. O que impede produção agora é **infra/segurança** (fail-closed dos mocks de leitura, banco de produção limpo) + itens de hardening dos advisors — não mais funcionalidade.

---

## 🔄 Re-auditoria (2026-06-29)

**Validação técnica:** typecheck ✅ 0 · build ✅ 0 · vitest ✅ **151/151** · lint **76 (70 erros/6 warnings) = baseline, sem erro novo**.

**RPCs (todas verificadas via MCP — SECURITY DEFINER, EXECUTE `authenticated`, `anon`=false):**
`approve_event`, `reject_event`, `propose_counter_date`, `admin_create_event`, `admin_update_event`, `admin_set_event_active`, `confirm_attendance`, `cancel_attendance`.

**Tudo funcional virou REAL** (admin + público): lista, detalhe (drawer sobre a lista), criar, editar (info+equipamentos, replace), aprovar, reprovar, propor nova data, inativar/ativar, equipamentos solicitados, **pessoas confirmadas** e **presença pública (M5-B, Modelo A)**. Nenhum mock/localStorage como fonte de verdade nesses fluxos.

**Advisors de segurança (Supabase) — triagem:**
- 🟡 `security_definer_view` (ERROR) em `v_public_approved_events` — **intencional** (M4): expõe só eventos approved+ativos, colunas mínimas (sem PII de criador). Aceitável; documentar a justificativa.
- ✅ `*_security_definer_function_executable` (WARN) em todas as RPCs + `current_*` — **esperado/por design**: são SECURITY DEFINER com checagem de role/tenant interna; `anon` sem EXECUTE nas de escrita. Não é vulnerabilidade.
- 🟠 `function_search_path_mutable` (WARN) em `fn_set_updated_at`, `fn_approval_decision_code`, `fn_validate_event_approval` (funções do baseline) — **hardening**: definir `set search_path`. (As RPCs novas já têm.)
- 🔵 `rls_enabled_no_policy` (INFO) em `ref_event_status`, `ref_notification_type` — RLS ligado sem policy = tabelas trancadas (deny-all). Seguro; adicionar SELECT `authenticated` só se a UI precisar.
- 🔵 `auth_leaked_password_protection` (WARN) — irrelevante (login é SASI/magiclink, sem senha).

**Advisors de performance (INFO, backlog):** FKs sem índice de cobertura (`created_by`/`updated_by`, `ref_*`, `id_slot`/`id_decision`/`id_attendance_status`), e 3 índices não usados. Baixo impacto no volume atual; revisar antes de escala.

**Bloqueadores de produção remanescentes (não-funcionais):**
1. **Fail-closed do fallback mock** nas leituras (`events.service`/`equipment.service`) quando `IS_TEST=false`.
2. **Banco de produção limpo** — homologação tem ~4000 eventos de carga; sem tenant/admin/líder reais de produção.
3. **Banner via Supabase Storage** (hoje base64 na coluna `banner_url`).
4. **Hardening dos advisors**: `set search_path` nas 3 funções do baseline; revisar a view DEFINER pública (aceita); índices de FK antes de escalar.

**Veredito:** funcionalmente **pronto**; **não subir** até resolver fail-closed + banco de produção limpo + (recomendado) o hardening dos advisors. As seções abaixo são da auditoria inicial, com os itens já resolvidos marcados.

---

## 1. Status geral

A tela evoluiu muito: lista lê Supabase real, criação grava no banco via RPC, aprovar/contraproposta/inativar são RPCs reais, e o detalhe abre como drawer sobre a lista sem trocar de rota. **Mas** ainda há mock em pontos sensíveis (pessoas confirmadas, edição), uma ação ausente na UI (reprovar) e dados de homologação. Por isso: **PARCIAL**.

## 2. Funcionalidades da lista `/web/eventos`

| Funcionalidade | Existe? | Real ou mock? | Funciona? | Pronto p/ prod? | Observação |
|---|---|---|---|---|---|
| Carregar eventos | ✅ | **Real** (`v_master_event_full`, RLS) | ✅ | ✅ | ordenado por `created_at desc` |
| Cards | ✅ | Real | ✅ | ✅ | `WebEventCard`; badge mostra "Inativo" quando `is_active=false` |
| Buscar por nome | ✅ | Real (filtro client por título) | ✅ | 🟡 | só client-side sobre a página carregada |
| Filtrar pendentes | ✅ | Real (client, `slot_status='pending'`) | ✅ | ✅ | |
| Filtro de data (calendário) | ✅ | Real (client, dropdown suspenso) | ✅ | ✅ | reaproveita lógica do mobile |
| Paginação | ✅ | Client (9/página) | ✅ | 🟡 | sobre o resultado em memória |
| Abrir detalhe | ✅ | Real | ✅ | ✅ | abre drawer por estado, sem mudar URL |
| Editar (card) | ✅ | **Mock** | parcial | ❌ | abre `EditEventModal` (equip = mock; info = read-only) |
| Adicionar Novo | ✅ | **Real** | ✅ | 🟡 | RPC `admin_create_event` (banner base64) |
| Inativar/Ativar | ✅ (no detalhe) | **Real** | ✅ | ✅ | RPC `admin_set_event_active` |
| Responsividade | ✅ | — | ✅ | 🟡 | grid 1/2/3 colunas; não auditado em telas pequenas |
| Scroll interno | ✅ | — | ✅ | ✅ | header/toolbar fixos, lista rola; body travado em modal |

## 3. Funcionalidades do detalhe (drawer)

| Item | Estado |
|---|---|
| Abre sem mudar a URL | ✅ (estado `selectedEventId` em `WebEventsPage`) |
| Mantém a lista atrás | ✅ (lista não desmonta) |
| Overlay escurece a lista | ✅ `bg-black/40` |
| Scroll só interno | ✅ `flex-1 overflow-y-auto` + `useLockBodyScroll` |
| Header (ícone+título+X) | ✅ |
| Abas funcionam | ✅ Informações / Pessoas / Equipamentos |
| Aba **Informações** | ✅ **Real** (`getEventById` → `v_master_event_full`) |
| Aba **Pessoas Confirmadas** | ✅ **Real** (`trx_event_attendance` + `master_user`/`ref_attendance_status`, status `confirmed`) — sem mock (resolvido 2026-06-29) |
| Aba **Equipamentos Solicitados** | ✅ **Real** (`trx_event_equipment_request` + nome via join) |
| Botão Editar | ✅ **Real** — carrega evento completo + salva via `admin_update_event` (info + equipamentos) |
| Botão Inativar/Ativar | ✅ **Real** (RPC) |
| Fechar pelo X | ✅ (volta à lista, faz `refetch`) |
| `/web/eventos/:id` (acesso direto) | ✅ continua como rota fallback (mesmo drawer) |

> ⚠️ A contagem "X pessoas confirmadas" vem da view real (`v_trx_slot_attendance_count`), mas a **lista de pessoas é gerada artificialmente** a partir desse número — não são pessoas reais.

## 4. Novo Evento (criação real)

Fluxo: Adicionar Novo → Etapa 1 (Informações) → Etapa 2 (Equipamentos) → **Finalizar** → `adminCreateEvent` → `supabase.rpc('admin_create_event')` → fecha + `refetch`.

- ✅ Usa a RPC **`admin_create_event`** (confirmada no banco: SECURITY DEFINER, EXECUTE só `authenticated`).
- ✅ Grava em `master_event`, `trx_event_slot`, `trx_event_equipment_request`, `trx_event_approval`, `trx_equipment_availability` (validado no banco em evento de teste).
- ✅ Evento nasce **`approved` / Confirmado** (`slot_status='approved'`, `approved_at=requested_at`).
- ✅ **Sem fallback mock** nesse caminho (lança erro tratado na UI; só fecha no sucesso).
- ⚠️ **Banner é base64** (data URL via `FileReader`) gravado direto em `master_event.banner_url` — sem Supabase Storage (payload pesado).
- ✅ Aparece na lista (ordenada `created_at desc` → no topo) e o detalhe mostra os equipamentos gravados.

## 5. Ações administrativas

| Ação | Existe na UI? | RPC | Real ou mock? | Pronto p/ prod? |
|---|---|---|---|---|
| Aprovar evento | ✅ (detalhe, slot pending) | `approve_event` | **Real** | ✅ |
| Propor nova data | ✅ (detalhe, slot pending) | `propose_counter_date` | **Real** | ✅ |
| **Rejeitar evento** | ✅ (detalhe, slot pending) | `reject_event` | **Real** | ✅ |
| Criar evento (admin) | ✅ | `admin_create_event` | **Real** | 🟡 (banner base64) |
| Editar evento (info) | ✅ (Editar) | `admin_update_event` | **Real** | ✅ |
| Editar equipamentos | ✅ (Editar) | `admin_update_event` (replace) | **Real** | ✅ |
| Inativar/Ativar evento | ✅ | `admin_set_event_active` | **Real** | ✅ |
| Listar pessoas confirmadas | ✅ | — | **Mock** (gerador) | ❌ |

## 6. Dados reais × mock

| Área | Fonte atual | Real/mock | Risco em produção | Correção necessária |
|---|---|---|---|---|
| Lista de eventos | `v_master_event_full` | Real | baixo | — |
| Detalhe (informações) | `getEventById`/view | Real | baixo | — |
| Equipamentos solicitados | `trx_event_equipment_request` | Real | baixo | — |
| Criação de evento | `admin_create_event` | Real | baixo | banner → Storage |
| Inativar/Ativar | `admin_set_event_active` | Real | baixo | — |
| Aprovar/Contraproposta | `approve_event`/`propose_counter_date` | Real | baixo | — |
| **Pessoas confirmadas** | `trx_event_attendance` (real) | **Real** | — | ✅ resolvido (2026-06-29); presença real M5-B (Modelo A autenticado) gravando via `confirm_attendance` |
| Edição de evento (info) | `admin_update_event` | **Real** | — | ✅ resolvido (2026-06-29) |
| Edição de equipamentos | `admin_update_event` (replace completo) | **Real** | — | ✅ resolvido (2026-06-29) |
| Reprovar (UI) | ✅ ligado a `reject_event` (motivo obrigatório) | Real | — | — (resolvido 2026-06-29) |
| Banner | base64 em `banner_url` | "real" porém pesado | médio | upload p/ Storage + URL |
| Fallback de leitura | `if(hasSupabaseEnv) try real catch → mock` | híbrido | **médio/alto** | fail-closed quando `IS_TEST=false` |

## 7. Banco e RPCs (verificado via MCP)

**Funções (todas SECURITY DEFINER; EXECUTE só `authenticated`, exceto context helpers que liberam anon de propósito):**
- ✅ `approve_event`, `reject_event`, `propose_counter_date` (M5-admin)
- ✅ `admin_create_event` (202606290001)
- ✅ `admin_set_event_active` (202606290002)
- ✅ `current_user_id` / `current_tenant_id` / `current_user_role`

**Views (todas presentes):** `v_master_event_full`, `v_public_approved_events`, `v_trx_slot_attendance_count`, `v_master_equipment_availability`.

**Tabelas:** `master_event`, `trx_event_slot`, `trx_event_equipment_request`, `trx_event_approval`, `trx_event_attendance`, `trx_equipment_availability` — todas existem; RLS habilitado.

**RPCs aplicadas após a auditoria inicial (2026-06-29):**
- ✅ `admin_set_event_active` (inativar/ativar) — 202606290002
- ✅ `admin_update_event` (editar evento + equipamentos, replace completo) — 202606290003

**RPCs que faltam para produção completa:**
- ~~`admin_update_event` / edição de equipamentos~~ ✅ **feito (2026-06-29)** — uma única RPC faz info + equipamentos.
- RPC real para pessoas confirmadas → na prática, **`confirm_attendance`/`cancel_attendance` (M5-B)** para o público gerar presença real; o admin já lê de `trx_event_attendance`.
- `reject_event` já existe e **está ligado na UI** (Reprovar no detalhe, 2026-06-29) — resolvido.

## 8. Autenticação e autorização

- ✅ `/web/eventos` exige **sessão Supabase** + **role `admin`** (`ProtectedRoute requireAdmin`).
- ✅ `SasiSessionBoundary` global (em `main.tsx`) capta `?token=` em qualquer rota e troca por sessão; **token SASI só cria sessão**, não autoriza.
- ✅ Andressa acessa como **admin** (confirmado na prática: criou evento real → `current_user_role()='admin'`).
- ✅ Sem sessão → "Acesso não autorizado"; role ≠ admin → "Acesso restrito".
- ✅ **RLS é a fonte de segurança** (views `security_invoker` + policies por tenant/role; RPCs validam `current_*`).
- 🟡 A ponte SASI runtime já funcionou para a Andressa; validação ampla (vários usuários/erros) ainda recomendada.

## 9. Prontidão para produção

**`/web/eventos` está pronto para produção? → 🟡 PARCIAL (NÃO subir ainda).**

### Bloqueadores de produção
1. ~~**Pessoas confirmadas é MOCK**~~ → **RESOLVIDO (2026-06-29)**: aba lê `trx_event_attendance` real (sem mock; CSV só com dados reais). A **presença real (M5-B)** foi implementada (Modelo A — usuário autenticado via SASI): `confirm_attendance`/`cancel_attendance` gravam em `trx_event_attendance`; confirmar em `/m/eventos/:id` passa a aparecer aqui no admin. (Visitante sem `master_user` não confirma — é a escolha do Modelo A.)
2. ~~**Edição não persiste**~~ → **RESOLVIDO (2026-06-29)**: "Editar" carrega o evento completo e salva via RPC real `admin_update_event` (informações + equipamentos com replace completo). Sem mock/localStorage.
3. **Banco de produção limpo** — homologação tem ~4000 eventos de carga; falta projeto/dados de produção (tenant/admin/líder reais).
4. **Fallback mock silencioso** — serviços de leitura caem em localStorage se o Supabase falhar/RLS retornar 0; em produção deve ser **fail-closed** (`IS_TEST=false`).

### Pendências importantes (backlog)
- ~~**Reprovar** ausente na UI~~ → **RESOLVIDO (2026-06-29)**: ligado à RPC real `reject_event` com motivo obrigatório.
- **Banner em Storage** — hoje base64 em `banner_url` (pesado); subir p/ Supabase Storage e salvar URL.
- Busca/paginação são client-side sobre o conjunto carregado — para milhares de eventos reais, considerar busca/paginação server-side.
- Validação ampla da ponte SASI (múltiplos usuários, erros 401/403/409).

### Melhorias visuais (UX/UI)
- Filtro "mostrar inativos" na lista (hoje inativos aparecem misturados, só marcados como "Inativo").
- Responsividade em telas estreitas não auditada.
- Logout no mobile (não afeta web).

### Riscos
- Mock ativo em **pessoas confirmadas** e **edição**.
- **Dados sintéticos** de homologação (`Evento de Carga`, ~4000) mascaram a experiência real e empurram eventos por ordenação.
- **Fallback mock** pode servir dados desatualizados em produção sem erro visível.
- **Banner base64** infla linhas e respostas da view.
- Ponte SASI Edge Function validada só parcialmente.

## 10. Testes manuais (smoke recomendado)

Em `http://localhost:5173/web/eventos` (com Andressa admin):
1. Carregar lista → ✅ eventos reais.
2. Buscar / filtrar pendentes / filtro de data → ✅.
3. Abrir detalhe (drawer, URL não muda) → ✅; trocar abas.
4. Equipamentos Solicitados → ✅ reais; Pessoas Confirmadas → ⚠️ mock.
5. Adicionar Novo → preencher → equipamentos → Finalizar → ✅ aparece no topo da lista; detalhe mostra equipamentos.
6. Inativar/Ativar → ✅ status muda para "Inativo"/volta.
7. Aprovar/Sugerir (evento pending) → ✅ RPC real.
8. Editar → ⚠️ não persiste (mock/placeholder).
9. `/web/equipamentos` → não afetado.
10. Sair / sem sessão → "Acesso não autorizado"; role ≠ admin → "Acesso restrito".

> Observação: a confirmação visual exige sessão admin (a tela fica atrás do `ProtectedRoute`). A auditoria de código/banco abaixo é objetiva.

## 11. Validação técnica (executada)

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npm run build` | ✅ exit 0 |
| `npx vitest run` | ✅ **151 passed** / 12 arquivos |
| `npm run lint` | ⚠️ baseline antigo (70 erros pré-existentes em arquivos legados); **sem erro novo** introduzido pelo trabalho de eventos |

## 12. Recomendação final

**NÃO subir `/web/eventos` para produção ainda.** A tela está sólida em **leitura, criação real, decisões do admin (aprovar/contraproposta) e inativação**, mas tem **bloqueadores reais**: pessoas confirmadas mock (dado falso), edição que não persiste, e dependência de banco de produção limpo + fail-closed do fallback.

**Caminho mínimo para liberar:**
1. ~~Substituir **pessoas confirmadas** por leitura real + presença real (M5-B)~~ ✅ **Feito (2026-06-29)** — leitura real + `confirm_attendance`/`cancel_attendance` (Modelo A autenticado).
2. ~~Implementar **edição real** (`admin_update_event` + equipamentos)~~ ✅ **Feito (2026-06-29).**
3. ~~Ligar **Reprovar** (`reject_event`) na UI.~~ ✅ **Feito (2026-06-29).**
4. **Fail-closed** do fallback mock em produção; banner via Storage.
5. **Projeto/dados de produção** limpos (tenant/admin/líder reais; sem carga `@loadtest`).

O que **já pode** ser considerado pronto: lista real, filtros, drawer de detalhe, criação real de evento, aprovar/contraproposta, inativar/ativar, auth admin + RLS.
