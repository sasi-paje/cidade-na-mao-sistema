/**
 * Cliente Supabase para o domínio Cidade na Mão.
 *
 * Reexporta a ÚNICA instância de client criada em `src/lib/supabase.ts`
 * (evita múltiplos GoTrueClient) e adiciona helpers de ambiente usados
 * pela migração gradual mock → Supabase.
 *
 * Services novos devem importar daqui (`lib/supabase/client`); o legado
 * continua importando de `lib/supabase`.
 */
import { IS_TEST } from '../supabase'

export { supabase, getEnvironment, IS_TEST, STORAGE_ENV_FOLDER } from '../supabase'
export type { Environment } from '../supabase'

/**
 * Indica se as variáveis de ambiente do Supabase estão presentes.
 * Quando false, os services caem no fallback mock (localStorage).
 */
export function hasSupabaseEnv(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

/**
 * Fail-closed: só permite usar o fallback mock FORA de produção
 * (`IS_TEST=true`, ou seja, dev/homolog com `VITE_IS_TEST=true`).
 *
 * Em produção (`IS_TEST=false`), um erro de Supabase/RLS NUNCA deve cair
 * silenciosamente em mock: o service deve relançar o erro ou retornar um
 * estado vazio seguro — nunca dado falso.
 */
export function canUseMockFallback(): boolean {
  return IS_TEST
}

/**
 * Modo de integração web (`VITE_WEB_EMBED_MODE=true`): as telas `/web/*` são
 * espelhadas dentro de um sistema externo, então NÃO exigem login próprio do
 * SASI (sem tela de login, sem redirect, sem bloqueio por ausência de sessão).
 *
 * IMPORTANTE — não afrouxa segurança: as RPCs administrativas continuam
 * exigindo `authenticated` + role admin (via RLS/`current_user_role()`). Sem
 * credencial válida (ex.: token SASI do sistema externo na URL), as LEITURAS
 * permitidas carregam e as AÇÕES administrativas falham com mensagem amigável
 * (`ADMIN_ACCESS_ERROR`) — nunca com login nem sucesso falso. `service_role`
 * jamais vai para o frontend.
 */
export function isWebEmbedMode(): boolean {
  return import.meta.env.VITE_WEB_EMBED_MODE === 'true'
}

/**
 * Modo web público por tenant (`VITE_WEB_PUBLIC_MODE=true`): as telas `/web/*`
 * operam SEM autenticação, usando o tenant informado na URL (`?tenant=slug`)
 * como contexto. Qualquer pessoa com a URL do tenant pode operar aquele tenant.
 *
 * Neste modo, os services usam as RPCs web públicas por tenant
 * (`web_*_by_tenant`, EXECUTE liberado só para `anon` nessas RPCs) — as RPCs
 * admin atuais continuam restritas a `authenticated`. O isolamento é feito
 * DENTRO das RPCs (resolvem o tenant por slug, validam ativo, nunca cruzam
 * tenants). `service_role` jamais vai ao frontend.
 */
export function isWebPublicMode(): boolean {
  return import.meta.env.VITE_WEB_PUBLIC_MODE === 'true'
}
