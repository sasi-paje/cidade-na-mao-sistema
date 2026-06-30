# Integração SASI Mobile — identificação por `profile.id` (mantendo sessão Supabase)

> **Status: PLANO / PROPOSTA. Nada aqui foi implementado, migrado ou aplicado.**
> Documento de planejamento da integração SASI mobile usando o `profile.id` do SASI como
> chave de identificação do usuário, **mantendo a emissão de sessão Supabase real** para
> preservar RLS e as RPCs.
>
> Relacionados: [RELATORIO-PRONTIDAO-PRODUCAO.md](./RELATORIO-PRONTIDAO-PRODUCAO.md) ·
> [MIGRACAO-SUPABASE-AUTH-RLS.md](./MIGRACAO-SUPABASE-AUTH-RLS.md) ·
> [MIGRACAO-CIDADE-NA-MAO.md](./MIGRACAO-CIDADE-NA-MAO.md)

---

## 1. Contexto

A tela mobile recebe na URL um **refresh token do SASI**, troca por um **access token**, usa
esse token para perguntar ao SASI "quem é esse usuário?" (`/v2/profile/self` → `profile.id`
numérico) e usa esse `id` como **chave de pertencimento** para mostrar a cada usuário só os
seus dados.

O fluxo de identificação descrito pela equipe SASI usa:

| Endpoint | Método | Para quê |
|---|---|---|
| `https://webclient.sasi.com.br/v2/public/auth/refresh` | `POST` | Trocar *refresh token* por *access token* |
| `https://webclient.sasi.com.br/v2/profile/self` | `GET` | Obter o perfil (`{ profile: { id } }`) do dono do *access token* |

A integração **atual** já implementada no projeto (Edge Function `exchange-sasi-token`) usa
uma API/identidade **diferente**, e isso precisa ser reconciliado:

| Aspecto | Implementação atual | Fluxo-alvo (este doc) |
|---|---|---|
| Token na URL | `?sasi-token=<access/JWT>` | `?sasi-refresh-token=<refresh token>` |
| Passo de refresh | não existe | `POST /v2/public/auth/refresh` → `{token}` |
| Base da API | `https://api.sasi.io` (`SASI_API_URL`) | `https://webclient.sasi.com.br` |
| Endpoint de identidade | `GET /api/v2/providers/external/me` | `GET /v2/profile/self` |
| Forma da resposta | `{ id, name, role, status, customProps, profileProps }` | `{ profile: { id } }` |
| **Chave de identidade** | **e-mail** (`customProps/profileProps.email`) | **`profile.id` numérico** |
| Resultado | emite sessão Supabase (magic link → `verifyOtp`) | **mantém** emissão de sessão Supabase |

## 2. Problema atual

- A Edge Function casa o usuário por **e-mail** (`master_user.email`). No teste runtime
  anterior, o e-mail de um token SASI real **não existia** em `master_user` → `403`. Se a
  chave correta do SASI é o **`profile.id` numérico** (não o e-mail), o casamento por e-mail
  estava errado desde o início — provável causa do bloqueio registrado no relatório de
  prontidão.
- Há **dois endpoints SASI distintos** documentados no projeto (`api.sasi.io` vs
  `webclient.sasi.com.br`). É preciso confirmar qual é o oficial atual.
- O modelo alternativo "filtrar o banco direto pelo `profileId`" (sem sessão) **quebraria**
  RLS e as 5 RPCs M5-B, que dependem de `current_user_id()` derivado de `auth.uid()`.

## 3. Decisão arquitetural

**Manter a emissão de sessão Supabase real e trocar apenas a forma de identificar.**

Registrado explicitamente:

- ✅ O sistema **continuará emitindo sessão Supabase real** (magic link → `verifyOtp`).
- ✅ O RLS **continuará dependendo de `auth.uid()`**.
- ✅ `current_user_id()`, `current_tenant_id()` e `current_user_role()` **não mudam**.
- ✅ `id_sasi_profile` será usado **apenas na Edge Function** para localizar o `master_user`
  no momento do login — **não** entra no caminho de RLS.
- ❌ **Não** vamos filtrar dados direto pelo `profile.id` no frontend.
- ✅ O frontend **continuará usando sessão Supabase + RLS + RPCs**.
- ⛔ A migration com `id_sasi_profile` **ainda NÃO deve ser criada/aplicada** até confirmar os
  dados do endpoint `/v2/profile/self` (ver §10).

## 4. Fluxo-alvo

