import React from 'react'

const BackArrow = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20 11H7.83L13.42 5.41L12 4L4 12L12 20L13.41 18.59L7.83 13H20V11Z" fill="#2a2a2a" />
  </svg>
)

const HomeArrow = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z" fill="#2a2a2a" />
  </svg>
)

interface MobileCardLayoutProps {
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  onBack?: () => void
  onHome?: () => void
  fullHeight?: boolean
}

export function MobileCardLayout({
  title,
  children,
  footer,
  onBack,
  onHome,
  fullHeight = false,
}: MobileCardLayoutProps) {
  return (
    <div
      className={`w-full ${fullHeight ? 'h-[calc(100dvh-32px)]' : 'min-h-[calc(100dvh-32px)]'} rounded-2xl bg-white shadow-md px-4 pt-4 flex flex-col`}
      style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
    >
      {(onBack || onHome) && (
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={onBack}
            className={`flex h-8 w-8 items-center justify-center${!onBack ? ' invisible' : ''}`}
            aria-label="Voltar"
          >
            <BackArrow />
          </button>
          <button
            type="button"
            onClick={onHome}
            className={`flex h-8 w-8 items-center justify-center${!onHome ? ' invisible' : ''}`}
            aria-label="Início"
          >
            <HomeArrow />
          </button>
        </div>
      )}
      <h1 className="text-[20px] font-bold text-[#001B44] mb-4">{title}</h1>
      <div className="border-b mb-4" />
      <div className="flex flex-col gap-4 flex-1 min-h-0">{children}</div>
      {footer && <div className="mt-auto pt-6">{footer}</div>}
    </div>
  )
}
