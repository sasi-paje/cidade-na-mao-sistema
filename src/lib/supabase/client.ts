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
