import { useCallback, useEffect, useState } from 'react'
import type { EventApproval } from '../types/event-approval.types'
import { getLatestApproval } from '../api/event-approvals.service'

/** Última decisão (motivo/contraproposta) registrada para um slot. */
export function useLatestApproval(idEvent: string | null | undefined, idSlot: string | null | undefined) {
  const [data, setData] = useState<EventApproval | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    if (!idEvent || !idSlot) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await getLatestApproval(idEvent, idSlot))
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Falha ao carregar decisão'))
    } finally {
      setLoading(false)
    }
  }, [idEvent, idSlot])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