```
?sasi-refresh-token
   ─► POST  webclient.sasi.com.br/v2/public/auth/refresh  { refreshToken }  ─► { token }
   ─► GET   webclient.sasi.com.br/v2/profile/self  (Authorization: Bearer <token>)
                                                          ─► { profile: { id } }  (num)
   ─► resolve master_user POR id_sasi_profile = profile.id   (0 → 403, >1 → 409)
   ─► ensure auth.users + link master_user.id_auth_user      (igual hoje)
   ─► generateLink(magiclink) ─► tokenHash                   (igual hoje)
front: verifyOtp({ type:'magiclink', token_hash }) ─► sessão Supabase
   ─► leituras/escritas via RLS + RPCs (auth.uid())
```

## 5. Mudanças planejadas na Edge Function `exchange-sasi-token`

> Arquivo: `supabase/functions/exchange-sasi-token/index.ts` — **não alterar agora**.

1. **Entrada:** aceitar `{ refreshToken }` (hoje `{ token }`); manter `{ token }` como
   fallback transitório.
2. **Base da API:** novo env `SASI_WEBCLIENT_URL = https://webclient.sasi.com.br` (não confiar
   em URL vinda do front).
3. **`refreshSasiToken(refreshToken)`** → `POST {base}/v2/public/auth/refresh`,
   `Content-Type: application/json`, body `{ refreshToken }`, espera `{ token }`. Erro de
   rede / status não-2xx / `token` ausente-vazio → **SasiAuthError** (`auth-failed`).
4. **`getSasiProfile(accessToken)`** → `GET {base}/v2/profile/self`,
   `Authorization: Bearer <token>` (**o prefixo `Bearer ` é obrigatório** — já correto na
   função atual). Espera `{ profile: { id } }`. `id` inteiro > 0 → senão **SasiProfileError**
   (`profile-id-missing`); rede/status não-2xx → **SasiProfileFetchError** (`profile-failed`).
5. **Resolver `master_user` por `id_sasi_profile = profile.id`** (em vez de `ilike email`).
   `0` → `403` (`user-not-provisioned`); `>1` → `409`.
6. **E-mail do auth user (ponto crítico, ver §10.1):** se `/v2/profile/self` trouxer e-mail,
   usar; senão **sintetizar** um e-mail interno (ex.: `sasi-<profileId>@<dominio-interno>`) só
   para o `auth.users`. O e-mail humano permanece em `master_user.email`.
7. **Etapas finais inalteradas:** ensure `auth.users` + link `id_auth_user` + `resolveRole`
   (via `rel_user_role`) + `generateLink(magiclink)` → retornar `{ identity, supabaseAuth:{
   tokenHash, type } }`.
8. **Erros com `code`** para o front mapear: `missing-token`, `auth-failed`,
   `profile-failed`, `profile-id-missing`, `user-not-provisioned`. Continuar **não logando**
   token/refresh/hashed_token; service role só no servidor.

## 6. Mudança planejada de schema: `master_user.id_sasi_profile`

> **NÃO criar/aplicar migration agora** (bloqueado por §10.1).

Coluna dedicada (preferível a JSONB — indexável e limpa):

```sql
-- PLANEJADO — não aplicar até confirmar /v2/profile/self
alter table public.master_user add column if not exists id_sasi_profile bigint;
create unique index if not exists ux_master_user_id_sasi_profile
  on public.master_user (id_sasi_profile) where id_sasi_profile is not null;
```

- Popular para os usuários reais de teste (tenant/admin/líder/comum) no provisionamento.
- **Não** referenciada por `current_user_id()/current_tenant_id()/current_user_role()` — essas
  continuam derivando de `auth.uid() → master_user`.
- Alternativa (padrão do doc de origem): `profile_props jsonb` + filtro `@> '{"id": ...}'`.
  Menos eficiente; só por necessidade de compatibilidade.
- Backfill: usuários já vinculados por e-mail precisarão receber `id_sasi_profile`.

## 7. Mudanças planejadas no frontend `features/sasi-token`

> **Não alterar agora.**

- `sasi-token.service.ts`: capturar `?sasi-refresh-token=` (manter `?sasi-token=`/`?token=`
  como fallback transitório); persistir em `sessionStorage`; limpar a URL (comportamento
  atual preservado).
- `exchangeSasiTokenForSupabaseSession`: enviar `{ refreshToken }`; consumir `tokenHash` e
  chamar `verifyOtp({ type:'magiclink', token_hash })` — **inalterado**.
- `SasiAuthProvider`: mapear os `code` de erro (§5.8) para estados de tela: `missing-token`,
  `auth-failed`, `profile-failed`, `profile-id-missing`, `user-not-provisioned`, e o
  `load-failed` (falha do fetch de dados já com sessão).
