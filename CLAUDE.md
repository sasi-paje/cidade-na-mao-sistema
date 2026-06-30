# Cidade na Mão / SASI-Eventos — Guia Técnico

Plataforma de **gestão de eventos comunitários**. Três públicos:

- **Público (mobile)** — qualquer pessoa autenticada via SASI: navega eventos
  aprovados e confirma/cancela presença.
- **Líder comunitário (mobile)** — solicita eventos, acompanha o status das
  próprias solicitações e o detalhe de cada pedido.
- **Admin (web)** — gerencia a fila de eventos (aprovar / reprovar / sugerir nova
  data / inativar / editar) e o catálogo de equipamentos.

O acesso é feito por **token SASI** (deep-link), trocado por uma sessão real do
**Supabase Auth**; a autorização efetiva é por sessão + RLS/RPCs.

## Stack

- React 19 + TypeScript 5 + Tailwind CSS 3
- Vite 8 (build e dev server)
- react-router-dom 7 (roteamento real, SPA)
- Supabase (PostgreSQL + Auth + RLS + Edge Functions)
- Vitest + React Testing Library (testes)

## Comandos

```bash
npm run dev              # dev server (Vite)
npm run build            # build de produção (vite build)
npm run typecheck        # TypeScript sem emitir (tsc --noEmit)
npm run lint             # ESLint
npm run test             # Vitest em watch
npm run test:run         # Vitest single run (CI)
npm run test:coverage    # cobertura → ./coverage/
```

## Arquitetura viva

```
src/
├── app/                              # composição de rotas + layouts + boundaries
│   ├── routes/                       # AppRoutes, PublicRoutes, AdminRoutes, routePaths, guards
│   ├── layouts/                      # AdminWebLayout, MobileLayout
│   └── constants/
├── modules/                          # UI por feature
│   ├── admin/events/                 # fila/detalhe/aprovação de eventos (web)
│   ├── admin/equipment/              # catálogo de equipamentos (web)
│   ├── public/events/                # lista/detalhe/meus-eventos (mobile)
│   └── community-leader/event-requests/  # solicitar/listar/detalhe de pedidos (mobile)
├── features/                         # serviços de dados (source of truth do front)
│   ├── events/                       # CRUD/leitura de eventos
│   ├── equipment/                    # catálogo de equipamentos
│   ├── event-approvals/              # aprovar/reprovar/sugerir data
│   ├── event-attendance/             # presença (confirmar/cancelar)
│   ├── event-equipment/              # equipamentos solicitados por evento
│   ├── event-slots/                  # janelas/datas do evento
│   ├── auth/                         # sessão Supabase (useCurrentUser, AuthProvider)
│   └── sasi-token/                   # captura/troca do token SASI → sessão Supabase
├── shared/                           # componentes/hooks/ícones reutilizáveis
└── lib/supabase/                     # client Supabase + helpers de ambiente
```

Ponto de entrada: `src/main.tsx` → `BrowserRouter` → `AuthProvider` →
`SasiSessionBoundary` → `AppRoutes`.

### Regra de organização

- **Nova lógica de dados** → `features/<nome>/api/`
- **Novo módulo de UI** → `modules/<área>/<nome>/`
- **Hook de estado** → consumir `features/` (ex.: `features/events` expõe `useEventById`)
- **Componente reutilizável** → `shared/components/`

## Rotas principais

| Área | Rota | Tela |
|---|---|---|
| Admin (web) | `/web/eventos` | Fila de eventos |
| Admin (web) | `/web/eventos/:id` | Detalhe administrativo |
| Admin (web) | `/web/equipamentos` | Catálogo de equipamentos |
| Público (mobile) | `/m/eventos` | Lista de eventos aprovados |
| Público (mobile) | `/m/eventos/:id` | Detalhe do evento |
| Público (mobile) | `/m/meus-eventos` | Presenças do usuário |
| Líder (mobile) | `/m/eventos-solicitados` | Solicitações do líder |
| Líder (mobile) | `/m/eventos-solicitados/:id` | Detalhe da solicitação |
| Líder (mobile) | `/m/solicitar-evento` | Formulário de solicitação |

Os paths são centralizados em `src/app/routes/routePaths.ts`
(`PUBLIC_ROUTES`, `LEADER_ROUTES`, `ADMIN_ROUTES`).

## Autenticação — token SASI

- O token chega por `?token=...` (e aliases `sasi-token`, `sasiToken`,
  `sasi-refresh-token`, `sasiRefreshToken`) em qualquer rota `/m/*` ou `/web/*`.
- O `SasiSessionBoundary` global (`features/sasi-token`) **captura o token,
  troca por uma sessão Supabase e remove o token da URL** (replace), preservando
  os demais query params.
