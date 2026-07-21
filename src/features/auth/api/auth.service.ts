/**
 * auth.service — autenticação e contexto do usuário via Supabase Auth.
 *
 * Responsabilidade única de acesso ao Supabase para auth/contexto. As telas
 * NÃO devem chamar o Supabase diretamente — usam `useCurrentUser()`.
 *
 * Contexto é resolvido pelas funções de banco (Fase 1):
 *   current_user_id() / current_tenant_id() / current_user_role()
 * que derivam de auth.uid() via master_user.id_auth_user.
 */
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase/client'
import { logSupabaseError } from '../../../lib/supabase/supabase-error'
import { ANON_CONTEXT, type CurrentUserContext, type UserRole } from '../types/auth.types'

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    logSupabaseError('getSession', error)
    return null
  }
  return data.session ?? null
}

export async function signInWithEmailPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/**
 * Resolve o contexto consolidado do usuário atual.
 * Nunca lança: em qualquer falha, devolve um estado seguro (anônimo).
 */
export async function getCurrentUserContext(): Promise<CurrentUserContext> {
  try {
    const session = await getSession()
    const authUser = session?.user ?? null
    if (!authUser) return ANON_CONTEXT

    const [uidRes, tenantRes, roleRes] = await Promise.all([
      supabase.rpc('current_user_id'),
      supabase.rpc('current_tenant_id'),
      supabase.rpc('current_user_role'),
    ])

    const masterUserId = (uidRes.data as string | null) ?? null
    const tenantId = (tenantRes.data as string | null) ?? null
    const role = (roleRes.data as UserRole | null) ?? null

    // Nome amigável: preferir master_user.name; senão metadados do auth.
    let name: string | null =
      (authUser.user_metadata?.full_name as string | undefined) ??
      authUser.email?.split('@')[0] ??
      null
    if (masterUserId) {
      const { data: mu } = await supabase
        .from('master_user')
        .select('name')
        .eq('id', masterUserId)
        .maybeSingle()
      if (mu?.name) name = mu.name as string
    }

    // Slug/nome do tenant da sessão — usados para casar com o `?tenant=` da URL
    // (a RLS `tenant_select` só libera a própria linha: id = current_tenant_id()).
    let tenantSlug: string | null = null
    let tenantName: string | null = null
    if (tenantId) {
      const { data: tenant } = await supabase
        .from('master_tenant')
        .select('slug, name')
        .eq('id', tenantId)
        .maybeSingle()
      tenantSlug = (tenant?.slug as string | undefined) ?? null
      tenantName = (tenant?.name as string | undefined) ?? null
    }

    const isAdmin = role === 'admin'
    const isLeader = role === 'community_leader'
    return {
      authUserId: authUser.id,
      masterUserId,
      tenantId,
      tenantSlug,
      tenantName,
      role,
      isAdmin,
      isLeader,
      isPublic: !isAdmin && !isLeader, // sem role / sem cadastro = público
      email: authUser.email ?? null,
      name,
      loading: false,
      isAuthenticated: true,
    }
  } catch (e) {
    logSupabaseError('getCurrentUserContext', e)
    return ANON_CONTEXT
  }
}

export const authService = {
  getSession,
  signInWithEmailPassword,
  signOut,
  getCurrentUserContext,
}
