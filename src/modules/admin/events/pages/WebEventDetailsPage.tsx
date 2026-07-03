import { useNavigate, useParams } from 'react-router-dom'
import { ADMIN_ROUTES } from '../../../../app/routes/routePaths'
import { useWebTenant } from '../../../../features/web-tenant'
import { WebEventDetailsDrawer } from '../components/WebEventDetailsDrawer'

/**
 * `/web/eventos/:id` — rota direta (deep-link) do detalhe do evento.
 * Reusa o `WebEventDetailsDrawer`; fechar volta para a lista (preservando o
 * `?tenant=` no modo web público). Na navegação normal a lista abre o drawer
 * por estado (sem trocar de rota).
 */
export function WebEventDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { withTenant } = useWebTenant()
  if (!id) return null
  return <WebEventDetailsDrawer eventId={id} onClose={() => navigate(withTenant(ADMIN_ROUTES.events))} />
}
