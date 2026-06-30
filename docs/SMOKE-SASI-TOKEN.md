# Smoke test — Ponte SASI `?token=` → sessão Supabase

> Checklist manual para validar a ponte de login SASI em **homologação**, após configurar o
> secret e redeployar a Edge Function. **Nunca** cole o token real em logs, console, docs,
> prints, fixtures ou testes.
>
> Relacionados: [INTEGRACAO-SASI-MOBILE.md](./INTEGRACAO-SASI-MOBILE.md) ·
> script de deploy: `scripts/supabase/deploy-exchange-sasi-token.ps1`

---

## Objetivo

Validar o fluxo ponta-a-ponta:

```
?token=<TOKEN_SASI> → exchange-sasi-token → verifyOtp → sessão Supabase → useCurrentUser → gates por role
```

## Pré-requisitos

- [ ] Supabase CLI instalado e logado (`supabase login`)
- [ ] Projeto **linkado em homologação** (`tfupwytzrkpzocfxheeq`)
- [ ] Secret `SASI_API_URL` configurado (via `scripts/supabase/deploy-exchange-sasi-token.ps1`)
- [ ] Function `exchange-sasi-token` **redeployada**
- [ ] **Token SASI real de teste** (manter fora de qualquer arquivo/log)
- [ ] Dev server rodando em `http://localhost:5173`
- [ ] Usuário SASI correspondente **provisionado em `master_user`** (hoje o vínculo é por e-mail)

## Testes manuais

Abrir no navegador (substituir `<TOKEN_SASI>` pelo token real, sem registrá-lo em lugar nenhum):

```
http://localhost:5173/m/eventos?token=<TOKEN_SASI>
http://localhost:5173/web/eventos?token=<TOKEN_SASI>
```

Validar:

1. [ ] A URL **remove** o `token` (vira `/m/eventos` ou `/web/eventos`, preservando outros params).
2. [ ] A Edge Function **não retorna 500**.
3. [ ] `verifyOtp` executa (sessão sendo criada).
4. [ ] **Sessão Supabase** é criada.
5. [ ] `useCurrentUser` resolve:
   - [ ] `masterUserId`
   - [ ] `tenantId`
   - [ ] `role`
6. [ ] `/m/eventos` abre.
7. [ ] `/web/eventos` abre **apenas** se `role === 'admin'` (senão, "Acesso restrito").
8. [ ] `/m/eventos-solicitados` abre **apenas** se `role === 'community_leader'`.
9. [ ] `sessionStorage` **não** mantém o token após o sucesso (chave `sasi-token` limpa).
10. [ ] **Nenhum token** aparece em log, console, docs ou print.

> Dica (sem expor token): no DevTools → Application → Session Storage, conferir que `sasi-token`
> sumiu após o login; em Network, conferir o status da chamada `exchange-sasi-token` (não abrir
> o corpo da request em telas compartilhadas).

## Interpretação de erros

| Código | Significado provável |
|---|---|
| `500` | Secret `SASI_API_URL` ausente, function antiga (sem redeploy) ou erro interno. |
| `401` | Token SASI inválido/expirado. |
| `403` | Token SASI válido, mas **usuário não provisionado** em `master_user` (busca por e-mail). |
| `409` | Duplicidade / conflito de vínculo `id_auth_user` (e-mail divergente ou >1 `master_user`). |
| `verifyOtp error` | Problema na geração/troca do magic link (Supabase Auth). |

> `403` **não** autoriza criar usuário: provisionar `master_user` só com autorização explícita.

## O que registrar no resultado

| Item | Resultado |
|---|---|
| Secret configurado | Pendente/OK |
| Function redeployada | Pendente/OK |
| Token SASI testado | Sim/Não |
| Sessão Supabase criada | Sim/Não |
| masterUserId resolvido | Sim/Não |
| tenantId resolvido | Sim/Não |
| role resolvida | Sim/Não |
| /m/eventos | OK/Falha |
| /web/eventos | OK/Falha |
| /m/eventos-solicitados | OK/Falha |
| Erro encontrado | Descrever |

## Estado atual (2026-06-28)

- ✅ Frontend global da ponte `?token=` (web + mobile) implementado e validado localmente
  (typecheck/build ✓, 151 testes ✓).
- ⛔ Runtime real **bloqueado**: secret `SASI_API_URL` e redeploy **pendentes** (sem Supabase
  CLI/MCP na sessão de desenvolvimento); a function deployada ainda retorna `500`.
- ✅ Script de deploy e este checklist **preparados** para rodar em ambiente com Supabase CLI +
  token SASI real.
