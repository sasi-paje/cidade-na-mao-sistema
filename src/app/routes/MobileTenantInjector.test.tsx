import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { MobileTenantInjector } from './MobileTenantInjector'

/**
 * MobileTenantInjector — injeta o slug do tenant da SESSÃO em URLs mobile SEM
 * tenant no path, preservando o restante do caminho e a query. Fail-closed sem
 * sessão (ou sessão sem tenant).
 */
const useCurrentUserMock = vi.fn()
vi.mock('../../features/auth', () => ({
  useCurrentUser: () => useCurrentUserMock(),
}))
vi.mock('../../features/sasi-token', () => ({
  useSasiAuth: () => ({ loading: false }),
}))

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname + loc.search}</div>
}

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <Routes>
        <Route path="/m/usuario/*" element={<MobileTenantInjector />} />
        <Route path="/m/lider/*" element={<MobileTenantInjector />} />
        <Route path="/m/:tenant/usuario/eventos" element={<div>lista</div>} />
        <Route path="/m/:tenant/usuario/eventos/:id" element={<div>detalhe</div>} />
        <Route path="/m/:tenant/lider/eventos-solicitados" element={<div>solicitados</div>} />
      </Routes>
    </MemoryRouter>
  )
}

const SESSION = { loading: false, isAuthenticated: true, tenantSlug: 'borba' }

afterEach(() => {
  cleanup()
  useCurrentUserMock.mockReset()
})

describe('MobileTenantInjector', () => {
  it('injeta o slug da sessão no path (usuário) e renderiza a rota canônica', () => {
    useCurrentUserMock.mockReturnValue(SESSION)
    renderAt('/m/usuario/eventos')
    expect(screen.getByTestId('loc').textContent).toBe('/m/borba/usuario/eventos')
    expect(screen.getByText('lista')).toBeInTheDocument()
  })

  it('preserva o :id e a query ao injetar o tenant', () => {
    useCurrentUserMock.mockReturnValue(SESSION)
    renderAt('/m/usuario/eventos/evt-1?ref=abc')
    expect(screen.getByTestId('loc').textContent).toBe('/m/borba/usuario/eventos/evt-1?ref=abc')
    expect(screen.getByText('detalhe')).toBeInTheDocument()
  })

  it('injeta o slug também no fluxo de líder', () => {
    useCurrentUserMock.mockReturnValue(SESSION)
    renderAt('/m/lider/eventos-solicitados')
    expect(screen.getByTestId('loc').textContent).toBe('/m/borba/lider/eventos-solicitados')
    expect(screen.getByText('solicitados')).toBeInTheDocument()
  })

  it('bloqueia (fail-closed) sem sessão', () => {
    useCurrentUserMock.mockReturnValue({ loading: false, isAuthenticated: false })
    renderAt('/m/usuario/eventos')
    expect(screen.getByText('Acesso inválido')).toBeInTheDocument()
  })

  it('bloqueia quando a sessão não tem tenant', () => {
    useCurrentUserMock.mockReturnValue({ loading: false, isAuthenticated: true, tenantSlug: null })
    renderAt('/m/usuario/eventos')
    expect(screen.getByText('Acesso inválido')).toBeInTheDocument()
  })
})
