import type { ReactNode } from 'react'
import { SasiAuthProvider } from './SasiAuthProvider'

/**
 * Boundary global de login SASI — envolve TODA a árvore de rotas (`/m/*` e
 * `/web/*`) em um único ponto (montado em `main.tsx`, dentro do `BrowserRouter`
 * e do `AuthProvider`).
 *
 * Ao detectar um token SASI na URL (`?token=...` e aliases), troca-o por uma
 * sessão real do Supabase Auth e limpa a URL. A partir daí, web e mobile
 * dependem da sessão Supabase (`auth.uid()` → RLS/RPCs); este boundary é apenas
 * o mecanismo de login, não autoriza nada.
 *
 * Substitui o mount duplicado anterior (um no `MobileLayout`, outro no
 * `SasiSessionBoundary` de rota), evitando provider duplicado.
 */
export function SasiSessionBoundary({ children }: { children: ReactNode }) {
  return <SasiAuthProvider>{children}</SasiAuthProvider>
}
