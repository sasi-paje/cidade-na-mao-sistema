import { useLocation, useNavigate } from 'react-router-dom'
import { USER_MOBILE_ROUTES, LEADER_MOBILE_ROUTES } from '../../../app/routes/routePaths'
import { useMobileToken } from '../../../features/sasi-token'

interface TabDef {
  label: string
  path: string
}

/** Abas do fluxo de USUÁRIO COMUM (`/m/usuario/*`). */
const USER_TABS: TabDef[] = [
  { label: 'Todos os eventos', path: USER_MOBILE_ROUTES.events },
  { label: 'Meus Eventos', path: USER_MOBILE_ROUTES.myEvents },
]

/** Abas do fluxo de LÍDER (`/m/lider/*`). */
const LEADER_TABS: TabDef[] = [
  { label: 'Eventos Solicitados', path: LEADER_MOBILE_ROUTES.requestedEvents },
  { label: 'Todos os eventos', path: LEADER_MOBILE_ROUTES.events },
  { label: 'Solicitar Evento', path: LEADER_MOBILE_ROUTES.requestEvent },
]

/**
 * Navegação por abas das telas mobile. O conjunto de abas é definido pelo
 * FLUXO da URL (`/m/lider/*` → líder; caso contrário → usuário comum) — NUNCA
 * por cargo/role. O `?token=` é preservado na navegação.
 */
export function EventsTabs() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { withMobileToken } = useMobileToken()

  const isLeaderFlow = pathname.startsWith('/m/lider')
  const tabs = isLeaderFlow ? LEADER_TABS : USER_TABS

  return (
    <nav className="flex flex-row">
      {tabs.map((tab) => {
        const isActive = pathname === tab.path
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => navigate(withMobileToken(tab.path))}
            className="flex-1 px-0.5 pb-[11px] pt-[10px] text-center text-[13px] font-bold transition-colors"
            style={{
              color: isActive ? '#1E558B' : '#93A0BF',
              borderBottom: `2.5px solid ${isActive ? '#1E558B' : 'transparent'}`,
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