- A partir daí, a autorização é **sempre pela sessão Supabase** (`auth.uid()` →
  RLS/RPCs); o boundary é só o mecanismo de login, não autoriza nada.
- **Nunca** persistir token em `localStorage`; o token fica em `sessionStorage`.
  Nunca logar/imprimir o token.

## Regras importantes

- **Banco é a fonte de verdade.** Não usar mock/`localStorage` como fonte de
  verdade em produção.
- **`canUseMockFallback()`** (em `lib/supabase/client.ts`) só permite fallback
  mock quando `IS_TEST === true` (dev/homolog). Em produção (`VITE_IS_TEST=false`),
  erro de Supabase/RLS **nunca** cai em mock: relança o erro ou retorna estado
  vazio seguro — **nunca dado falso** (fail-closed).
- **Navegação mobile preserva o acesso via sessão.** Como o token é removido da
  URL após a captura, a continuidade entre telas (`?token=...` → próxima tela) se
  dá pela **sessão Supabase/`sessionStorage`**, não por reanexar o token na URL.
  É a abordagem escolhida (token não fica visível na barra de endereço).
- **Presença pública = Modelo A autenticado**: `confirm_attendance` /
  `cancel_attendance` operam por `current_user_id()` sobre slot aprovado
  (dedup por `unique(id_slot, id_user)`).
- **Admin usa RPCs reais** (`SECURITY DEFINER` + `set search_path = public`,
  `EXECUTE` só para `authenticated`). Nada de INSERT/UPDATE direto de eventos
  pelo front quando existe RPC.
- **`anon` não executa RPCs administrativas** — `revoke ... from anon` + grant só
  a `authenticated`; a autorização interna usa `current_user_role() = 'admin'`.
- **Soft-delete**: usar `is_active = false`, nunca DELETE direto.
- **Status/refs por `code`/`slug`**, nunca por ID fixo (IDs variam entre ambientes).

## RPCs principais

| RPC | Uso | Serviço front |
|---|---|---|
| `admin_create_event` | Criar evento (slot + equipamentos) | `features/events` |
| `admin_update_event` | Editar evento (substitui equipamentos) | `features/events` |
| `admin_set_event_active` | Ativar/inativar evento (soft) | `features/events` |
| `approve_event` | Aprovar solicitação | `features/event-approvals` |
| `reject_event` | Reprovar (motivo obrigatório) | `features/event-approvals` |
| `propose_counter_date` | Sugerir nova data | `features/event-approvals` |
| `confirm_attendance` | Confirmar presença | `features/event-attendance` |
| `cancel_attendance` | Cancelar presença | `features/event-attendance` |

Equipamentos (admin): `admin_create_equipment`, `admin_update_equipment`,
`admin_set_equipment_active` (com regra de bloqueio de inativação quando há
vínculo a evento ativo/futuro).

## Convenção de banco

| Prefixo | Uso |
|---|---|
| `master_*` | Entidades (eventos, equipamentos, usuários) |
| `ref_*` | Catálogos/enums (status de slot, decisões de aprovação) |
| `trx_*` | Transacionais (slots, presença, solicitações de equipamento) |
| `rel_*` | Relacionamentos N:N |

Campos padrão: `is_active` (soft-delete), `is_test` (filtrar `false` em produção),
`created_at/updated_at/created_by/updated_by` (auditoria).

> Após alterar o schema, aguarde a invalidação do cache do PostgREST (ou
> `supabase db reset` em local) antes de testar queries com colunas novas.

## Testes

- Co-localizados com o arquivo testado (`*.test.ts` / `*.test.tsx`).
- Mock de Supabase via helper `qb()` por arquivo; `getEnvironment` mockado para
  `development`.
- Fail-closed nos testes: nunca tratar `null`/`undefined` como permissivo.
- **Não remover** `features/sasi-token/sasi-token-web-routing.test.tsx` — é o
  teste que garante que a tela neutra de acesso **não** exibe marca/login legado.

## Pendências conhecidas

- **Banner via Supabase Storage** — `modules/admin/events/.../BannerUploadField`
  ainda precisa do fluxo definitivo de upload/serviço de imagem.
- **Banco de produção limpo** — remover dados de carga/teste antes do go-live e
  configurar `VITE_IS_TEST=false`.
- **Limpeza de tipos/migrations legados** — `lib/supabase.ts` ainda carrega tipos
  de tabelas legadas (logística) não usados pelo SASI; migrations antigas foram
  mantidas como histórico. Enxugar é opcional, em etapa dedicada.

> CRUD real de equipamentos: **concluído** (RPCs `admin_*_equipment` em uso).
