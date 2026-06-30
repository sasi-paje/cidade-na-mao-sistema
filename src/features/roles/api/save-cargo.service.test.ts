/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveCargoWithPermissions } from './save-cargo.service'
import { supabase } from '../../../lib/supabase'

// ──────────────────────────────────────────────
// Mock
// ──────────────────────────────────────────────

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
  getEnvironment: vi.fn().mockReturnValue('development'),
}))

const SAVED_CARGO = { id: 10, name: 'Motorista', code: 'CARGO-1', is_active: true, is_test: false }

// ──────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ──────────────────────────────────────────────
// saveCargoWithPermissions
// ──────────────────────────────────────────────

describe('saveCargoWithPermissions', () => {
  it('criação sem roleId: passa p_role_id null para a RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [SAVED_CARGO], error: null } as any)

    await saveCargoWithPermissions({ name: 'Motorista', code: 'CARGO-1', isTest: false, permissionIds: [] })

    expect(supabase.rpc).toHaveBeenCalledWith('save_user_role_with_permissions', expect.objectContaining({
      p_role_id: null,
      p_name: 'Motorista',
      p_code: 'CARGO-1',
      p_is_test: false,
      p_permission_ids: [],
    }))
  })

  it('edição com roleId numérico: passa p_role_id correto para a RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [SAVED_CARGO], error: null } as any)

    await saveCargoWithPermissions({ roleId: 10, name: 'Motorista', isTest: false, permissionIds: [3, 5] })

    expect(supabase.rpc).toHaveBeenCalledWith('save_user_role_with_permissions', expect.objectContaining({
      p_role_id: 10,
      p_permission_ids: [3, 5],
    }))
  })

  it('converte roleId string para number antes de enviar à RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [SAVED_CARGO], error: null } as any)

    await saveCargoWithPermissions({ roleId: '42', name: 'Supervisor', isTest: true, permissionIds: [] })

    expect(supabase.rpc).toHaveBeenCalledWith('save_user_role_with_permissions', expect.objectContaining({
      p_role_id: 42,
    }))
  })

  it('roleId undefined resulta em p_role_id null', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [SAVED_CARGO], error: null } as any)

    await saveCargoWithPermissions({ name: 'Novo', isTest: false, permissionIds: [] })

    expect(supabase.rpc).toHaveBeenCalledWith('save_user_role_with_permissions', expect.objectContaining({
      p_role_id: null,
    }))
  })

  it('retorna o cargo salvo (primeiro elemento do array retornado pela RPC)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [SAVED_CARGO], error: null } as any)

    const result = await saveCargoWithPermissions({ name: 'Motorista', isTest: false, permissionIds: [] })

    expect(result).toEqual(SAVED_CARGO)
  })

  it('não chama supabase.from — toda a operação é feita via RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [SAVED_CARGO], error: null } as any)

    await saveCargoWithPermissions({ name: 'X', isTest: false, permissionIds: [] })

    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('code 23505 (race condition de duplicidade) → mensagem amigável', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint "uq_master_user_role_name_test"' },
    } as any)

    await expect(
      saveCargoWithPermissions({ name: 'Motorista', isTest: false, permissionIds: [] })
    ).rejects.toThrow('Já existe um cargo cadastrado com este nome.')
  })

  it('mensagem portuguesa da RPC é retransmitida diretamente ao usuário', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'Já existe outro cargo cadastrado com este nome.' },
    } as any)

    await expect(
      saveCargoWithPermissions({ roleId: 1, name: 'Motorista', isTest: false, permissionIds: [] })
    ).rejects.toThrow('Já existe outro cargo cadastrado com este nome.')
  })
})
