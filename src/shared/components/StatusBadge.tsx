export type NoteStatus =
  | 'Aguardando entrega'
  | 'Entrega Total'
  | 'Entrega Parcial'
  | 'Entrega Negada'
  | 'Entrega Abortada'
  | 'Pendente'
  | 'Em Trânsito'
  | 'Cancelada'
  | 'Ativo'
  | 'Inativo'
  | string

interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
}

const statusColors: Record<string, string> = {
  'Aguardando entrega': 'bg-[#4077d9]',
  'Entrega Total': 'bg-[#27ae60]',
  'Entrega Parcial': 'bg-[#e2b93b]',
  'Entrega Negada': 'bg-[#eb5757]',
  'Entrega Abortada': 'bg-[#eb5757]',
  'Pendente': 'bg-[#4077d9]',
  'Em Trânsito': 'bg-[#e2b93b]',
  'Cancelada': 'bg-[#eb5757]',
  'Ativo': 'bg-[#27ae60]',
  'Inativo': 'bg-[#eb5757]',
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const bgColor = statusColors[status] || 'bg-[#bdbdbd]'

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5'
    : 'text-[12px] px-2 py-1'

  return (
    <span className={`font-bold text-white rounded-full whitespace-nowrap ${bgColor} ${sizeClasses}`}>
      {status}
    </span>
  )
}
