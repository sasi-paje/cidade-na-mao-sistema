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

/**
 * Rotas mobile do FLUXO DE USUÁRIO COMUM (`/m/usuario/*`).
 * O fluxo é definido pelo LINK acessado, não por cargo/role. Exige apenas
 * token/sessão válidos (ver `MobileTokenRoute`).
 */
export const USER_MOBILE_ROUTES = {
  /** Lista de todos os eventos */
  events: '/m/usuario/eventos',
  /** Detalhe de um evento */
  eventDetails: '/m/usuario/eventos/:id',
  /** Participações do usuário */
  myEvents: '/m/usuario/meus-eventos',
} as const

/**
 * Rotas mobile do FLUXO DE LÍDER DE COMUNIDADE (`/m/lider/*`).
 * O fluxo é definido pelo LINK acessado, não por cargo/role. Exige apenas
 * token/sessão válidos (ver `MobileTokenRoute`).
 */
export const LEADER_MOBILE_ROUTES = {
  /** Solicitações de evento do líder */
  requestedEvents: '/m/lider/eventos-solicitados',
  /** Detalhe de uma solicitação */
  requestedEventDetails: '/m/lider/eventos-solicitados/:id',
  /** Formulário de solicitação de evento */
  requestEvent: '/m/lider/solicitar-evento',
  /** Todos os eventos (visão do líder) */
  events: '/m/lider/eventos',
} as const

/**
 * Rotas LEGADAS (`/m/*` sem prefixo de fluxo) — mantidas apenas como origem
 * dos redirects de compatibilidade (→ `/m/usuario/*` ou `/m/lider/*`),
 * preservando o `?token=`. Não usar em código novo.
 */
export const PUBLIC_ROUTES = {
  /** Landing / redirecionamento inicial */
  home: '/',
  /** (legado) Lista de eventos aprovados */
  events: '/m/eventos',
  /** (legado) Detalhe de um evento */
  eventDetails: '/m/eventos/:id',
  /** (legado) Participações do usuário */
  myEvents: '/m/meus-eventos',
} as const

/** Rotas LEGADAS do líder (`/m/*` sem prefixo) — só para redirects. */
export const LEADER_ROUTES = {
  /** (legado) Solicitações de evento do próprio líder */
  requestedEvents: '/m/eventos-solicitados',
  /** (legado) Detalhe de uma solicitação */
  requestedEventDetails: '/m/eventos-solicitados/:id',
  /** (legado) Formulário de solicitação de evento */
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
