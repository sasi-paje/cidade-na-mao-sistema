import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { SasiSessionBoundary } from './context/SasiSessionBoundary'
import { ProtectedRoute } from '../../app/routes/ProtectedRoute'
import { AccessRequired } from '../../app/routes/AccessRequired'
import { AdminWebLayout } from '../../app/layouts/AdminWebLayout'
import * as sasiAuth from './api/sasi-auth.service'
import { useCurrentUser } from '../auth'

vi.mock('./api/sasi-auth.service', () => ({
  exchangeSasiTokenForSupabaseSession: vi.fn(),
}))

vi.mock('../auth', () => ({
  useCurrentUser: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
}))

const exchange = vi.mocked(sasiAuth.exchangeSasiTokenForSupabaseSession)
const mockUser = vi.mocked(useCurrentUser)

const ANON = { loading: false, isAuthenticated: false, isAdmin: false, role: null, name: null, email: null }
const ADMIN = { loading: false, isAuthenticated: true, isAdmin: true, role: 'admin', name: 'Maria', email: 'm@x.com' }
const NON_ADMIN = { loading: false, isAuthenticated: true, isAdmin: false, role: 'community_leader', name: 'Léo', email: 'l@x.com' }

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
          <Route element={<ProtectedRoute requireAdmin />}>
            <Route element={<AdminWebLayout />}>
              <Route path="/web/eventos" element={<div>web-eventos</div>} />
              <Route path="/web/equipamentos" element={<div>web-equip</div>} />
            </Route>
          </Route>
          {/* Marcador: se o guard navegar para /login, este texto apareceria. */}
          <Route path="/login" element={<div>login-bellog</div>} />
        </Routes>
      </SasiSessionBoundary>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  window.sessionStorage.clear()
  exchange.mockResolvedValue({ success: false, error: 'sem sessão' })
  mockUser.mockReturnValue(ANON as never)
})

afterEach(() => cleanup())

describe('captura do sasi-token nas rotas /web/*', () => {
  it('captura o token e dispara a troca ao entrar em /web/eventos', async () => {
    renderAt('/web/eventos?sasi-token=TOK-123')
    await waitFor(() => expect(exchange).toHaveBeenCalledWith('TOK-123'))
  })

  it('captura também em /web/equipamentos', async () => {
    renderAt('/web/equipamentos?sasi-token=TOK-123')
    await waitFor(() => expect(exchange).toHaveBeenCalledWith('TOK-123'))
  })

  it('remove apenas o sasi-token da URL, preservando outros params (admin logado)', async () => {
    mockUser.mockReturnValue(ADMIN as never)
    renderAt('/web/eventos?ref=keep&sasi-token=TOK-123')
    expect(await screen.findByText('web-eventos')).toBeInTheDocument()
    await waitFor(() => {
      const loc = screen.getByTestId('loc').textContent ?? ''
      expect(loc).not.toContain('sasi-token')
      expect(loc).toContain('ref=keep')
    })
  })

  it('não chama a troca quando não há sasi-token', async () => {
    mockUser.mockReturnValue(ADMIN as never)
    renderAt('/web/eventos')
    expect(await screen.findByText('web-eventos')).toBeInTheDocument()
    expect(exchange).not.toHaveBeenCalled()
  })

  it('captura o param principal ?token= também no web', async () => {
    renderAt('/web/eventos?token=TOK-MAIN')
    await waitFor(() => expect(exchange).toHaveBeenCalledWith('TOK-MAIN'))
  })
})

describe('gate /web/* — sem login Bellog (SASI é só login; autz por sessão Supabase)', () => {
  // (a) não cai em /login
  it('sem sessão, mostra tela neutra (não cai no login Bellog)', async () => {
    renderAt('/web/eventos?sasi-token=TOK-123')
    expect(await screen.findByText('Acesso não autorizado')).toBeInTheDocument()
    expect(screen.queryByText('login-bellog')).not.toBeInTheDocument()
    expect(screen.getByTestId('loc').textContent).toContain('/web/eventos')
  })

  // (b) durante a troca SASI mostra carregamento
  it('mostra "Validando acesso…" enquanto a troca SASI está pendente', async () => {
    exchange.mockReturnValue(new Promise(() => {})) // nunca resolve
    renderAt('/web/eventos?sasi-token=TOK-123')
    expect(await screen.findByText('Validando acesso…')).toBeInTheDocument()
    expect(screen.queryByText('web-eventos')).not.toBeInTheDocument()
  })

  // (c) sem sessão e sem token → tela neutra
  it('sem token e sem sessão → tela neutra de acesso', async () => {
    renderAt('/web/eventos')
    expect(await screen.findByText('Acesso não autorizado')).toBeInTheDocument()
  })

  // (d) com sessão admin → libera a área web
  it('admin autenticado → renderiza a área web', async () => {
    mockUser.mockReturnValue(ADMIN as never)
    renderAt('/web/eventos?sasi-token=TOK-123')
    expect(await screen.findByText('web-eventos')).toBeInTheDocument()
  })

  it('autenticado sem admin → acesso restrito', async () => {
    mockUser.mockReturnValue(NON_ADMIN as never)
    renderAt('/web/eventos?sasi-token=TOK-123')
    expect(await screen.findByText('Acesso restrito')).toBeInTheDocument()
  })
})

// (e) a tela usada em /login não exibe formulário/marca Bellog
describe('tela de acesso (/login) é neutra', () => {
  it('AccessRequired não tem formulário de e-mail/senha nem marca Bellog', () => {
    const { container } = render(
      <MemoryRouter>
        <AccessRequired />
      </MemoryRouter>
    )
    expect(screen.getByText('Acesso não autorizado')).toBeInTheDocument()
    expect(container.querySelector('input[type="email"]')).toBeNull()
    expect(container.querySelector('input[type="password"]')).toBeNull()
    expect(container.querySelector('input')).toBeNull()
    expect(container.textContent ?? '').not.toMatch(/bellog/i)
  })
})
