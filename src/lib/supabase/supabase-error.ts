/**
 * Helpers de erro do Supabase para a migração gradual.
 *
 * Durante a transição mock → Supabase, falhas de rede/permissão/RLS NÃO devem
 * quebrar a tela: o service registra o erro (em DEV) e cai no fallback mock.
 */

/**
 * Loga uma falha de Supabase sem interromper o fluxo. Silencioso em produção.
 */
export function logSupabaseError(context: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.warn(`[supabase] ${context} falhou — usando fallback mock:`, error)
  }
}
