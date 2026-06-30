import { useEffect } from 'react'

/**
 * Trava o scroll do `document.body` enquanto `locked` for true (ex.: modal/drawer
 * aberto), restaurando o valor anterior ao fechar/desmontar. No-op quando false.
 *
 * Pode ser chamado incondicionalmente (respeita as regras de hooks): a lógica
 * interna só age quando `locked` é true.
 */
export function useLockBodyScroll(locked: boolean): void {
  useEffect(() => {
    if (!locked) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [locked])
}
