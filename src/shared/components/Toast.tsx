import { useState, useEffect } from 'react'
import { AppIcon } from './AppIcon'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  onClose?: () => void
  inline?: boolean
}

const TOAST_COLORS: Record<ToastType, string> = {
  success: '#27ae60',
  error: '#eb5757',
  info: '#4077d9',
  warning: '#f2994a',
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
  warning: 'warning',
}

export const Toast = ({ message, type = 'success', duration = 3000, onClose, inline = false }: ToastProps) => {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onClose?.()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!isVisible) return null

  return (
    <div
      className={`${inline ? 'pointer-events-auto' : 'fixed top-4 right-6 z-[9999]'} flex items-center gap-3 px-4 py-3 rounded-[6px] shadow-lg`}
      style={{
        backgroundColor: 'white',
        borderLeft: `4px solid ${TOAST_COLORS[type]}`,
        minWidth: '280px',
        maxWidth: '400px',
      }}
    >
      <AppIcon name={TOAST_ICONS[type] as any} size={24} color={TOAST_COLORS[type]} />
      <span
        className="flex-1 text-[14px]"
        style={{ fontFamily: 'Inter, sans-serif', color: '#2a2a2a' }}
      >
        {message}
      </span>
      <button
        type="button"
        onClick={() => {
          setIsVisible(false)
          onClose?.()
        }}
        className="p-1 rounded hover:bg-gray-100"
      >
        <AppIcon name="close" size={20} color="#919191" />
      </button>
    </div>
  )
}

// Hook para gerenciar toasts globais
export const useToast = () => {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: ToastType }>>([])

  const showToast = (message: string, type: ToastType = 'success') => {
    setToasts(prev => {
      if (prev.some(t => t.message === message && t.type === type)) return prev
      return [...prev, { id: Date.now(), message, type }]
    })
  }

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const showSuccess = (message: string) => showToast(message, 'success')
  const showError = (message: string) => showToast(message, 'error')
  const showInfo = (message: string) => showToast(message, 'info')
  const showWarning = (message: string) => showToast(message, 'warning')

  return {
    toasts,
    showToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    removeToast,
  }
}

// Componente para renderizar múltiplos toasts
export const ToastContainer = ({
  toasts,
  onRemove
}: {
  toasts: Array<{ id: number; message: string; type: ToastType }>
  onRemove: (id: number) => void
}) => {
  return (
    <div className="fixed top-4 right-6 z-[9999] flex flex-col gap-2 pointer-events-none max-w-[420px]">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => onRemove(toast.id)}
          inline
        />
      ))}
    </div>
  )
}