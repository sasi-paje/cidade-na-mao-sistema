import { useCallback, useEffect, useState } from 'react'
import type { EquipmentRequestInput, EventEquipmentRequest } from '../types/event-equipment.types'
import { listEventEquipmentRequests, requestEventEquipment } from '../api/event-equipment.service'

/**
 * Lista as solicitações de equipamento de um evento e permite criar novas.
 */
export function useEventEquipment(idEvent: string | null | undefined) {
  const [data, setData] = useState<EventEquipmentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [mutating, setMutating] = useState(false)

  const refetch = useCallback(async () => {
    if (!idEvent) {
      setData([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await listEventEquipmentRequests(idEvent))
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Falha ao carregar equipamentos do evento'))
    } finally {
      setLoading(false)
    }
  }, [idEvent])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const requestEquipment = useCallback(async (items: EquipmentRequestInput[]) => {
    setMutating(true)
    setError(null)
    try {
      const created = await requestEventEquipment(items)
      await refetch()
      return created
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Falha ao solicitar equipamentos'))
      throw e
    } finally {
      setMutating(false)
    }
  }, [refetch])

  return { data, loading, error, mutating, refetch, requestEquipment }
}
