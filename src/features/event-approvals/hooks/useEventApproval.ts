import { useCallback, useState } from 'react'
import type { CounterProposalInput } from '../types/event-approval.types'
import { approveEvent, proposeCounterDate, rejectEvent } from '../api/event-approvals.service'

/**
 * Ações de decisão do admin sobre um evento (mutações). `tenantSlug` é usado no
 * modo web público (`VITE_WEB_PUBLIC_MODE`) para escopar por tenant.
 */
export function useEventApproval(tenantSlug?: string | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const run = useCallback(async (fn: () => Promise<void>, fallbackMsg: string) => {
    setLoading(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      const err = e instanceof Error ? e : new Error(fallbackMsg)
      setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const approve = useCallback(
    (idEvent: string, idSlot: string) =>
      run(() => approveEvent(idEvent, idSlot, tenantSlug), 'Falha ao aprovar evento'),
    [run, tenantSlug],
  )

  const proposeCounter = useCallback(
    (input: CounterProposalInput) => run(() => proposeCounterDate(input, tenantSlug), 'Falha ao propor nova data'),
    [run, tenantSlug],
  )

  const reject = useCallback(
    (idEvent: string, idSlot: string, reason: string) =>
      run(() => rejectEvent(idEvent, idSlot, reason), 'Falha ao reprovar evento'),
    [run],
  )

  return { approve, proposeCounter, reject, loading, error }
}
