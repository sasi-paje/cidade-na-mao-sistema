/**
 * NotFoundPage - Página 404 para rotas não reconhecidas
 *
 * Problema: SPA com historyApiFallback retorna index.html para todas as rotas
 * que não são arquivos estáticos. Isso significa que rotas inválidas não
 * recebem código 404 real do servidor - o React precisa detectar rotas
 * desconhecidas e renderizar esta página.
 *
 * Risco em produção: Usuário pode acessar rota inexistente e ver tela branca
 * ou comportamento inesperado se não houver tratamento.
 */

import React from 'react'

interface NotFoundPageProps {
  requestedPath?: string
  onNavigateHome?: () => void
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  requestedPath = window.location.pathname,
  onNavigateHome,
}) => {
  const handleGoHome = () => {
    if (onNavigateHome) {
      onNavigateHome()
    } else {
      window.location.href = '/'
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#ECEDFB] p-4">
      <div className="bg-white rounded-[8px] p-8 max-w-[400px] w-full shadow-[4px_4px_4px_0px_rgba(0,0,0,0.25)]">
        <div className="text-center mb-6">
          <h1 className="text-[#231f20] text-[48px] font-bold mb-2">404</h1>
          <h2 className="text-[#231f20] text-[18px] font-semibold mb-2">Página não encontrada</h2>
          <p className="text-[#4c4c4c] text-[14px]">
            A rota <code className="bg-gray-100 px-1 rounded">{requestedPath}</code> não existe ou foi removida.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleGoHome}
            className="w-full h-[45px] bg-[#e67c26] text-white font-bold rounded-[4px] hover:bg-[#d66d1f] transition-colors"
          >
            Voltar ao Início
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="w-full h-[45px] bg-white text-[#4c4c4c] font-medium rounded-[4px] border border-[#ddd] hover:bg-gray-50 transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage