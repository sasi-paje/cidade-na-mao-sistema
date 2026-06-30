import React from 'react'

interface MobilePageShellProps {
  children: React.ReactNode
}

export function MobilePageShell({ children }: MobilePageShellProps) {
  return (
    <div className="min-h-dvh w-full bg-[#EAF7F7] flex justify-center">
      <div className="w-full px-3 py-4">
        {children}
      </div>
    </div>
  )
}
