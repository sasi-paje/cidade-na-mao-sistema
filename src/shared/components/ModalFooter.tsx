/**
 * ModalFooter - Rodapé padronizado para todos os modais do sistema
 */

interface ModalFooterProps {
  leftActions?: React.ReactNode
  rightActions?: React.ReactNode
  className?: string
}

export const ModalFooter = ({ leftActions, rightActions, className = '' }: ModalFooterProps) => {
  return (
    <div
      className={`flex items-center justify-between w-full border-t border-[#e0e0e0] ${className}`}
      style={{
        minHeight: '45px',
        paddingTop: '16px',
        paddingBottom: '16px',
      }}
    >
      <div className="flex items-center gap-3">{leftActions}</div>
      <div className="flex items-center gap-3">{rightActions}</div>
    </div>
  )
}

export default ModalFooter