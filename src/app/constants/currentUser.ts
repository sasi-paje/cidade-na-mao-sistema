/**
 * Usuário mockado temporário — FALLBACK DEV/TEST.
 *
 * ⚠️ @deprecated para fluxos autenticados — a fonte oficial do usuário é
 * `useCurrentUser()` (src/features/auth). As rotas de líder (`/m/eventos-solicitados`,
 * `/m/solicitar-evento`, `/m/eventos-solicitados/:id`) e `/m/meus-eventos` já usam
 * `useCurrentUser().masterUserId/tenantId`. Estas constantes restam apenas como
 * fallback dev/seed (ex.: `event.mock.ts`) e em pontos ainda não migrados
 * (presença pública, revisor admin no mock). Remover quando os mocks forem desativados.
 */
export const MOCK_PUBLIC_USER_ID = 'user-public-mock-001'

/** Líder mockado — alinhado ao `id_user` do seed para enxergar as solicitações. */
export const MOCK_LEADER_USER_ID = 'user-leader-mock-001'

/** Tenant (cidade) mockado — alinhado ao seed. */
export const MOCK_TENANT_ID = 'tenant-itabira'

/** Admin/revisor mockado — alinhado ao revisor do seed de aprovações. */
export const MOCK_ADMIN_USER_ID = 'user-admin-1'
