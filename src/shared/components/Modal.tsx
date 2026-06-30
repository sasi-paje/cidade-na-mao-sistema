import { AppIcon } from './AppIcon'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  icon?: 'road' | 'contract' | 'pallet' | 'delivery_truck_speed' | 'work' | 'person'
  width?: string
  children: React.ReactNode
  showFooter?: boolean
  footer?: React.ReactNode
  onBack?: () => void
  onConfirm?: () => void
  confirmLabel?: string
  backLabel?: string
  confirmDisabled?: boolean
}

const PRIMARY_DARK = '#0f3255'
const SECONDARY = '#4077d9'

export const Modal = ({
  isOpen,
  onClose,
  title,
  icon,
  width,
  children,
  showFooter = true,
  footer,
  onBack,
  onConfirm,
  confirmLabel = 'Editar',
  backLabel = 'Voltar',
  confirmDisabled = false,
}: ModalProps) => {
  if (!isOpen) return null

  // Separa children em conteúdo regular e ModalFooter
  const childrenArray = Array.isArray(children) ? children : [children]
  const contentElements: React.ReactNode[] = []
  let footerElement: React.ReactNode | null = null

  childrenArray.forEach((child) => {
    if (!child || typeof child !== 'object') {
      contentElements.push(child)
      return
    }
    const childType = child as React.ReactElement
    const typeName = childType.type as unknown
    const typeObj = typeName as { name?: string; displayName?: string }
    // Verifica por nome do componente ou displayName
    const isModalFooter =
      (typeof typeName === 'object' && typeName !== null && typeObj.name === 'ModalFooter') ||
      (typeof typeName === 'function' && (typeName as { name?: string }).name === 'ModalFooter') ||
      (childType.props && 'leftActions' in childType.props && 'rightActions' in childType.props)

    if (isModalFooter) {
      footerElement = child
    } else {
      contentElements.push(child)
    }
  })

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Modal lateral - abre da direita */}
      <div className="fixed inset-0 flex items-stretch justify-end z-50">
        <div
          className="bg-white flex flex-col h-full overflow-hidden"
          style={{
            width: width || '50vw',
            maxWidth: '600px',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between h-[60px] px-6 shrink-0">
            <div className="flex items-center gap-[8px]">
              {icon && (
                <div className="w-[32px] h-[32px] flex items-center justify-center">
                  <AppIcon name={icon} size={24} color={PRIMARY_DARK} />
                </div>
              )}
              <h2
                className="font-semibold text-[20px]"
                style={{ fontFamily: 'Inter, sans-serif', color: PRIMARY_DARK }}
              >
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded"
            >
              <AppIcon name="close" size={20} color={PRIMARY_DARK} />
            </button>
          </div>

          {/* Divider */}
          <div className="h-[1px] bg-[#e0e0e0] shrink-0" />

          {/* Content - área rolável */}
          <div className="flex-1 min-h-0 overflow-auto px-6 py-4 w-full">
            {contentElements}
          </div>

          {/* Footer */}
          {(showFooter || footer || footerElement) && (
            <div className="shrink-0 border-t border-[#e0e0e0] px-6 py-4 bg-white">
              {footerElement || (showFooter && footer ? footer : (
                  <div className="flex items-center justify-between w-full">
                    <button
                      type="button"
                      onClick={onBack}
                      className="flex items-center justify-center h-[45px] px-[8px] py-[2px] rounded-[5px] border border-[#4077d9] bg-white w-[150px]"
                    >
                      <span
                        className="font-bold text-[14px]"
                        style={{ fontFamily: 'Inter, sans-serif', color: SECONDARY }}
                      >
                        {backLabel}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={confirmDisabled ? undefined : (onConfirm || onClose)}
                      disabled={confirmDisabled}
                      className={`flex items-center justify-center h-[45px] px-[8px] py-[2px] rounded-[4px] w-[150px] ${
                        confirmDisabled
                          ? 'bg-[#0f3255] opacity-50 cursor-not-allowed'
                          : 'bg-[#0f3255] cursor-pointer hover:opacity-90'
                      }`}
                    >
                      <span
                        className="font-bold text-[14px] text-white"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                      >
                        {confirmLabel}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
          )}
        </div>
      </div>
    </>
  )
}