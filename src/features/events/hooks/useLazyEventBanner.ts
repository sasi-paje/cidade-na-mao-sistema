import { useEffect, useRef, useState } from 'react'
import { getPublicEventBanner } from '../api/events.service'

/**
 * Cache de banners já carregados (por id de evento). Banners são base64 pesados;
 * este cache evita refetch entre re-renders, rolagem e navegação entre telas.
 */
const bannerCache = new Map<string, string | null>()

/**
 * Carrega o banner do evento SOB DEMANDA — só quando o card entra na viewport
 * (IntersectionObserver). Mantém o feed leve: a lista não traz `banner_url`
 * (base64 pesado, até ~10MB); cada card busca o seu ao aparecer. Quando o banner
 * já veio no objeto (ex.: tela de detalhe), passe-o em `fallback` e nada é buscado.
 *
 * Retorna um `ref` para anexar ao elemento observado e o `banner` (ou null).
 */
export function useLazyEventBanner<T extends HTMLElement = HTMLElement>(
  eventId: string,
  fallback?: string | null,
) {
  const ref = useRef<T | null>(null)
  const [banner, setBanner] = useState<string | null>(
    () => fallback ?? (eventId ? bannerCache.get(eventId) ?? null : null),
  )

  useEffect(() => {
    if (fallback) return // já tem imagem: não busca
    if (!eventId) return
    if (bannerCache.has(eventId)) {
      setBanner(bannerCache.get(eventId) ?? null)
      return
    }

    let cancelled = false
    const load = async () => {
      const url = await getPublicEventBanner(eventId)
      if (cancelled) return
      bannerCache.set(eventId, url)
      setBanner(url)
    }

    const el = ref.current
    // Sem observer (teste/SSR) ou sem elemento → carrega direto.
    if (!el || typeof IntersectionObserver === 'undefined') {
      void load()
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect()
          void load()
        }
      },
      { rootMargin: '200px' }, // pré-carrega um pouco antes de entrar na tela
    )
    observer.observe(el)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [eventId, fallback])

  return { ref, banner }
}
