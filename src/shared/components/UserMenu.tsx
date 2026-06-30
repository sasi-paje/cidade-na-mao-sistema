import React, { useState, useRef, useEffect } from 'react'
import { UserAvatar } from './UserAvatar'
import { AppIcon } from './AppIcon'

interface UserMenuProps {
  userName?: string
  userEmail?: string
  userRole?: string
  onLogout?: () => void
}

export const UserMenu: React.FC<UserMenuProps> = ({
  userName = 'Usuário',
  userEmail = '-',
  userRole = 'Usuário',
  onLogout,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [])

  const handleLogout = () => {
    setIsOpen(false)
    onLogout?.()
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-gray-100"
      >
        <UserAvatar name={userName} />
        <div className="flex flex-col leading-tight text-left">
          <span className="text-[12px] font-semibold text-[#4c4c4c]">{userName}</span>
          <span className="text-[10px] font-normal text-[#4c4c4c]">{userRole}</span>
        </div>
        <AppIcon
          name="keyboard_arrow_down"
          size={18}
          color="#9ca3af"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-[240px] rounded-xl border border-gray-100 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          {/* User info */}
          <div className="px-4 py-3">
            <p className="truncate text-sm font-semibold text-[#231f20]">{userName}</p>
            <p className="mt-0.5 truncate text-xs text-gray-500">{userEmail}</p>
          </div>

          {/* Divider */}
          <div className="border-t border-[#E5E7EB]" />

          {/* Logout action */}
          <div className="p-1">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
            >
              <AppIcon name="logout" size={18} color="#ef4444" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
