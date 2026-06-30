/**
 * AuthProvider — carrega e mantém o contexto do usuário atual.
 *
 * - Resolve o contexto na montagem (sessão + funções de banco).
 * - Reage a login/logout via supabase.auth.onAuthStateChange.
 * - Expõe `refetch` para recarregar sob demanda.
 *
 * Não quebra a tela em erro: o service devolve estado anônimo seguro.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../../../lib/supabase/client'
import { getCurrentUserContext } from '../api/auth.service'
import { LOADING_CONTEXT, type CurrentUserContext } from '../types/auth.types'
import { AuthContext } from './AuthContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<CurrentUserContext>(LOADING_CONTEXT)

  const refetch = useCallback(async () => {
    setCtx((prev) => ({ ...prev, loading: true }))
    const next = await getCurrentUserContext()
    setCtx(next)
  }, [])

  useEffect(() => {
    let active = true

    // resolução inicial
    getCurrentUserContext().then((next) => {
      if (active) setCtx(next)
    })

    // reage a SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      getCurrentUserContext().then((next) => {
        if (active) setCtx(next)
      })
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({ ...ctx, refetch }), [ctx, refetch])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
