// Tipos
export type { CurrentUserContext, AuthContextValue, UserRole } from './types/auth.types'

// Service
export {
  authService,
  getSession,
  signInWithEmailPassword,
  signOut,
  getCurrentUserContext,
} from './api/auth.service'

// Contexto / hook
export { AuthProvider } from './context/AuthProvider'
export { useCurrentUser } from './hooks/useCurrentUser'
