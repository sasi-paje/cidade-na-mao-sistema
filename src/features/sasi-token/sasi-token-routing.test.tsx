import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { MobileLayout } from '../../app/layouts/MobileLayout'
import { ProtectedMobileRoute } from '../../app/routes/ProtectedMobileRoute'
import { SasiSessionBoundary } from './context/SasiSessionBoundary'
import * as sasiAuth from './api/sasi-auth.service'

// Troca SASI mockada: não tocar em rede/Supabase; resolve sem criar sessão.
vi.mock('./api/sasi-auth.service', () => ({
  exchangeSasiTokenForSupabaseSession: vi.fn(),
}))

// Sessão Supabase sempre anônima (a troca não cria sessão no teste).
vi.mock('../auth', () => ({
  useCurrentUser: () => ({ loading: false, isAuthenticated: false, role: null }),
}))

const exchange = vi.mocked(sasiAuth.exchangeSasiTokenForSupabaseSession)

/** Sonda sempre montada que reflete a URL atual (para checar a limpeza). */
function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname + loc.search}</div>
}

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <SasiSessionBoundary>
        <LocationProbe />
        <Routes>
          <Route element={<MobileLayout />}>
            {/* públicas */}
            <Route path="/m/eventos" element={<div>list-public</div>} />
            <Route path="/m/eventos/:id" element={<div>detail-public</div>} />
            {/* protegidas — exigem sessão Supabase */}
            <Route element={<ProtectedMobileRoute requireAuth />}>
              <Route path="/m/meus-eventos" element={<div>mine</div>} />
            </Route>
            <Route element={<ProtectedMobileRoute requireAuth allowedRoles={['community_leader']} />}>
              <Route path="/m/eventos-solicitados" element={<div>requested</div>} />
              <Route path="/m/solicitar-evento" element={<div>form</div>} />
            </Route>
          </Route>
        </Routes>
      </SasiSessionBoundary>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  window.sessionStorage.clear()
  // Conclui a troca sem criar sessão (caminho de erro controlado).
  exchange.mockResolvedValue({ success: false, error: 'sem master_user' })
})

afterEach(() => cleanup())

const ROUTES = [
  '/m/eventos',
  '/m/eventos/evt-1',
  '/m/meus-eventos',
  '/m/eventos-solicitados',
  '/m/solicitar-evento',
] as const

describe('captura do sasi-token em qualquer rota /m/*', () => {
  it.each(ROUTES)('captura o token e troca por sessão ao entrar em %s', async (path) => {
    renderAt(`${path}?sasi-token=TOK-123&ref=keep`)
    await waitFor(() => expect(exchange).toHaveBeenCalledWith('TOK-123'))
  })

  it.each(ROUTES)('remove apenas o sasi-token da URL, preservando outros params em %s', async (path) => {
    renderAt(`${path}?ref=keep&sasi-token=TOK-123`)
    await waitFor(() => {
      const loc = screen.getByTestId('loc').textContent ?? ''
      expect(loc).not.toContain('sasi-token')
      expect(loc).toContain('ref=keep')
    })
  })

  it('não chama a troca quando não há sasi-token na URL', async () => {
    renderAt('/m/eventos')
    await screen.findByText('list-public')
    expect(exchange).not.toHaveBeenCalled()
  })

  it('captura o param principal ?token= e troca por sessão', async () => {
    renderAt('/m/eventos?token=TOK-MAIN')
    await waitFor(() => expect(exchange).toHaveBeenCalledWith('TOK-MAIN'))
  })

  it('remove apenas o ?token= da URL, preservando outros params', async () => {
    renderAt('/m/eventos?token=TOK-MAIN&page=1')
    await waitFor(() => {
      const loc = screen.getByTestId('loc').textContent ?? ''
      expect(loc).not.toContain('token=')
      expect(loc).toContain('page=1')
    })
  })
})

describe('gate das rotas com sasi-token presente', () => {
  it('rota pública (/m/eventos) renderiza anônima mesmo com a troca SASI falhando', async () => {
    renderAt('/m/eventos?sasi-token=TOK-123')
    expect(await screen.findByText('list-public')).toBeInTheDocument()
  })

  it('rota pública de detalhe (/m/eventos/:id) renderiza anônima', async () => {
    renderAt('/m/eventos/evt-1?sasi-token=TOK-123')
    expect(await screen.findByText('detail-public')).toBeInTheDocument()
  })

  it('rota protegida (/m/solicitar-evento) exige sessão Supabase real (não basta sasi-token)', async () => {
    renderAt('/m/solicitar-evento?sasi-token=TOK-123')
    expect(await screen.findByText('Acesso pelo app SASI')).toBeInTheDocument()
    expect(screen.queryByText('form')).not.toBeInTheDocument()
  })

  it('rota protegida (/m/meus-eventos) exige sessão Supabase real', async () => {
    renderAt('/m/meus-eventos?sasi-token=TOK-123')
    expect(await screen.findByText('Acesso pelo app SASI')).toBeInTheDocument()
  })
})
