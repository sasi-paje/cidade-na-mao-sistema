/**
 * Loading Gate - Componente de carregamento inicial
 */

import React from 'react'

interface LoadingGateProps {
  isLoading: boolean
  children: React.ReactNode
  fallback?: React.ReactNode
}

export const LoadingGate: React.FC<LoadingGateProps> = ({
  isLoading,
  children,
  fallback,
}) => {
  if (isLoading) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#e67c26] border-t-transparent rounded-full animate-spin" />
          <span className="text-[14px] text-[#2a2a2a] font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
            Carregando...
          </span>
        </div>
      </div>
    )
  }

  return <>{children}</>
}