import { useState, useEffect } from 'react'
import { AppIcon } from './AppIcon'

// Cores
const PRIMARY = '#1e558b'
const TEXT_LIGHT25 = '#919191'
const ORANGE = '#e67c26'

// Delays em ms
const FAST_DELAY = 300
const MEDIUM_DELAY = 800
const SLOW_DELAY = 2000

interface LoadingFeedbackProps {
  isLoading: boolean
  messageFast?: string
  messageMedium?: string
  messageSlow?: string
  messageVerySlow?: string
}

export const LoadingFeedback = ({
  isLoading,
  messageFast = 'Carregando...',
  messageMedium = 'Carregando...',
  messageSlow = 'Carregando dados...',
  messageVerySlow = 'Isso pode levar alguns instantes...',
}: LoadingFeedbackProps) => {
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackLevel, setFeedbackLevel] = useState<'fast' | 'medium' | 'slow' | 'verySlow'>('fast')

  useEffect(() => {
    if (!isLoading) {
      setShowFeedback(false)
      return
    }

    // Inicia feedback rápido
    setShowFeedback(true)
    setFeedbackLevel('fast')

    const mediumTimer = setTimeout(() => {
      if (isLoading) setFeedbackLevel('medium')
    }, FAST_DELAY)

    const slowTimer = setTimeout(() => {
      if (isLoading) setFeedbackLevel('slow')
    }, MEDIUM_DELAY)

    const verySlowTimer = setTimeout(() => {
      if (isLoading) setFeedbackLevel('verySlow')
    }, SLOW_DELAY)

    return () => {
      clearTimeout(mediumTimer)
      clearTimeout(slowTimer)
      clearTimeout(verySlowTimer)
    }
  }, [isLoading])

  if (!isLoading && !showFeedback) return null

  // Fast feedback (< 300ms): botão desabilitado ou spinner pequeno
  if (feedbackLevel === 'fast') {
    return (
      <div className="flex items-center gap-2 opacity-50">
        <AppIcon name="schedule" size={18} color={PRIMARY} />
        <span className="text-[14px]" style={{ color: PRIMARY }}>
          {messageFast}
        </span>
      </div>
    )
  }

  // Medium feedback (300-800ms): spinner pequeno
  if (feedbackLevel === 'medium') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: PRIMARY, borderTopColor: 'transparent' }} />
        <span className="text-[14px]" style={{ color: TEXT_LIGHT25 }}>
          {messageMedium}
        </span>
      </div>
    )
  }

  // Slow feedback (800ms-2s): loading claro
  if (feedbackLevel === 'slow') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: ORANGE, borderTopColor: 'transparent' }} />
        <span className="text-[14px]" style={{ color: TEXT_LIGHT25 }}>
          {messageSlow}
        </span>
      </div>
    )
  }

  // Very slow feedback (>2s): loading + mensagem
  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: ORANGE, borderTopColor: 'transparent' }} />
      <span className="text-[14px]" style={{ color: TEXT_LIGHT25 }}>
        {messageVerySlow}
      </span>
    </div>
  )
}

// Componente simples para botão de loading
interface LoadingButtonProps {
  isLoading: boolean
  isSmall?: boolean
  children: React.ReactNode
}

export const LoadingButton = ({ isLoading, isSmall = false, children }: LoadingButtonProps) => {
  if (!isLoading) return <>{children}</>

  if (isSmall) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
        <span className="text-white text-[14px]">Carregando...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
      <span className="text-white text-[14px]">Processando...</span>
    </div>
  )
}