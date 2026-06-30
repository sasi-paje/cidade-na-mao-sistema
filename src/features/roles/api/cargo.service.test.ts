/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  checkCargoDuplicate,
  getDuplicateCargoMessage,
  getFriendlyCargoSaveError,
  activateCargo,
  inactivateCargo,
  getFriendlyCargoInactivationError,
} from './cargo.service'
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
// checkCargoDuplicate
// ──────────────────────────────────────────────

describe('checkCargoDuplicate', () => {
  it('retorna isDuplicate false quando nome não existe no banco', async () => {
    const chain = qb({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await checkCargoDuplicate('Cargo Novo', false)

    expect(result).toEqual({ isDuplicate: false, isInactive: false })
  })

  it('retorna isDuplicate true e isInactive false quando cargo ativo já existe', async () => {
    const chain = qb({ data: { id: 42, is_active: true }, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await checkCargoDuplicate('Motorista', false)

    expect(result).toEqual({ isDuplicate: true, isInactive: false })
  })

  it('retorna isDuplicate true e isInactive true quando cargo inativo já existe', async () => {
    const chain = qb({ data: { id: 42, is_active: false }, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await checkCargoDuplicate('Motorista', false)

    expect(result).toEqual({ isDuplicate: true, isInactive: true })
  })

  it('modo edição inclui .neq("id", excludeId) na query', async () => {
    const chain = qb({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await checkCargoDuplicate('Administrador', true, 99)

    expect(chain.neq).toHaveBeenCalledWith('id', 99)
  })

  it('normaliza nome com trim antes de consultar o banco', async () => {
    const chain = qb({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await checkCargoDuplicate('  Cargo com espaço  ', false)

    expect(chain.eq).toHaveBeenCalledWith('name', 'Cargo com espaço')
  })

  it('lança erro quando Supabase retorna error', async () => {
    const chain = qb({ data: null, error: { message: 'conexão recusada' } })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await expect(checkCargoDuplicate('Qualquer', false)).rejects.toThrow('conexão recusada')
  })
})

// ──────────────────────────────────────────────
// getDuplicateCargoMessage — função pura, sem mocks
// ──────────────────────────────────────────────

describe('getDuplicateCargoMessage', () => {
  it('modo criar com cargo ativo → mensagem sem mencionar inativo', () => {
    const msg = getDuplicateCargoMessage(false, false)
    expect(msg).toBe('Já existe um cargo cadastrado com este nome.')
  })

  it('modo criar com cargo inativo → menciona inativo e orienta ativar', () => {
    const msg = getDuplicateCargoMessage(true, false)
    expect(msg).toContain('inativo')
    expect(msg).toContain('Ative o cargo existente')
  })

  it('modo editar → menciona "outro cargo"', () => {
    const msg = getDuplicateCargoMessage(false, true)
    expect(msg).toBe('Já existe outro cargo cadastrado com este nome.')
  })
})

// ──────────────────────────────────────────────
// getFriendlyCargoSaveError — função pura, sem mocks
// ──────────────────────────────────────────────

describe('getFriendlyCargoSaveError', () => {
  it('code 23505 retorna mensagem amigável sem detalhes técnicos', () => {
    const result = getFriendlyCargoSaveError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "uq_master_user_role_name_test"',
    })
    expect(result).toBe('Já existe um cargo cadastrado com este nome.')
  })

  it('outro código retorna a message original do banco', () => {
    const result = getFriendlyCargoSaveError({
      code: '42703',
      message: 'column "nome" does not exist',
    })
    expect(result).toBe('column "nome" does not exist')
  })
})

// ──────────────────────────────────────────────
// activateCargo
// ──────────────────────────────────────────────

describe('activateCargo', () => {
  it('chama supabase.from com is_active true e filtros corretos', async () => {
    const chain = qb({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await activateCargo(10, false)

    expect(supabase.from).toHaveBeenCalledWith('master_user_role')
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: true })
    )
    expect(chain.eq).toHaveBeenCalledWith('id', 10)
    expect(chain.eq).toHaveBeenCalledWith('is_test', false)
  })

  it('converte roleId string para number antes de filtrar', async () => {
    const chain = qb({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await activateCargo('42', true)

    expect(chain.eq).toHaveBeenCalledWith('id', 42)
  })

  it('não chama supabase.rpc — não toca em permissões', async () => {
    const chain = qb({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await activateCargo(10, false)

    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('lança erro quando supabase retorna error', async () => {
    const chain = qb({ data: null, error: { message: 'permissão negada' } })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await expect(activateCargo(10, false)).rejects.toThrow('permissão negada')
  })
})

// ──────────────────────────────────────────────
// inactivateCargo
// ──────────────────────────────────────────────

describe('inactivateCargo', () => {
  it('chama supabase.rpc com inactivate_user_role', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)

    await inactivateCargo(10, false)

    expect(supabase.rpc).toHaveBeenCalledWith('inactivate_user_role', {
      p_role_id: 10,
      p_is_test: false,
    })
  })

  it('não chama supabase.from — usa apenas RPC (permissões não são tocadas)', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any)

    await inactivateCargo(10, false)

    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('lança erro amigável quando RPC retorna error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'Este cargo possui usuários ativos vinculados e não pode ser inativado.' },
    } as any)

    await expect(inactivateCargo(10, false)).rejects.toThrow(
      'Este cargo possui usuários ativos vinculados e não pode ser inativado.'
    )
  })
})

// ──────────────────────────────────────────────
// getFriendlyCargoInactivationError — função pura
// ──────────────────────────────────────────────

describe('getFriendlyCargoInactivationError', () => {
  it('mensagem com "usuários ativos vinculados" → mensagem amigável', () => {
    const result = getFriendlyCargoInactivationError({
      message: 'Este cargo possui usuários ativos vinculados e não pode ser inativado.',
    })
    expect(result).toContain('usuários ativos vinculados')
  })

  it('código PGRST202 (RPC não existe) → orienta verificar migration', () => {
    const result = getFriendlyCargoInactivationError({
      code: 'PGRST202',
      message: 'Could not find the function public.inactivate_user_role(p_role_id, p_is_test)',
    })
    expect(result).toContain('migration')
  })

  it('"Could not find" sem código PGRST202 → mesma orientação de migration', () => {
    const result = getFriendlyCargoInactivationError({
      message: 'Could not find the function public.inactivate_user_role',
    })
    expect(result).toContain('migration')
  })

  it('"Cargo não encontrado" → mensagem amigável', () => {
    const result = getFriendlyCargoInactivationError({ message: 'Cargo não encontrado.' })
    expect(result).toBe('Cargo não encontrado.')
  })

  it('"Cargo já está inativo" → mensagem amigável', () => {
    const result = getFriendlyCargoInactivationError({ message: 'Cargo já está inativo.' })
    expect(result).toBe('Este cargo já está inativo.')
  })

  it('erro genérico sem código nem mensagem conhecida → fallback', () => {
    const result = getFriendlyCargoInactivationError({ message: 'unexpected internal error' })
    expect(result).toBe('Não foi possível inativar o cargo.')
  })

  it('erro sem message nem code → fallback', () => {
    const result = getFriendlyCargoInactivationError({})
    expect(result).toBe('Não foi possível inativar o cargo.')
  })
})
