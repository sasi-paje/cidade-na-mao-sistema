/**
 * useCurrentUser — acesso ao contexto do usuário atual (AuthProvider).
 *
 * Telas/hooks consomem isto; nunca o Supabase diretamente.
 * Retorna o contexto consolidado + `refetch`.
 */
import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import type { AuthContextValue } from '../types/auth.types'

export function useCurrentUser(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useCurrentUser deve ser usado dentro de <AuthProvider>')
  }
  return ctx
}
