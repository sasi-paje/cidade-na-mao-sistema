import { useCallback, useEffect, useState } from 'react'
import type { Equipment } from '../types/equipment.types'
import { listEquipment } from '../api/equipment.service'

/** Catálogo de equipamentos ativos. `tenantSlug` é usado no modo web público
 *  (`VITE_WEB_PUBLIC_MODE`) para escopar por tenant. */
export function useEquipment(tenantSlug?: string | null) {
  const [data, setData] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await listEquipment(tenantSlug))
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Falha ao carregar equipamentos'))
    } finally {
      setLoading(false)
    }
  }, [tenantSlug])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
