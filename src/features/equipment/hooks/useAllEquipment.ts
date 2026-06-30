import { useCallback, useEffect, useState } from 'react'
import type { Equipment } from '../types/equipment.types'
import { listAllEquipment } from '../api/equipment.service'

/** Lista admin de equipamentos (ativos e inativos), com refetch. */
export function useAllEquipment() {
  const [data, setData] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await listAllEquipment())
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
