/**
 * Cidade na Mão Bootstrap
 *
 * Roteamento real via react-router-dom (BrowserRouter + AppRoutes):
 * - `/`        → redireciona para /m/eventos
 * - `/m/*`     → área pública/mobile
 * - `/web/*`   → área admin/web
 * - `/login`, `/reset-password` → auth Supabase legada
 */

import React, { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'

import { AppErrorBoundary } from './shared/components/AppErrorBoundary'
import { AppRoutes } from './app/routes/AppRoutes'
import { AuthProvider } from './features/auth'
import { SasiSessionBoundary } from './features/sasi-token'

const InitialLoading = () => (
  <div className="flex items-center justify-center min-h-screen bg-[#ECEDFB]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-[#e67c26] border-t-transparent rounded-full animate-spin" />
      <span className="text-[#231f20] text-[16px] font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
        Carregando Cidade na Mão...
      </span>
    </div>
  </div>
)

const Root: React.FC = () => (
  <AppErrorBoundary>
    <Suspense fallback={<InitialLoading />}>
      <BrowserRouter>
        <AuthProvider>
          {/* Boundary global SASI: captura ?token= (e aliases) em /m/* e /web/*,
              troca por sessão Supabase e limpa a URL. Autorização segue por
              sessão Supabase + RLS/RPCs (este boundary não autoriza nada). */}
          <SasiSessionBoundary>
            <AppRoutes />
          </SasiSessionBoundary>
        </AuthProvider>
      </BrowserRouter>
    </Suspense>
  </AppErrorBoundary>
)

const bootstrap = () => {
  const container = document.getElementById('root')
  if (!container) return

  const root = createRoot(container)
  root.render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  )
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap)
} else {
  bootstrap()
}
