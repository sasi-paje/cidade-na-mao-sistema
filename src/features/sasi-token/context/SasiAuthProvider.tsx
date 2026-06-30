import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  resolveSasiTokenWithKind,
  clearSasiToken,
  getStoredSasiToken,
  getSasiTokenParamFromUrl,
} from '../api/sasi-token.service'
import { exchangeSasiTokenForSupabaseSession } from '../api/sasi-auth.service'
import { useSasiTokenCapture } from '../hooks/useSasiTokenCapture'
import { SasiAuthContext, type SasiAuthStatus } from './SasiAuthContext'

/**
 * SasiAuthProvider — mecanismo de **login** compartilhado por `/m/*` e `/web/*`:
 * ao detectar um token SASI (deep-link `?sasi-token=...`), troca-o por uma
 * sessão real do Supabase Auth. Após a troca, a fonte de autorização passa a
 * ser o `AuthProvider`/`useCurrentUser` (este provider não autoriza nada).
 *
 * O status inicial é derivado do `useSearchParams` (router-aware), não de
 * `window.location` — assim, já no primeiro render sabemos que há uma troca em
 * andamento e os guards exibem o spinner em vez de redirecionar antes da hora.
 */
export function SasiAuthProvider({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams()

  // Captura o sasi-token de qualquer rota, guarda e limpa a URL.
  useSasiTokenCapture()

  const [status, setStatus] = useState<SasiAuthStatus>(() =>
    getSasiTokenParamFromUrl(searchParams.toString()) || getStoredSasiToken() ? 'exchanging' : 'idle'
  )
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    // Protege contra o double-invoke do StrictMode e re-trocas.
    if (started.current) return
    started.current = true

    const resolved = resolveSasiTokenWithKind()
    if (!resolved) return // status já é 'idle'

    const exchange =
      resolved.kind === 'refresh'
        ? exchangeSasiTokenForSupabaseSession(resolved.value, { refresh: true })
        : exchangeSasiTokenForSupabaseSession(resolved.value)

    // Sem guard de "active"/cleanup: o ref `started` já garante uma única troca.
    // Sob React.StrictMode (dev), o cleanup do 1º mount marcava active=false e
    // o 2º mount não re-rodava (started=true), descartando o resultado e
    // prendendo o status em 'exchanging' ("Validando acesso..." infinito).
    exchange.then((result) => {
      if (result.success) {
        // Sessão Supabase ativa (token já limpo pelo serviço).
        setStatus('authenticated')
      } else {
        clearSasiToken()
        setError(result.error ?? 'Token SASI inválido.')
        setStatus('error')
      }
    })
  }, [])

  return (
    <SasiAuthContext.Provider value={{ status, error, loading: status === 'exchanging' }}>
      {children}
    </SasiAuthContext.Provider>
  )
}
