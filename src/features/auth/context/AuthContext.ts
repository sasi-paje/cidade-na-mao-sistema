/**
 * Contexto React da autenticação. Separado do provider para manter o
 * AuthProvider.tsx exportando apenas o componente (lint react-refresh).
 */
import { createContext } from 'react'
import type { AuthContextValue } from '../types/auth.types'

export const AuthContext = createContext<AuthContextValue | null>(null)
