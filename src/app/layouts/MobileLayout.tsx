import { Outlet } from 'react-router-dom'

/**
 * Layout da área pública/mobile (`/m/*`) — público geral e líder.
 *
 * Segue o guia visual "SASI Eventos Mobile": fundo claro neutro, tipografia
 * Inter e conteúdo centralizado em uma coluna estreita (app-like) que se
 * mantém legível tanto no celular quanto no desktop.
 *
 * A captura/troca do token SASI é feita pelo `SasiSessionBoundary` global
 * (em `main.tsx`), que envolve `/m/*` e `/web/*` — não há mais provider aqui.
 */
export function MobileLayout() {
  return (
    <div
      className="min-h-dvh w-full bg-[#f9f9f9] text-[#2a2a2a]"
      style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}
    >
      <div className="mx-auto flex w-full max-w-[460px] flex-col gap-3 px-3 pb-8 pt-3">
        <Outlet />
      </div>
    </div>
  )
}
