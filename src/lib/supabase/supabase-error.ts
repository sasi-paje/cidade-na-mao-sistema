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

/** Mensagem padronizada da área web administrativa quando o acesso não valida. */
export const ADMIN_ACCESS_ERROR =
  'Não foi possível validar o acesso administrativo. Abra esta tela pelo sistema principal.'

/**
 * Traduz falhas de autenticação/permissão (sessão ausente, RLS, role ≠ admin,
 * JWT/401/403) para a mensagem amigável padronizada da área web. Como as telas
 * `/web/*` podem abrir espelhadas SEM sessão local, uma ação administrativa que
 * falha por acesso precisa orientar o usuário — nunca cair em login/erro cru.
 * Demais falhas (rede/validação) usam o `fallback` informado.
 */
export function friendlyAdminError(error: unknown, fallback: string): string {
  const raw = (
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : String(error ?? '')
  ).toLowerCase()

  const isAccessError =
    raw.includes('autenticad') || // "usuário não autenticado"
    raw.includes('permiss') || // "sem permissão"
    raw.includes('apenas admin') ||
    raw.includes('jwt') ||
    raw.includes('row-level security') ||
    raw.includes('not authorized') ||
    raw.includes('unauthorized') ||
    raw.includes('401') ||
    raw.includes('403')

  return isAccessError ? ADMIN_ACCESS_ERROR : fallback || ADMIN_ACCESS_ERROR
}
