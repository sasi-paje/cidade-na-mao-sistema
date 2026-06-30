/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchAvailablePages } from './user-pages.service'
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
// fetchAvailablePages
// ──────────────────────────────────────────────

describe('fetchAvailablePages', () => {
  it('consulta a tabela master_system_page', async () => {
    const chain = qb({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await fetchAvailablePages()

    expect(supabase.from).toHaveBeenCalledWith('master_system_page')
  })

  it('filtra is_active = true', async () => {
    const chain = qb({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await fetchAvailablePages()

    expect(chain.eq).toHaveBeenCalledWith('is_active', true)
  })

  it('filtra is_test = false independente do ambiente', async () => {
    // getEnvironment está mockado como 'development' — mas is_test deve ser false mesmo assim
    const chain = qb({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await fetchAvailablePages()

    expect(chain.eq).toHaveBeenCalledWith('is_test', false)
  })

  it('ordena por display_order ascendente', async () => {
    const chain = qb({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await fetchAvailablePages()

    expect(chain.order).toHaveBeenCalledWith('display_order', { ascending: true })
  })

  it('ordena por name como critério secundário', async () => {
    const chain = qb({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await fetchAvailablePages()

    expect(chain.order).toHaveBeenCalledWith('name', { ascending: true })
  })

  it('retorna o array de páginas quando consulta é bem-sucedida', async () => {
    const pages = [
      { id: 1, code: 'DASHBOARD', name: 'Dashboard', route_path: '/dashboard', module_name: 'admin', display_order: 1 },
      { id: 2, code: 'ROUTES', name: 'Rotas', route_path: '/routes', module_name: 'admin', display_order: 2 },
    ]
    const chain = qb({ data: pages, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await fetchAvailablePages()

    expect(result).toEqual(pages)
  })

  it('retorna array vazio (sem lançar erro) quando não há páginas cadastradas', async () => {
    const chain = qb({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await fetchAvailablePages()

    expect(result).toEqual([])
  })

  it('retorna array vazio (sem lançar erro) quando data é null', async () => {
    const chain = qb({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await fetchAvailablePages()

    expect(result).toEqual([])
  })

  it('lança erro com mensagem correta quando a consulta falha', async () => {
    const chain = qb({ data: null, error: { code: '42P01', message: 'relation does not exist' } })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await expect(fetchAvailablePages()).rejects.toThrow(
      'Não foi possível carregar as páginas do sistema.'
    )
  })

  it('não chama supabase.rpc — toda a operação é feita via from()', async () => {
    const chain = qb({ data: [], error: null })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await fetchAvailablePages()

    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})
