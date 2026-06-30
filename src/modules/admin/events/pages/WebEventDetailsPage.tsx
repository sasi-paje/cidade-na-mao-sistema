import { useNavigate, useParams } from 'react-router-dom'
import { ADMIN_ROUTES } from '../../../../app/routes/routePaths'
import { WebEventDetailsDrawer } from '../components/WebEventDetailsDrawer'

/**
 * `/web/eventos/:id` — rota direta (deep-link) do detalhe do evento.
 * Reusa o `WebEventDetailsDrawer`; fechar volta para a lista. Na navegação
 * normal a lista abre o drawer por estado (sem trocar de rota).
 */
export function WebEventDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  if (!id) return null
  return <WebEventDetailsDrawer eventId={id} onClose={() => navigate(ADMIN_ROUTES.events)} />
}
