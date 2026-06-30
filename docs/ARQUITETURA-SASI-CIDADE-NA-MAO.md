# Arquitetura — SASI / Cidade na Mão

> Migrado de **Bellog** (logística). A autenticação principal (web e mobile) é
> via **token SASI** na URL (`?sasi-token=...`): captura → troca por sessão
> Supabase (`exchange-sasi-token` + `verifyOtp`) → limpa a URL → autorização por
> **sessão Supabase + role + RLS**. SASI é só o mecanismo de **login**; a
> autorização nunca depende dele. **Sem tela de login Bellog (e-mail/senha) no fluxo.**

## As 3 experiências

| Experiência | Base | Rotas | Acesso | Layout / Guard |
|---|---|---|---|---|
| **Web / Admin** | `/web/*` | `/web/eventos`, `/web/eventos/:id`, `/web/equipamentos` | sessão Supabase + `admin` | `SasiSessionBoundary` → `ProtectedRoute(requireAdmin)` → `AdminWebLayout` |
| **Líder de Comunidade** | `/m/*` (protegidas) | `/m/eventos-solicitados`, `/m/eventos-solicitados/:id`, `/m/solicitar-evento` | sessão Supabase + `community_leader` | `MobileLayout` (SasiAuthProvider) → `ProtectedMobileRoute(requireAuth, ['community_leader'])` |
| **Comunidade / Público** | `/m/*` | `/m/eventos`, `/m/eventos/:id` (anônimas); `/m/meus-eventos` (exige sessão) | anônimo / sessão Supabase | `MobileLayout` → rota pública ou `ProtectedMobileRoute(requireAuth)` |

## Autenticação (web e mobile)

1. Deep-link com `?sasi-token=<JWT>` em qualquer `/web/*` ou `/m/*`.
2. `SasiAuthProvider` (compartilhado) captura o token, guarda em `sessionStorage`,
   limpa **apenas** o `sasi-token` da URL (preservando outros params).
3. Chama a edge function `exchange-sasi-token`: valida na SASI → resolve
   `master_user` por e-mail → garante `auth.users` → `generateLink(magiclink)`.
4. Frontend conclui com `supabase.auth.verifyOtp({ type:'magiclink', token_hash })`
   → `SIGNED_IN` → `AuthProvider`/`useCurrentUser` resolve sessão/tenant/role.
5. Token SASI é limpo do `sessionStorage` após a sessão criada.
6. **Autorização** = `useCurrentUser()` (sessão Supabase) + role + RLS.

Provider compartilhado entre as duas áreas (sem duplicação):
- `features/sasi-token` — `SASI_TOKEN_PARAM`, `useSasiTokenCapture`,
  `exchangeSasiTokenForSupabaseSession`, `SasiAuthProvider`, `useSasiAuth`.
- `app/layouts/SasiSessionBoundary` — embrulha o `<Outlet/>` no provider (web).
- `app/layouts/MobileLayout` — embrulha o `<Outlet/>` no provider (mobile).

## Estados de acesso (sem Bellog)

| Situação | Web (`/web/*`) | Mobile protegida (`/m/*`) |
|---|---|---|
| Troca SASI em andamento | "Validando acesso…" (spinner) | spinner |
| Sem sessão Supabase | `AccessRequired` ("Acesso não autorizado") | CTA de login |
| Autenticado, role insuficiente | "Acesso restrito" | "Acesso restrito" |
| Autorizado | área renderiza | rota renderiza |

`/login` **e** `/reset-password` renderizam `AccessRequired` (tela neutra) —
sem formulário de e-mail/senha, sem reset manual, sem Bellog. O guard web nunca
redireciona para um login manual. O CTA mobile é "Acessar pelo app SASI".

## Regras

- SASI = login. Autorização = sessão Supabase + role + RLS.
- Token SASI só em `sessionStorage` (nunca `localStorage`); nunca logado;
  enviado apenas à edge function `exchange-sasi-token`.
- Sessão Supabase existente é preservada (o `AdminApp` não foi removido do código).

> Sem Bellog no fluxo: `AdminApp`/`LoginPage` (e-mail/senha) permanecem no
> código apenas como legado **não roteado** — nenhuma rota os referencia.

## Pendências / pontos de atenção

- **Operacional**: o login SASI ponta-a-ponta depende do secret `SASI_API_URL`
  no projeto `tfupwytzrkpzocfxheeq` e de um `master_user` com e-mail/role
  correspondentes ao token.
