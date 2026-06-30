interface PlaceholderProps {
  title: string
  message: string
}

/** Tela simples de placeholder para rotas ainda não implementadas. */
export function Placeholder({ title, message }: PlaceholderProps) {
  return (
    <div className="py-12 text-center">
      <h1 className="text-[20px] font-bold text-[#0f3255]">{title}</h1>
      <p className="mt-2 text-[14px] text-[#919191]">{message}</p>
    </div>
  )
}