- `ProtectedMobileRoute`/`ProtectedRoute`: **sem mudança** — autorizam por sessão Supabase
  real.

## 8. Secrets / configuração

- `config.toml`: `exchange-sasi-token` permanece `verify_jwt = false` (valida o SASI
  internamente).
- Secrets (homolog/prod): definir `SASI_WEBCLIENT_URL=https://webclient.sasi.com.br`; revisar
  `SASI_API_URL` (`api.sasi.io`) — manter só se o endpoint antigo permanecer em uso.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` já injetados pelo runtime do Supabase.

## 9. Impacto em RLS / RPCs M5-B

**Nenhuma incompatibilidade.** Como a sessão Supabase continua sendo emitida,
`current_user_id()` resolve normalmente e o RLS + as 5 RPCs M5-B
(`create_event_request`, `accept/reject_counter_date`, `confirm/cancel_attendance`) seguem
funcionando sem ajuste. Este plano **não** altera a migration
`202606270001_leader_public_event_rpcs.sql` nem o modelo auth/RLS já aplicado em homologação.

## 10. Pontos pendentes de confirmação com o SASI

1. **`/v2/profile/self` retorna e-mail?** Decide §5.6: e-mail real vs. e-mail sintético para o
   `auth.users`. **Bloqueia a criação da migration/edge function.**
2. **`profile.id` é estável e único** por usuário (é a chave de pertencimento)?
3. **`https://webclient.sasi.com.br` é o endpoint oficial** atual (vs. `api.sasi.io`)?
4. **Cada usuário SASI pertence a exatamente um tenant** no Cidade na Mão (tenant vem de
   `master_user.id_tenant`)?

## 11. Riscos

- **Sessão exige e-mail** e `/profile/self` pode não devolver um → mitigado por e-mail
  sintético, mas depende de §10.1.
- **Migração de chave e-mail → `id_sasi_profile`**: requer backfill dos usuários existentes.
- **Token na query string** (agora refresh token) fica em logs/histórico — preferir vida
  curta / uso único.
- **Dois endpoints SASI** documentados — manter dois caminhos aumenta superfície de erro;
  confirmar o oficial e consolidar.
- **Sem Supabase MCP/CLI na sessão atual** — schema e provisionamento não verificáveis ao
  vivo aqui.

## 12. Ordem recomendada de execução (quando autorizado + MCP disponível)

1. Confirmar §10 (e-mail no `/profile/self`; endpoint oficial; unicidade do `id`; tenant 1:1).
2. Criar e aplicar migration `id_sasi_profile` em **homologação**.
3. Backfill do `id_sasi_profile` nos usuários reais de teste.
4. Adaptar a Edge Function (refresh + profile/self + lookup por id + e-mail) → deploy homolog
   + secret `SASI_WEBCLIENT_URL`.
5. Teste runtime E2E: URL com `?sasi-refresh-token` real → sessão emitida → `current_user_id()`
   resolve → uma RPC M5-B grava.
6. Ajustar frontend (`features/sasi-token` + estados de erro).
7. Smoke completo (público/líder/admin) e atualizar os docs.

## 13. O que NÃO será feito agora

- ❌ Não alterar `exchange-sasi-token`.
- ❌ Não alterar `features/sasi-token`.
- ❌ Não alterar `master_user` nem criar migration `id_sasi_profile`.
- ❌ Não mexer em Supabase / banco / RLS / RPCs.
- ❌ Não alterar frontend.
- ❌ Não fazer deploy.

> Próximo passo concreto: obter as respostas de §10 com a equipe SASI — especialmente §10.1
> (e-mail no `/v2/profile/self`), que destrava a criação da migration e da edge function.

---

## 14. Perguntas enviadas à equipe SASI

Texto pronto para envio:

```text
Pessoal, para finalizar a integração do SASI Mobile com o Cidade na Mão, precisamos confirmar alguns pontos do fluxo de autenticação:

1. O endpoint GET https://webclient.sasi.com.br/v2/profile/self retorna o e-mail do usuário?
2. O campo profile.id é estável e único por usuário?
3. https://webclient.sasi.com.br é o endpoint oficial atual para esse fluxo, substituindo https://api.sasi.io?
4. O refresh token deve ser enviado para POST /v2/public/auth/refresh no corpo { "refreshToken": "..." }?
5. O retorno desse refresh é { "token": "..." }?
6. Um usuário SASI pode pertencer a mais de uma cidade/tenant ou sempre terá apenas um vínculo?
7. O refresh token enviado via query string tem vida curta ou uso único?
8. Existe algum ambiente de homologação/staging do SASI para testar esse fluxo antes de produção?
9. Quais outros campos o endpoint /v2/profile/self retorna além de profile.id? Exemplo: name, email, role, status.
10. Quais códigos HTTP e formatos de erro são retornados para refresh token inválido, expirado ou perfil inacessível?
11. O endpoint /v2/public/auth/refresh rotaciona o refresh token, devolvendo um novo refresh token, ou o mesmo refresh token continua válido?
12. Existe rate limit relevante nesses endpoints?

Com essas respostas, vamos mapear profile.id para master_user.id_sasi_profile e gerar uma sessão Supabase real, mantendo RLS, permissões por tenant e RPCs do banco.
```

