/**
 * Troca do token SASI por uma sessão real do Supabase Auth.
 *
 * A edge function `exchange-sasi-token` valida o token na SASI, resolve o
 * usuário, garante o auth.users e devolve um `tokenHash` de magic link. O
 * frontend conclui o login com `verifyOtp`, passando a ter uma sessão Supabase
 * de verdade (auth.uid() válido → RLS libera os dados).
 */
import { supabase } from '../../../lib/supabase'
import { clearSasiToken } from './sasi-token.service'

/** Identidade de eventos resolvida a partir do token SASI. */
export interface SasiIdentity {
  id: string
  tenantId: string
  name: string | null
  email: string | null
  /** Code do cargo (ex.: 'community_leader', 'admin') ou null se sem cargo. */
  role: string | null
}

export interface SasiExchangeResult {
  success: boolean
  identity?: SasiIdentity
  /** Mensagem amigável quando `success` é false. */
  error?: string
}

interface EdgeOk {
  success: true
  identity: SasiIdentity
  supabaseAuth: { email: string; tokenHash: string; type: 'magiclink' }
}
interface EdgeErr {
  success: false
  error: string
}

/**
 * Troca o token SASI por uma sessão Supabase ativa no client.
 * Nunca lança: em qualquer falha devolve `{ success: false, error }`.
 * Em caso de sucesso, limpa o token SASI do sessionStorage.
 */
export async function exchangeSasiTokenForSupabaseSession(
  token: string,
  opts?: { refresh?: boolean },
): Promise<SasiExchangeResult> {
  const trimmed = token.trim()
  if (!trimmed) return { success: false, error: 'Token não informado.' }

  // `refresh` → manda `refreshToken` (backend faz refresh→access→profile.id);
  // caso contrário, manda `token` (access token já emitido — caso atual).
  const body = opts?.refresh ? { refreshToken: trimmed } : { token: trimmed }
  const { data, error } = await supabase.functions.invoke<EdgeOk | EdgeErr>('exchange-sasi-token', {
    body,
  })

  if (error) {
    return { success: false, error: 'Não foi possível validar o token SASI.' }
  }
  if (!data || data.success !== true) {
    return { success: false, error: (data as EdgeErr | null)?.error ?? 'Token SASI inválido.' }
  }

  // Conclui o login oficial trocando o hashed_token por sessão.
  const { error: otpError } = await supabase.auth.verifyOtp({
    type: data.supabaseAuth.type,
    token_hash: data.supabaseAuth.tokenHash,
  })
  if (otpError) {
    return { success: false, error: 'Falha ao iniciar a sessão.' }
  }

  // Sessão Supabase ativa: o token SASI não é mais necessário.
  clearSasiToken()
  return { success: true, identity: data.identity }
}
