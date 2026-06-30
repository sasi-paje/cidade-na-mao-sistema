interface MobileDialogProps {
  title: string
  onClose: () => void
  children?: React.ReactNode
}

/**
 * Overlay/modal central no estilo do guia "SASI Eventos Mobile":
 * fundo escurecido translúcido, cartão branco arredondado e centralizado.
 */
export function MobileDialog({ title, onClose, children }: MobileDialogProps) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-[18px]"
      style={{ background: 'rgba(20,30,45,0.45)' }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-[420px] flex-col gap-[14px] rounded-[14px] bg-white p-[18px]"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-center text-[17px] font-bold text-[#0f3255]">{title}</span>
        {children}
      </div>
    </div>
  )
}
