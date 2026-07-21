/**
 * Tipos da camada de autenticação/contexto (Etapa 9.1/9.2).
 */

/** Papéis reais existentes no banco (ref_user_role). Não há papel 'public'. */
export type UserRole = 'admin' | 'community_leader'

/**
 * Contexto consolidado do usuário atual, derivado da sessão Supabase + funções
 * de banco (`current_user_id/tenant/role`).
 *
 * Estados possíveis:
 *  - anônimo: isAuthenticated=false, isPublic=true
 *  - autenticado sem cadastro (sem master_user vinculado): isAuthenticated=true,
 *    masterUserId=null, role=null, isPublic=true ("authenticatedWithoutProfile")
 *  - autenticado com perfil: role admin|community_leader
 */
export interface CurrentUserContext {
  authUserId: string | null
  masterUserId: string | null
  tenantId: string | null
  /** Slug do tenant da sessão (casa com o `:tenant` do path mobile e o `?tenant=` do web). */
  tenantSlug: string | null
  /** Nome do tenant da sessão (o tenant da URL também aceita o nome, como no web). */
  tenantName: string | null
  role: UserRole | null
  isAdmin: boolean
  isLeader: boolean
  isPublic: boolean
  email: string | null
  name: string | null
  loading: boolean
  isAuthenticated: boolean
}

/** Valor exposto pelo AuthProvider: contexto + ação de recarregar. */
export interface AuthContextValue extends CurrentUserContext {
  refetch: () => Promise<void>
}

/** Estado inicial (carregando, ainda sem resolução de sessão). */
export const LOADING_CONTEXT: CurrentUserContext = {
  authUserId: null,
  masterUserId: null,
  tenantId: null,
  tenantSlug: null,
  tenantName: null,
  role: null,
  isAdmin: false,
  isLeader: false,
  isPublic: true,
  email: null,
  name: null,
  loading: true,
  isAuthenticated: false,
}

/** Estado anônimo resolvido (sem sessão). */
export const ANON_CONTEXT: CurrentUserContext = {
  ...LOADING_CONTEXT,
  loading: false,
}
