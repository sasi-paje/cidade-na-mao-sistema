import { MaterialIcon } from '../../../../shared/components/MaterialIcon'
import type { Equipment } from '../../../../features/equipment'

interface EquipmentTableProps {
  items: Equipment[]
  onOpenDetails: (equipment: Equipment) => void
}

const ROW = 'grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-2 px-4'

export function EquipmentTable({ items, onOpenDetails }: EquipmentTableProps) {
  if (items.length === 0) {
    return <p className="py-10 text-center text-[14px] text-[#919191]">Nenhum equipamento encontrado.</p>
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Cabeçalho */}
        <div className={`${ROW} h-12 rounded-t-[6px] bg-[#0f3255] text-[13px] font-semibold text-white`}>
          <span>Nome do equipamento</span>
          <span>Quantidade</span>
          <span>Status</span>
          <span className="text-right">Ações</span>
        </div>

        {/* Linhas */}
        {items.map((eq, index) => (
          <div
            key={eq.id}
            className={`${ROW} h-12 text-[14px] text-[#2a2a2a] ${index % 2 === 1 ? 'bg-[#e7eaef]' : 'bg-white'}`}
          >
            <span className="truncate">{eq.name}</span>
            <span>{eq.quantity}</span>
            <span className={eq.is_active ? 'text-[#1e8449]' : 'text-[#919191]'}>
              {eq.is_active ? 'Ativo' : 'Inativo'}
            </span>
            <button
              type="button"
              onClick={() => onOpenDetails(eq)}
              aria-label={`Abrir ${eq.name}`}
              className="flex justify-end text-[#1e558b]"
            >
              <MaterialIcon name="open_in_new" size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
