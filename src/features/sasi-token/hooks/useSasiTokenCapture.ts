import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { storeSasiToken, getSasiTokenParamFromUrl } from '../api/sasi-token.service'

/**
 * Captura o token SASI presente na URL de QUALQUER rota (`/m/*` ou `/web/*`),
 * testando os aliases em ordem de prioridade (`token` → `sasi-token` →
 * `sasiToken` → `sasi-refresh-token` → `sasiRefreshToken`), persiste em
 * sessionStorage (com o tipo access/refresh) e remove **apenas** o param do
 * token da barra de endereço (replace no histórico), preservando os demais
 * query params e evitando que o token vaze em compartilhamentos.
 *
 * Usado dentro do `SasiAuthProvider` (montado no `SasiSessionBoundary` global),
 * portanto observa todas as rotas.
 */
export function useSasiTokenCapture(): void {
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const found = getSasiTokenParamFromUrl(searchParams.toString())
    if (!found) return

    storeSasiToken(found.value, found.kind)

    // Remove só o param do token; mantém os outros params intactos.
    const next = new URLSearchParams(searchParams)
    next.delete(found.param)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])
}
