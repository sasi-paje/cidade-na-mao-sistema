/**
 * Mapa central de rotas do Cidade na Mão.
 *
 * Fonte única da verdade para os paths, usada pelos scaffolds de roteamento
 * (AppRoutes/PublicRoutes/AdminRoutes) quando o react-router-dom for instalado
 * (Etapa 4). Não depende de nenhuma lib — pode ser importado com segurança.
 *
 * Convenção:
 *  - /m/*   → área pública/mobile (público geral + líder da comunidade)
 *  - /web/* → área admin/web (gestão interna)
 */

/** Rotas da área pública/mobile (`/m/*`) */
export const PUBLIC_ROUTES = {
  /** Landing / redirecionamento inicial */
  home: '/',
  /** Lista de eventos aprovados (público geral) */
  events: '/m/eventos',
  /** Detalhe de um evento */
  eventDetails: '/m/eventos/:id',
  /** Participações do usuário */
  myEvents: '/m/meus-eventos',
} as const

/** Rotas do líder da comunidade (`/m/*`, protegidas por perfil líder) */
export const LEADER_ROUTES = {
  /** Solicitações de evento do próprio líder */
  requestedEvents: '/m/eventos-solicitados',
  /** Detalhe de uma solicitação */
  requestedEventDetails: '/m/eventos-solicitados/:id',
  /** Formulário de solicitação de evento */
  requestEvent: '/m/solicitar-evento',
} as const

/** Rotas da área admin/web (`/web/*`, protegidas por perfil admin) */
export const ADMIN_ROUTES = {
  /** Fila/gestão de eventos */
  events: '/web/eventos',
  /** Detalhe administrativo do evento */
  eventDetails: '/web/eventos/:id',
  /** Gestão de equipamentos */
  equipment: '/web/equipamentos',
  // Futuro:
  // users: '/web/usuarios',
  // dashboard: '/web/dashboard',
} as const

/** Helper: substitui `:id` (e similares) por um valor concreto. */
export function buildPath(pattern: string, params: Record<string, string | number>): string {
  return Object.entries(params).reduce<string>(
    (path, [key, value]) => path.replace(`:${key}`, String(value)),
    pattern,
  )
}
