/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveUserPageAccessFromRole, getFriendlyUserPageAccessError } from './user-page-access.service'
import { supabase } from '../../../lib/supabase'

// ──────────────────────────────────────────────
// Mock
// ──────────────────────────────────────────────

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
  getEnvironment: vi.fn().mockReturnValue('development'),
}))

// ──────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ──────────────────────────────────────────────
// saveUserPageAccessFromRole
// ──────────────────────────────────────────────

describe('saveUserPageAccessFromRole', () => {
  it('chama a RPC correta com os parâmetros mapeados', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)

    await saveUserPageAccessFromRole({
      userId: 'user-uuid-123',
      roleId: 5,
      pageIds: [1, 2, 3],
      isTest: false,
    })

    expect(supabase.rpc).toHaveBeenCalledWith('save_user_page_access_from_role', {
      p_user_id: 'user-uuid-123',
      p_role_id: 5,
      p_page_ids: [1, 2, 3],
      p_is_test: false,
    })
  })

  it('converte roleId string para number antes de enviar à RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)

    await saveUserPageAccessFromRole({
      userId: 'user-uuid-abc',
      roleId: '42',
      pageIds: ['10', '20'],
      isTest: true,
    })

    expect(supabase.rpc).toHaveBeenCalledWith('save_user_page_access_from_role', expect.objectContaining({
      p_role_id: 42,
      p_page_ids: [10, 20],
      p_is_test: true,
    }))
  })

  it('envia array vazio quando pageIds está vazio', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)

    await saveUserPageAccessFromRole({
      userId: 'user-uuid-abc',
      roleId: 7,
      pageIds: [],
      isTest: false,
    })

    expect(supabase.rpc).toHaveBeenCalledWith('save_user_page_access_from_role', expect.objectContaining({
      p_page_ids: [],
    }))
  })

  it('não chama supabase.from — toda a operação é feita via RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)

    await saveUserPageAccessFromRole({ userId: 'u', roleId: 1, pageIds: [], isTest: false })

    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('lança erro amigável quando a RPC retorna erro', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'could not find function save_user_page_access_from_role' },
    } as any)

    await expect(
      saveUserPageAccessFromRole({ userId: 'u', roleId: 1, pageIds: [], isTest: false })
    ).rejects.toThrow('Função de sincronização de páginas não encontrada')
  })

  it('mensagem portuguesa da RPC é retransmitida ao usuário', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'Usuário não encontrado.' },
    } as any)

    await expect(
      saveUserPageAccessFromRole({ userId: 'u-inexistente', roleId: 1, pageIds: [], isTest: false })
    ).rejects.toThrow('Usuário não encontrado.')
  })
})

// ──────────────────────────────────────────────
// getFriendlyUserPageAccessError
// ──────────────────────────────────────────────

describe('getFriendlyUserPageAccessError', () => {
  it('PGRST202 → mensagem de migration não aplicada', () => {
    const msg = getFriendlyUserPageAccessError({ code: 'PGRST202', message: 'could not find' })
    expect(msg).toContain('migration')
  })

  it('mensagem de cargo inativo → mensagem amigável', () => {
    const msg = getFriendlyUserPageAccessError({ message: 'Cargo não encontrado ou inativo.' })
    expect(msg).toBe('Cargo não encontrado ou inativo.')
  })

  it('erro sem mensagem → fallback genérico', () => {
    const msg = getFriendlyUserPageAccessError({})
    expect(msg).toBe('Não foi possível salvar as permissões do usuário.')
  })
})