---

## 15. Respostas oficiais da equipe SASI

> Preencher a coluna **Resposta SASI** conforme o retorno oficial. Enquanto estiver `Pendente`,
> a implementação por `profile.id` segue bloqueada.

| Nº | Pergunta | Resposta SASI | Decisão técnica destravada | Status |
|----|----------|---------------|----------------------------|--------|
| 1 | `/v2/profile/self` retorna o e-mail do usuário? | Pendente | Define se `auth.users` usará e-mail real ou e-mail sintético. | Pendente |
| 2 | `profile.id` é estável e único por usuário? | Pendente | Confirma se `profile.id` pode ser chave única em `master_user.id_sasi_profile`. | Pendente |
| 3 | `webclient.sasi.com.br` é o endpoint oficial (substitui `api.sasi.io`)? | Pendente | Define o secret `SASI_WEBCLIENT_URL` e se `SASI_API_URL` será aposentado. | Pendente |
| 4 | Refresh enviado em `POST /v2/public/auth/refresh` com `{ "refreshToken": "..." }`? | Pendente | Confirma o contrato do refresh token. | Pendente |
| 5 | Retorno do refresh é `{ "token": "..." }`? | Pendente | Confirma o parsing do access token. | Pendente |
| 6 | Usuário SASI pode pertencer a mais de uma cidade/tenant? | Pendente | Define se o vínculo usuário → tenant é 1:1 ou se precisará seleção de tenant. | Pendente |
| 7 | Refresh token em query string tem vida curta / uso único? | Pendente | Define mitigação de segurança para token em query string. | Pendente |
| 8 | Existe ambiente de homologação/staging do SASI? | Pendente | Define ambiente de teste E2E antes de produção. | Pendente |
| 9 | Quais outros campos `/v2/profile/self` retorna (name, email, role, status)? | Pendente | Define quais campos podem preencher `master_user.name/email` e quais não serão usados para autorização. | Pendente |
| 10 | Códigos HTTP / formatos de erro (refresh inválido, expirado, perfil inacessível)? | Pendente | Define mapeamento de erros no frontend. | Pendente |
| 11 | `/v2/public/auth/refresh` rotaciona o refresh token ou o mesmo segue válido? | Pendente | Define se o deep-link pode ser reutilizado ou se precisa tratar rotação. | Pendente |
| 12 | Existe rate limit relevante nesses endpoints? | Pendente | Define necessidade de retry, cache ou limitação de tentativas. | Pendente |

---

## 16. Pendência mais crítica

A **pergunta nº1** (`/v2/profile/self` retorna e-mail?) é a mais bloqueante:

- Se `/v2/profile/self` **retornar e-mail**, usaremos esse e-mail para criar/localizar o
  registro em `auth.users`.
- Se **não retornar e-mail**, será necessário decidir por um **e-mail sintético interno** no
  formato `sasi-<profileId>@cidade-na-mao.local` (ou outro domínio interno aprovado).
- **Nenhuma migration `id_sasi_profile` deve ser criada** antes de confirmar `profile.id` como
  **estável e único** (pergunta nº2).

---

## 17. Boundary global SASI + captura `?token=` — IMPLEMENTADO (frontend) — 2026-06-27

A ponte de **login** SASI passou a funcionar igualmente em `/m/*` e `/web/*` via um boundary
global, e a captura passou a aceitar o param `?token=` (caso principal do link real).

**O que foi implementado (frontend):**
- **Boundary global** `SasiSessionBoundary` (`src/features/sasi-token/context/SasiSessionBoundary.tsx`),
  montado em `main.tsx` dentro de `<BrowserRouter><AuthProvider>…`, envolvendo **toda** a árvore
  de rotas. Removido o mount duplicado anterior (que ficava no `MobileLayout` e num
  `SasiSessionBoundary` de rota só do `/web/*`). Sem provider duplicado.
