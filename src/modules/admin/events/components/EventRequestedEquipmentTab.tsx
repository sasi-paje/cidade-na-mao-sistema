import type { EventFullView } from '../../../../features/events'

interface EventRequestedEquipmentTabProps {
  event: EventFullView
}

export function EventRequestedEquipmentTab({ event }: EventRequestedEquipmentTabProps) {
  const items = event.equipment_requests ?? []

  if (items.length === 0) {
    return <p className="py-8 text-center text-[14px] text-[#919191]">Nenhum equipamento solicitado.</p>
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 border-b border-[#e2e8f0] pb-2 text-[13px] font-semibold text-[#0f3255]">
        <span>Equipamento</span>
        <span>Quantidade</span>
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          className="grid grid-cols-2 gap-2 border-b border-[#e2e8f0] py-3 text-[14px] text-[#2a2a2a]"
        >
          <span>{item.equipment?.name ?? item.id_equipment}</span>
          <span>{item.quantity}</span>
        </div>
      ))}
    </div>
  )
}
