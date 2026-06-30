import { useCallback, useEffect, useState } from 'react'
import type { Equipment } from '../types/equipment.types'
import { listEquipment } from '../api/equipment.service'

/** Catálogo de equipamentos ativos. */
export function useEquipment() {
  const [data, setData] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await listEquipment())
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Falha ao carregar equipamentos'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
