import { useLocation, useNavigate } from 'react-router-dom'
import { PUBLIC_ROUTES, LEADER_ROUTES } from '../../../app/routes/routePaths'
import { useCurrentUser } from '../../../features/auth'

interface TabDef {
  label: string
  path: string
  /** Visível apenas para líderes comunitários. */
  leaderOnly?: boolean
}

const TABS: TabDef[] = [
  { label: 'Todos os eventos', path: PUBLIC_ROUTES.events },
  { label: 'Meus Eventos', path: PUBLIC_ROUTES.myEvents },
  { label: 'Eventos Solicitados', path: LEADER_ROUTES.requestedEvents, leaderOnly: true },
]

/**
 * Navegação por abas das telas públicas/mobile.
 * Abas no estilo do guia: rótulo em negrito, ativa em #1E558B com sublinhado,
 * inativa em #93A0BF. A aba do líder só aparece para `community_leader`.
 */
export function EventsTabs() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isLeader } = useCurrentUser()

  const tabs = TABS.filter((tab) => !tab.leaderOnly || isLeader)

  return (
    <nav className="flex flex-row">
      {tabs.map((tab) => {
        const isActive = pathname === tab.path
        return (
          <button
            key={tab.path}
            type="button"
            onClick={() => navigate(tab.path)}
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
