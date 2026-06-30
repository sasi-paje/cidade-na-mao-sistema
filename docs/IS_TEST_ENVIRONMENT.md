# Separação Teste x Produção (`is_test`) — Relatório Técnico

> Banco Supabase único compartilhado por teste e produção.
> **Regra oficial:** `is_test = false` → produção · `is_test = true` → teste/desenvolvimento.

## 1. Como funciona agora

O ambiente é determinado em **build-time** por uma única variável: `VITE_IS_TEST`.

```ts
// src/lib/supabase.ts — fonte única da verdade
export const IS_TEST = import.meta.env.VITE_IS_TEST === 'true'
export const STORAGE_ENV_FOLDER = IS_TEST ? 'test' : 'prod'
```

Para não reescrever os ~250 pontos de consulta já existentes, o helper legado
`getEnvironment()` foi religado a `IS_TEST`:

```ts
export const getEnvironment = () => (IS_TEST ? 'development' : 'production')
```

Assim, o padrão dominante `const isTest = getEnvironment() !== 'production'` passa a
resolver **exatamente** para `IS_TEST` em todos os services, de forma determinística.
O switch antigo via `localStorage` (`setEnvironment` / `bellog-environment`) foi
**removido** — ele nunca era acionado e tornava o ambiente não-determinístico
(produção corria como `development`).

## 2. Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/lib/supabase.ts` | Adiciona `IS_TEST` e `STORAGE_ENV_FOLDER`; `getEnvironment()` deriva de `IS_TEST`; remove `setEnvironment`/localStorage |
| `src/hooks/useMotivos.ts` | Troca `is_test=false` hardcoded (5x) por `IS_TEST` em leitura e insert de motivos de entrega |
| `src/features/storage/api/storage.service.ts` | Upload novo recebe prefixo `test/` ou `prod/` no caminho |
| `supabase/functions/register-route-arrival/index.ts` | `APP_ENV` → `IS_TEST`; `.eq('is_test', IS_TEST)` nas 4 queries; prefixo de pasta no Storage |
| `supabase/functions/get-route-arrival/index.ts` | `APP_ENV` → `IS_TEST`; `.eq('is_test', IS_TEST)` nas 4 queries |
| `supabase/migrations/202606230002_ensure_is_test_columns.sql` | **Novo** — garante `is_test` (idempotente) + índices |
| `sql/cleanup-test-data.sql` | **Novo** — limpeza segura somente de `is_test = true` |
| `.env.local` | **Novo** — `VITE_IS_TEST=true` (local) |
| `.env.example` | **Novo** — documenta todas as variáveis |
| `docs/IS_TEST_ENVIRONMENT.md` | **Novo** — este relatório |

> `src/features/attachments/api/attachment.service.ts` **não** foi alterado: ele delega
> a `storageService.uploadFile`, que já aplica o prefixo de ambiente (evita duplicação).

## 3. Services que já filtravam por ambiente (mantidos)

Já usavam `getEnvironment()` + `.eq('is_test', isTest)` — agora dirigidos por `VITE_IS_TEST`
sem alteração de código: rotas (`features/routes`), atribuir notas (`modules/assign-notes`),
notas fiscais (`features/notes`), entregas (`modules/delivery`), motoristas
(`features/drivers`), veículos (`features/vehicles`), fornecedores/destinos
(`features/companies`, `features/company-resolver`), mobile driver
(`modules/my-routes`, `apps/mobile/services/driver.repository.ts`).

## 4. Tabelas COM `is_test` (filtradas por ambiente)

`trx_route`, `trx_route_stop`, `trx_route_history`, `trx_fiscal_invoice`,
`trx_fiscal_invoice_import`, `trx_route_invoice_delivery`, `rel_route_invoice`,
`rel_route_driver`, `rel_route_helper`, `rel_route_responsible`,
`rel_route_destination`, `rel_person_company_role_type`, `master_person_driver`,
`master_fleet_vehicle`, `master_person_company`, `master_person_company_address`,
`trx_route_access_token`, tabelas `ref_*`, `stg_*` e `etl_*`.

## 5. Tabelas SEM `is_test` (e por quê — não filtrar)

| Tabela | Motivo |
|---|---|
| `master_user_role_permission` | Não possui a coluna `is_test`; catálogo de permissões compartilhado (documentado no CLAUDE.md). |
| `master_system_page` | Filtrada **propositalmente** com `is_test=false` na gestão de usuários — páginas do sistema são globais. |
| Tabelas de Auth do Supabase | Gerenciadas pelo Supabase; sem conceito de `is_test`. |

> Gestão de usuários/cargos/permissões mantém o comportamento atual de propósito
> (não faz parte dos módulos logísticos do escopo).

## 6. Edge Functions ajustadas

`register-route-arrival` e `get-route-arrival` agora detectam o ambiente por:

```ts
const IS_TEST = Deno.env.get('APP_ENV') !== 'production'
```

e aplicam `.eq('is_test', IS_TEST)` em `trx_route`, `trx_route_stop`,
`rel_route_driver` e `master_person_driver`. A RPC `register_route_stop_arrival`
não precisou mudar: ela atualiza uma parada já filtrada por `is_test` na função.

## 7. Storage (mesmo bucket, pastas por ambiente)

Arquivos **novos** vão para `test/...` ou `prod/...`:

- `bellog-files`: `prod/canhotos/...`, `test/routes/123/...` (via `storageService`).
- `route-arrivals`: `prod/route-1/company-2/...` (via Edge Function).

Compatibilidade: leitura e exclusão usam o caminho completo gravado no banco, então
**fotos/arquivos antigos** (sem prefixo) continuam funcionando normalmente.

## 8. Configuração

### `.env.local` (local / teste)
```env
VITE_IS_TEST=true
```

### Vercel (produção)
Em *Project Settings → Environment Variables*:
```env
VITE_IS_TEST=false
```
> Defina para o ambiente **Production**. Para *Preview*, use `true` se quiser que
> previews enxerguem apenas dados de teste.

### Supabase Secrets (Edge Functions)
```bash
# Produção
supabase secrets set APP_ENV=production
# Local / teste (supabase/.env ou secrets do projeto de teste)
APP_ENV=test
```
> Sem `APP_ENV=production`, as Edge Functions operam como teste (`is_test = true`).

## 9. Limpeza segura de dados de teste

Use `sql/cleanup-test-data.sql`. Ele:
- apaga **somente** `WHERE is_test = true`;
- respeita a ordem de FK (filhos antes dos pais);
- roda dentro de `BEGIN ... ROLLBACK` — revise os counts e troque por `COMMIT`;
- **nunca** usa `TRUNCATE` nem `DELETE` sem `WHERE`.

```sql
-- Padrão usado em todo o script:
DELETE FROM public.trx_route_invoice_delivery WHERE is_test = true;
```

## 10. Critérios de aceite — status

- ✅ Local/teste só enxerga `is_test = true`; produção só `is_test = false`.
- ✅ Inserts locais recebem `is_test = true`; em produção, `is_test = false`.
- ✅ Edge Functions não acessam produção quando `APP_ENV ≠ production`.
- ✅ Script de limpeza nunca apaga produção; sem `TRUNCATE`.
- ✅ Storage separa arquivos novos em `test/` e `prod/`; arquivos antigos mantidos.
- ✅ `typecheck`, build e os 170 testes continuam passando.
- ✅ Nenhuma regra de negócio removida; nenhum nome de tabela alterado.
