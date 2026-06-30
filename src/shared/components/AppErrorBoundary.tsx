/**
 * Error Boundary - Captura erros de React que crasham o app
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#ECEDFB] p-4">
          <div className="bg-white rounded-[8px] p-6 max-w-[400px] w-full shadow-lg">
            <h1 className="text-[#d32f2f] text-[20px] font-bold mb-4">Erro Inesperado</h1>
            <p className="text-[#4c4c4c] text-[14px] mb-4">
              Ocorreu um erro ao carregar a aplicação. Por favor, recarregue a página.
            </p>
            <pre className="bg-red-50 p-3 rounded text-[12px] text-red-800 overflow-auto max-h-[200px]">
              {this.state.error?.message}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 w-full h-[45px] bg-[#e67c26] text-white font-bold rounded-[4px]"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}