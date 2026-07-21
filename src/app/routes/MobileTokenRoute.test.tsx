import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { MobileTokenRoute } from './MobileTokenRoute'

/**
 * MobileTokenRoute — foco no ESCOPO POR TENANT no PATH (`/m/:tenant/...`):
 *   - libera quando o `:tenant` do path casa com o slug OU o nome da sessão;
 *   - bloqueia (fail-closed) quando diverge;
 *   - bloqueia sem sessão (nunca por role).
 *
 * A sessão (`useCurrentUser`) é mockada por teste. `useSasiAuth` não está em
 * troca (loading=false) para os cenários já resolvidos.
 */
const useCurrentUserMock = vi.fn()
vi.mock('../../features/auth', () => ({
  useCurrentUser: () => useCurrentUserMock(),
}))
vi.mock('../../features/sasi-token', () => ({
  useSasiAuth: () => ({ loading: false }),
}))

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<MobileTokenRoute />}>
          <Route path="/m/:tenant/usuario/eventos" element={<div>lista</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

const SESSION = {
  loading: false,
  isAuthenticated: true,
  tenantSlug: 'borba',
  tenantName: 'Borba',
}

afterEach(() => {
  cleanup()
  useCurrentUserMock.mockReset()
})

describe('MobileTokenRoute — escopo por tenant (path)', () => {
  it('libera quando o :tenant do path casa com o slug da sessão', () => {
    useCurrentUserMock.mockReturnValue(SESSION)
    renderAt('/m/borba/usuario/eventos')
    expect(screen.getByText('lista')).toBeInTheDocument()
  })

  it('libera quando o :tenant do path casa com o NOME da sessão (case-insensitive)', () => {
    useCurrentUserMock.mockReturnValue({ ...SESSION, tenantSlug: 'brb', tenantName: 'Borba' })
    renderAt('/m/borba/usuario/eventos')
    expect(screen.getByText('lista')).toBeInTheDocument()
  })

  it('normaliza o :tenant do path (maiúsculas) antes de comparar', () => {
    useCurrentUserMock.mockReturnValue(SESSION)
    renderAt('/m/BORBA/usuario/eventos')
    expect(screen.getByText('lista')).toBeInTheDocument()
  })

  it('bloqueia (fail-closed) quando o :tenant do path diverge da sessão', () => {
    useCurrentUserMock.mockReturnValue(SESSION)
    renderAt('/m/outra-cidade/usuario/eventos')
    expect(screen.getByText('Acesso inválido')).toBeInTheDocument()
    expect(screen.queryByText('lista')).not.toBeInTheDocument()
  })

  it('bloqueia sem sessão (nunca por role)', () => {
    useCurrentUserMock.mockReturnValue({ loading: false, isAuthenticated: false })
    renderAt('/m/borba/usuario/eventos')
    expect(screen.getByText('Acesso inválido')).toBeInTheDocument()
  })
})