- **Aliases aceitos na URL**, em ordem de prioridade: `token` → `sasi-token` → `sasiToken` →
  `sasi-refresh-token` → `sasiRefreshToken`. Os dois últimos são tratados como **refresh**
  (enviados como `refreshToken`); os demais como **access** (enviados como `token`).
- **Limpeza de URL**: após capturar, remove **apenas** o param do token via
  `setSearchParams(..., { replace: true })`, preservando os outros (`?token=abc&page=1` →
  `?page=1`). Token guardado só em `sessionStorage` (nunca `localStorage`) e limpo após
  `verifyOtp` com sucesso.

**Registrado:**
- `?token=<TOKEN_SASI>` agora é suportado tanto em `/m/*` quanto em `/web/*`.
- O token é **apenas ponte** para a sessão Supabase; a autorização continua por Supabase Auth +
  RLS + roles internas (`auth.uid()` / `current_user_id()` / `current_tenant_id()` /
  `current_user_role()`).
- O token **nunca** é salvo permanentemente (só `sessionStorage`, limpo após sucesso).

**Edge function:** `exchange-sasi-token` passou a **aceitar** `{ token?, refreshToken? }`. O
caminho `token` (atual) segue intacto. O caminho `refreshToken` (→ `webclient.sasi.com.br` →
`/v2/profile/self` → `profile.id`) está **gated**: retorna `501` "pendente confirmação SASI"
até as respostas das §10/§14/§15. **A edge function foi editada mas NÃO redeployada.**

**Validação (2026-06-27):** typecheck ✓, build ✓, lint = baseline (sem erro novo), testes
**151 passed** (+9 SASI). Smoke com token **fake** (sem token real; secret `SASI_API_URL`
ainda ausente → `500` controlado): em `/m/eventos?token=…&page=1` e `/web/eventos?token=…&page=1`
a URL foi limpa para `?page=1`, `/m` renderizou público e `/web` mostrou "Validando acesso…"
(loading, sem flicker). **Sessão Supabase real não pôde ser criada** (sem token real + secret
ausente) — segue dependente da confirmação SASI e do deploy/secret.

---

## 18. Tentativa de habilitar `?token=` em runtime (2026-06-28) — BLOQUEADA

**Objetivo:** configurar o secret, redeployar a edge function em homologação e validar
`?token=<TOKEN_SASI>` ponta-a-ponta.

**Confirmação da function (Tarefa 1):** o caminho `{ token }` lê **`SASI_API_URL`** (apenas; não
há `SASI_WEBCLIENT_URL` no código) e chama `GET ${SASI_API_URL}/api/v2/providers/external/me`
com `Authorization: Bearer <token>`. O caminho `{ refreshToken }`-only retorna **501** (gated),
como esperado. Portanto o secret correto é `SASI_API_URL=https://api.sasi.io`.

**Bloqueio:** nesta sessão **não há `supabase` CLI** (ausente no PATH, não instalado, não está em
devDeps, `npx` não consegue baixar) **nem Supabase MCP** conectado. Logo:
- **Secret `SASI_API_URL`: PENDENTE** — não foi possível `supabase secrets set` nem listar.
- **Redeploy: PENDENTE** — não foi possível `supabase functions deploy exchange-sasi-token`.
- **Smoke com token real: NÃO EXECUTADO** — sem deploy e sem token SASI real (e é proibido
  fabricar/logar token). A edge function deployada continua retornando `500` (secret ausente).

**Validação local (sem mudanças de código nesta etapa):** typecheck ✓, build ✓, lint = baseline
(76 problemas, sem erro novo), testes **151 passed**.

**Preparados para o destravamento (sem executar nada):**
- Script de deploy/secret: `scripts/supabase/deploy-exchange-sasi-token.ps1`.
- Checklist de smoke manual: [SMOKE-SASI-TOKEN.md](./SMOKE-SASI-TOKEN.md).

**Para destravar (requer CLI/MCP do Supabase + token real de homologação):**
1. `supabase secrets set SASI_API_URL=https://api.sasi.io` → `supabase secrets list` (confirmar
   sem expor valor).
2. `supabase functions deploy exchange-sasi-token`.
3. Abrir `/m/eventos?token=<real>` e `/web/eventos?token=<real>`; validar troca → `verifyOtp` →
   sessão → `useCurrentUser` (masterUserId/tenantId/role) e os gates por role.
4. Se `403`: token SASI válido mas **sem `master_user`** correspondente — a function busca por
   **e-mail** (`customProps.email`→`profileProps.email`, `ilike`); provisionar usuário real só
   com autorização. Se `409`: duplicidade/conflito de vínculo. Se `401`: token inválido/expirado.
