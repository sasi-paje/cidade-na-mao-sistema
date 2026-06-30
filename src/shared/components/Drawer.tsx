import { AppIcon } from './AppIcon'
import type { TabId } from './Tabs'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  icon?: 'road' | 'contract' | 'pallet' | 'delivery_truck_speed' | 'work'
  tabs?: { id: TabId; label: string }[]
  activeTab?: TabId
  onTabChange?: (tabId: TabId) => void
  children: React.ReactNode
  showFooter?: boolean
  footerContent?: React.ReactNode
  onInativar?: () => void
  onEditar?: () => void
  fullWidth?: boolean
}

const PRIMARY_DARK = '#161a36'
const SECONDARY_DEFAULT = '#e67c26'

export const Drawer = ({
  isOpen,
  onClose,
  title,
  icon,
  tabs,
  activeTab,
  onTabChange,
  children,
  showFooter = true,
  footerContent,
  onInativar,
  onEditar,
  fullWidth = false,
}: DrawerProps) => {
  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className={`fixed right-0 top-0 h-full bg-white shadow-lg z-50 flex flex-col ${fullWidth ? 'w-[75%]' : 'w-[90%] md:w-[85%] lg:max-w-[850px]'}`}>
        {/* Header */}
        <div className="flex items-center justify-between h-[60px] px-6 shrink-0">
          <div className="flex items-center gap-[8px]">
            {icon && (
              <div className="w-[32px] h-[32px] flex items-center justify-center">
                <AppIcon name={icon} size={24} color={PRIMARY_DARK} />
              </div>
            )}
            <h2 className="font-semibold text-[20px]" style={{ fontFamily: 'Inter, sans-serif', color: PRIMARY_DARK }}>
              {title}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="flex items-center justify-center w-[32px] h-[32px] rounded hover:bg-[#f0f0f0]">
            <span className="font-semibold text-[20px]" style={{ fontFamily: 'Inter, sans-serif', color: PRIMARY_DARK }}>X</span>
          </button>
        </div>
        <div className="h-[1px] bg-[#e0e0e0] shrink-0" />

        {/* Tabs */}
        {tabs && onTabChange && activeTab && (
          <div className="bg-white flex h-[52px] items-center justify-start w-full shrink-0 px-6">
            <div className="flex flex-[1_0_0] gap-[8px] h-full items-center">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange(tab.id)}
                    className={`flex h-full items-center justify-center px-[12px] py-[8px] relative shrink-0 ${isActive ? 'border-b-2 border-solid' : ''}`}
                    style={{ borderColor: isActive ? SECONDARY_DEFAULT : 'transparent' }}
                  >
                    <span className="font-medium text-[14px] whitespace-nowrap" style={{ fontFamily: 'Inter, sans-serif', color: PRIMARY_DARK }}>
                      {tab.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Content - área flexível */}
        <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
          {children}
        </div>

        {/* Footer com borda */}
        <div className="h-[1px] bg-[#e0e0e0] shrink-0" />
        {showFooter && (
          <div className="flex items-center justify-between px-6 py-4 shrink-0 bg-white border-t border-[#e0e0e0]">
            {footerContent ? (
              footerContent
            ) : (
              <>
                <button type="button" onClick={onInativar || onClose} className="flex items-center justify-center h-[45px] px-4 py-2 rounded-[4px] bg-[#eb5757] w-[150px]">
                  <span className="font-bold text-[14px] text-white" style={{ fontFamily: 'Inter, sans-serif' }}>Inativar</span>
                </button>
                <button type="button" onClick={onEditar || onClose} className="flex items-center justify-center h-[45px] px-4 py-2 rounded-[4px] bg-[#e67c26] w-[150px]">
                  <span className="font-bold text-[14px] text-white" style={{ fontFamily: 'Inter, sans-serif' }}>Editar</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}