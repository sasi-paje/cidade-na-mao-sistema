# Deploy de Edge Functions (Supabase)

Guia genérico para publicar e testar Edge Functions do projeto **Cidade na Mão /
SASI-Eventos**. As funções ficam em `supabase/functions/<nome>/index.ts`.

> Exemplo usado abaixo: `exchange-sasi-token` (troca o token SASI por uma sessão
> Supabase). Substitua pelo nome da função que você for publicar.

## 1. Pré-requisitos

```bash
# Na raiz do projeto
cd cidade-na-mao
npx supabase --version   # CLI do Supabase instalada
```

## 2. Estrutura de arquivos

```
cidade-na-mao/
├── supabase/
│   └── functions/
│       ├── _shared/                 ← utilitários compartilhados
│       └── exchange-sasi-token/
│           └── index.ts             ← Edge Function
└── src/                             ← frontend (Vite + React)
```

## 3. Deploy

### Opção 1 — Via CLI (recomendado)
```bash
# Deploy para o projeto vinculado
npx supabase functions deploy exchange-sasi-token

# Deploy apontando um projeto específico
npx supabase functions deploy exchange-sasi-token --project-ref <PROJECT_REF>
```

### Opção 2 — Via Dashboard
1. Acessar https://supabase.com/dashboard e selecionar o projeto.
2. Ir em **Edge Functions → New Function**.
3. Criar a função com o mesmo nome da pasta.
4. Colar o código de `supabase/functions/<nome>/index.ts`.

## 4. Variáveis de ambiente / secrets

`SUPABASE_URL` e `SUPABASE_ANON_KEY` são injetadas automaticamente. Secrets
adicionais (ex.: chaves de integração) são configurados por:

```bash
npx supabase secrets set NOME_DO_SECRET="valor"
npx supabase secrets list
```

## 5. Testar

```bash
# Invocar a função publicada
npx supabase functions invoke exchange-sasi-token --json --body '{"token": "..."}'
```

## 6. Desenvolvimento local

```bash
# Sobe o stack local do Supabase
npx supabase start

# Serve as functions localmente (hot reload)
npx supabase functions serve

# A função fica disponível em:
# http://localhost:54321/functions/v1/<nome>
```

## 7. Troubleshooting

| Erro | Ação |
|---|---|
| `Function not found` | `npx supabase functions list` para confirmar o deploy |
| `Unauthorized` | Conferir a `anon key` em **Settings → API** |
| `CORS` no browser | As functions já enviam headers CORS; conferir se o projeto está ativo |
| Secret ausente | `npx supabase secrets set ...` e re-deploy |
