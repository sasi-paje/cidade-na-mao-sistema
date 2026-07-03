/**
 * WebTenantBoundary — porta de entrada das rotas `/web/*` no MODO WEB PÚBLICO
 * (`VITE_WEB_PUBLIC_MODE=true`).
 *
 * NÃO há login/sessão/AccessRequired aqui: o acesso é público por tenant. O
 * boundary apenas garante que a URL traz um `?tenant=` válido:
 *  - sem `?tenant=`            → "Tenant não informado na URL."
 *  - tenant inexistente/inativo → "Tenant inválido ou inativo."
 *  - válido                    → renderiza as rotas filhas (<Outlet/>).
 *
 * A validação usa a RPC pública `web_tenant_is_active` (anon). Fail-closed: se
 * a validação falhar, tratamos como tenant inválido (nunca abre login).
 */
import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase/client'
import { useWebTenant } from '../../features/web-tenant'

type CheckState = 'checking' | 'ok' | 'invalid'

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh w-full bg-[#f0f4f9] flex items-center justify-center p-6">
      {children}
    </div>
  )
}

function TenantError({ message }: { message: string }) {
  return (
    <FullScreen>
      <div className="max-w-[440px] text-center">
        <h1 className="text-[22px] font-bold text-[#0f3255]">Acesso indisponível</h1>
        <p className="mt-2 text-[15px] leading-[1.5] text-[#5b6675]">{message}</p>
      </div>
    </FullScreen>
  )
}

export function WebTenantBoundary() {
  const { tenant } = useWebTenant()
  // Ausência de tenant é derivada em render (sem effect). A validação assíncrona
  // do slug só roda quando há tenant.
  const [check, setCheck] = useState<CheckState>('checking')

  useEffect(() => {
    if (!tenant) return
    let cancelled = false
    supabase
      .rpc('web_tenant_is_active', { p_tenant_slug: tenant })
      .then(({ data, error }) => {
        if (cancelled) return
        // Fail-closed: erro ao validar (ex.: RPC ausente) → trata como inválido.
        setCheck(!error && data === true ? 'ok' : 'invalid')
      })
    return () => {
      cancelled = true
    }
  }, [tenant])

  if (!tenant) {
    return <TenantError message="Tenant não informado na URL. Abra esta tela pelo sistema principal." />
  }
  if (check === 'invalid') {
    return <TenantError message="Tenant inválido ou inativo." />
  }
  if (check === 'checking') {
    return (
      <FullScreen>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1e558b] border-t-transparent rounded-full animate-spin" />
          <span className="text-[14px] text-[#5b6675]">Carregando…</span>
        </div>
      </FullScreen>
    )
  }
  return <Outlet />
}
