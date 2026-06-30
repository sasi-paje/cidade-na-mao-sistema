import { useNavigate } from 'react-router-dom'
import { useEquipment } from '../../../../features/equipment'
import { useEventRequestFlow } from '../../../../features/events'
import type { EventRequestFlowInput } from '../../../../features/events'
import { useCurrentUser } from '../../../../features/auth'
import { buildPath, LEADER_ROUTES } from '../../../../app/routes/routePaths'
import { RequestEventForm } from '../components/RequestEventForm'

/** `/m/solicitar-evento` — solicitação de evento em página única (líder real). */
export function RequestEventPage() {
  const navigate = useNavigate()
  const { masterUserId, tenantId } = useCurrentUser()
  const { data: equipment } = useEquipment()
  const { submit, loading, error } = useEventRequestFlow()

  const handleSubmit = async (input: EventRequestFlowInput) => {
    try {
      const result = await submit(input)
      navigate(buildPath(LEADER_ROUTES.requestedEventDetails, { id: result.event.id }))
    } catch {
      // erro exibido pelo formulário via prop `error`
    }
  }

  return (
    <RequestEventForm
      equipment={equipment}
      submitting={loading}
      error={error}
      leaderUserId={masterUserId}
      tenantId={tenantId}
      onSubmit={handleSubmit}
      onCancel={() => navigate(LEADER_ROUTES.requestedEvents)}
    />
  )
}
