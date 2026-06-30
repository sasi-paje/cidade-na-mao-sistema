import { describe, it, expect, beforeEach, vi } from 'vitest'
import { exchangeSasiTokenForSupabaseSession } from './sasi-auth.service'
import { storeSasiToken, getStoredSasiToken } from './sasi-token.service'
import { supabase } from '../../../lib/supabase'

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { verifyOtp: vi.fn() },
  },
}))

const invoke = vi.mocked(supabase.functions.invoke)
const verifyOtp = vi.mocked(supabase.auth.verifyOtp)

const IDENTITY = {
  id: 'u1',
  tenantId: 't1',
  name: 'Maria',
  email: 'maria@x.com',
  role: 'community_leader',
}

function edgeSuccess(tokenHash = 'hash-123') {
  return {
    data: {
      success: true,
      identity: IDENTITY,
      supabaseAuth: { email: IDENTITY.email, tokenHash, type: 'magiclink' as const },
    },
    error: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  window.sessionStorage.clear()
  verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: null } as never)
})

describe('exchangeSasiTokenForSupabaseSession', () => {
  // 1. token vazio
  it('não chama a edge function com token vazio', async () => {
    const result = await exchangeSasiTokenForSupabaseSession('   ')
    expect(result).toEqual({ success: false, error: 'Token não informado.' })
    expect(invoke).not.toHaveBeenCalled()
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  // 2. token inválido (SASI 401)
  it('mapeia token inválido vindo da edge function', async () => {
    invoke.mockResolvedValueOnce({
      data: { success: false, error: 'Token SASI invalido ou expirado.' },
      error: null,
    } as never)
    const result = await exchangeSasiTokenForSupabaseSession('bad')
    expect(result).toEqual({ success: false, error: 'Token SASI invalido ou expirado.' })
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  // 3. master_user não encontrado (403)
  it('mapeia master_user não encontrado', async () => {
    invoke.mockResolvedValueOnce({
      data: { success: false, error: 'Usuario nao encontrado para o email retornado pela SASI.' },
      error: null,
    } as never)
    const result = await exchangeSasiTokenForSupabaseSession('tok')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/nao encontrado/i)
  })

  // 4. master_user duplicado (409)
  it('mapeia master_user duplicado', async () => {
    invoke.mockResolvedValueOnce({
      data: { success: false, error: 'Mais de um usuario encontrado para o email retornado pela SASI.' },
      error: null,
    } as never)
    const result = await exchangeSasiTokenForSupabaseSession('tok')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/mais de um/i)
  })

  // 5 + 6. auth user criado / master_user vinculado → ambos chegam como sucesso ao frontend
  it('conclui o login quando a edge function retorna sucesso (auth criado ou já vinculado)', async () => {
    invoke.mockResolvedValueOnce(edgeSuccess() as never)
    const result = await exchangeSasiTokenForSupabaseSession('tok')
    expect(result).toEqual({ success: true, identity: IDENTITY })
    expect(invoke).toHaveBeenCalledWith('exchange-sasi-token', { body: { token: 'tok' } })
  })

  // 7 + 8. tokenHash retornado → verifyOtp chamado com ele
  it('chama verifyOtp com o token_hash do magic link', async () => {
    invoke.mockResolvedValueOnce(edgeSuccess('hashed-xyz') as never)
    await exchangeSasiTokenForSupabaseSession('tok')
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'magiclink', token_hash: 'hashed-xyz' })
  })

  // 9. token SASI é limpo após sessão Supabase
  it('limpa o token SASI do sessionStorage após a troca bem-sucedida', async () => {
    storeSasiToken('sasi-abc')
    expect(getStoredSasiToken()).toBe('sasi-abc')

    invoke.mockResolvedValueOnce(edgeSuccess() as never)
    await exchangeSasiTokenForSupabaseSession('sasi-abc')

    expect(getStoredSasiToken()).toBeNull()
  })

  // 10. erro no verifyOtp → mensagem controlada, token NÃO é limpo
  it('trata erro do verifyOtp com mensagem controlada', async () => {
    storeSasiToken('sasi-abc')
    invoke.mockResolvedValueOnce(edgeSuccess() as never)
    verifyOtp.mockResolvedValueOnce({ data: { user: null, session: null }, error: new Error('otp') } as never)

    const result = await exchangeSasiTokenForSupabaseSession('sasi-abc')
    expect(result).toEqual({ success: false, error: 'Falha ao iniciar a sessão.' })
    expect(getStoredSasiToken()).toBe('sasi-abc')
  })

  // erro de transporte da invocação
  it('trata erro de transporte da invocação', async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error('network') } as never)
    const result = await exchangeSasiTokenForSupabaseSession('tok')
    expect(result).toEqual({ success: false, error: 'Não foi possível validar o token SASI.' })
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('faz trim do token antes de enviar', async () => {
    invoke.mockResolvedValueOnce(edgeSuccess() as never)
    await exchangeSasiTokenForSupabaseSession('  spaced  ')
    expect(invoke).toHaveBeenCalledWith('exchange-sasi-token', { body: { token: 'spaced' } })
  })
})
