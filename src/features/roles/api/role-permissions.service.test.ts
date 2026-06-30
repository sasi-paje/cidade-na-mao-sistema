/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  normalizeRolePermissions,
  fetchActivePermissions,
  saveRolePermissions,
  SystemPermission,
} from './role-permissions.service'
import { supabase } from '../../../lib/supabase'

// ──────────────────────────────────────────────
// Mock
// ──────────────────────────────────────────────

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
  getEnvironment: vi.fn().mockReturnValue('development'),
}))

function qb(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const chain: Record<string, unknown> = {}
  const self = () => chain

  for (const m of [
    'select', 'eq', 'neq', 'limit', 'order', 'range',
    'ilike', 'or', 'not', 'in', 'is', 'update', 'insert', 'upsert', 'delete',
  ]) {
    chain[m] = vi.fn().mockImplementation(self)
  }

  chain.single = vi.fn().mockResolvedValue(result)
  chain.maybeSingle = vi.fn().mockResolvedValue(result)
  chain.then = (onFulfilled: (v: unknown) => void) => onFulfilled(result)

  return chain
}

// ──────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ──────────────────────────────────────────────
// normalizeRolePermissions — função pura, sem mocks
// ──────────────────────────────────────────────

const basePerms: SystemPermission[] = [
  { id: 10, code: 'VIEW',   name: 'Visualizar', description: null },
  { id: 20, code: 'CREATE', name: 'Criar',       description: null },
  { id: 30, code: 'EDIT',   name: 'Editar',      description: null },
]

describe('normalizeRolePermissions', () => {
  it('retorna apenas VIEW quando nenhuma permissão é selecionada', () => {
    const result = normalizeRolePermissions([], basePerms)
    expect(result).toEqual([10])
  })

  it('inclui VIEW quando somente CREATE é selecionado', () => {
    const result = normalizeRolePermissions([20], basePerms)
    expect(result).toContain(10)
    expect(result).toContain(20)
    expect(result).toHaveLength(2)
  })

  it('inclui todas as permissões selecionadas mais VIEW', () => {
    const result = normalizeRolePermissions([20, 30], basePerms)
    expect(result).toContain(10)
    expect(result).toContain(20)
    expect(result).toContain(30)
    expect(result).toHaveLength(3)
  })

  it('não duplica VIEW quando já está na seleção', () => {
    const result = normalizeRolePermissions([10, 20], basePerms)
    expect(result.filter(id => id === 10)).toHaveLength(1)
  })

  it('usa code VIEW para localizar a permissão — não ID fixo', () => {
    const permsComIdAlto: SystemPermission[] = [
      { id: 999, code: 'VIEW',   name: 'Visualizar', description: null },
      { id: 888, code: 'CREATE', name: 'Criar',       description: null },
    ]
    const result = normalizeRolePermissions([888], permsComIdAlto)
    expect(result).toContain(999)
    expect(result).not.toContain(1)
    expect(result).not.toContain(2)
  })

  it('lança erro amigável quando VIEW não existe nas permissões disponíveis', () => {
    const semView: SystemPermission[] = [
      { id: 20, code: 'CREATE', name: 'Criar', description: null },
    ]
    expect(() => normalizeRolePermissions([], semView))
      .toThrow('Permissão padrão Visualizar não encontrada.')
  })
})

// ──────────────────────────────────────────────
// fetchActivePermissions
// ──────────────────────────────────────────────

describe('fetchActivePermissions', () => {
  const mockPerms: SystemPermission[] = [
    { id: 10, code: 'VIEW',   name: 'Visualizar', description: null },
    { id: 20, code: 'CREATE', name: 'Criar',       description: null },
  ]

  it('retorna lista de permissões com id, code e name', async () => {
    const chain = qb({ data: mockPerms, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await fetchActivePermissions()

    expect(result).toEqual(mockPerms)
  })

  it('retorna array vazio quando banco não retorna dados (sem fallback hardcoded)', async () => {
    const chain = qb({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await fetchActivePermissions()

    expect(result).toEqual([])
  })

  it('aplica filtros is_active=true e is_test=false na query', async () => {
    const chain = qb({ data: mockPerms, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await fetchActivePermissions()

    expect(chain.eq).toHaveBeenCalledWith('is_active', true)
    expect(chain.eq).toHaveBeenCalledWith('is_test', false)
  })

  it('lança erro quando Supabase retorna error (sem silenciar)', async () => {
    const chain = qb({ data: null, error: { message: 'Tabela não encontrada' } })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await expect(fetchActivePermissions()).rejects.toThrow('Tabela não encontrada')
  })
})

// ──────────────────────────────────────────────
// saveRolePermissions
// ──────────────────────────────────────────────

describe('saveRolePermissions', () => {
  it('chama supabase.rpc com save_user_role_permissions', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)

    await saveRolePermissions(1, [10, 20])

    expect(supabase.rpc).toHaveBeenCalledWith('save_user_role_permissions', {
      p_role_id: 1,
      p_permission_ids: [10, 20],
    })
  })

  it('resolve sem erro quando RPC retorna sucesso', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)

    await expect(saveRolePermissions(1, [10])).resolves.toBeUndefined()
  })

  it('lança erro quando RPC retorna error com message', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'Cargo 999 não encontrado.' },
    } as any)

    await expect(saveRolePermissions(999, [])).rejects.toThrow('Cargo 999 não encontrado.')
  })

  it('aceita lista vazia — VIEW é adicionado pelo RPC no banco', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)

    await expect(saveRolePermissions(1, [])).resolves.toBeUndefined()
    expect(supabase.rpc).toHaveBeenCalledWith('save_user_role_permissions', {
      p_role_id: 1,
      p_permission_ids: [],
    })
  })

  it('usa mensagem padrão quando error não tem message', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: {} } as any)

    await expect(saveRolePermissions(1, [])).rejects.toThrow(
      'Erro ao salvar permissões do cargo.'
    )
  })
})
