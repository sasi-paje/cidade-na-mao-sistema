import { createContext } from 'react'

/**
 * Estado da troca SASI → sessão Supabase.
 *  - idle: sem token a trocar.
 *  - exchanging: validando/criando sessão.
 *  - authenticated: sessão Supabase emitida (a autorização real passa a ser do
 *    `useCurrentUser`/AuthProvider).
 *  - error: falha na troca.
 */
export type SasiAuthStatus = 'idle' | 'exchanging' | 'authenticated' | 'error'

export interface SasiAuthValue {
  status: SasiAuthStatus
  error: string | null
  /** true enquanto a troca está em andamento (usar para o gate de loading). */
  loading: boolean
}

export const SasiAuthContext = createContext<SasiAuthValue | null>(null)
