import React from 'react'
import { AppIcon } from './AppIcon'
import { UserMenu } from './UserMenu'

export interface PageHeaderProps {
  title: string
  breadcrumb?: string
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  userName?: string
  userEmail?: string
  userRole?: string
  onLogout?: () => void
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  breadcrumb,
  isSidebarOpen,
  onToggleSidebar,
  userName = 'Leon Kennedy',
  userEmail,
  userRole = 'Usuário',
  onLogout,
}) => {
  const ariaLabel = isSidebarOpen ? 'Recolher sidebar' : 'Expandir sidebar'

  return (
    <div className="flex w-full min-h-[78px] items-center justify-between px-6 py-3 bg-[#ffffff]">
      {/* Left: Toggle + Title/Breadcrumb */}
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={ariaLabel}
          title={ariaLabel}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors hover:bg-gray-100"
        >
          <AppIcon
            name="left_panel_close"
            size={24}
            className={`transition-transform duration-200 ${
              isSidebarOpen ? '' : 'rotate-180'
            }`}
          />
        </button>

        <div className="min-w-0">
          <p className="truncate text-[24px] font-bold text-[#0f3255]">
            {breadcrumb ? (
              <>
                <span className="font-normal">{breadcrumb} &gt; </span>
                <span>{title}</span>
              </>
            ) : (
              <span>{title}</span>
            )}
          </p>
        </div>
      </div>

      {/* Central area - flexible */}
      <div className="flex-1" />

      {/* Right: User Menu */}
      <UserMenu
        userName={userName}
        userEmail={userEmail}
        userRole={userRole}
        onLogout={onLogout}
      />
    </div>
  )
}