import { useContext } from 'react'
import { SasiAuthContext, type SasiAuthValue } from '../context/SasiAuthContext'

/**
 * Acessa o estado da troca SASI → sessão Supabase.
 * Fora de um SasiAuthProvider, devolve um estado neutro ('idle').
 */
export function useSasiAuth(): SasiAuthValue {
  const ctx = useContext(SasiAuthContext)
  if (ctx) return ctx
  return { status: 'idle', error: null, loading: false }
}
