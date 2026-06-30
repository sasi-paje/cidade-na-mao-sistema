import { MaterialIcon } from '../../../../shared/components/MaterialIcon'
import { formatEventDateTime } from '../../../../utils/eventDate'
import type { EventFullView } from '../../../../features/events'

interface EditEventInfoTabProps {
  event: EventFullView
}

/**
 * Aba "Informações" (placeholder read-only nesta etapa).
 * A edição completa dos dados do evento será implementada em seguida.
 */
export function EditEventInfoTab({ event }: EditEventInfoTabProps) {
  return (
    <div>
      <h2 className="mb-1 text-[16px] font-bold uppercase text-[#0f3255]">{event.title}</h2>
      <p className="mb-4 text-[14px] text-[#4c4c4c]">{event.description}</p>

      <div className="space-y-2 text-[14px] text-[#4c4c4c]">
        <div className="flex items-center gap-2">
          <MaterialIcon name="event" size={20} className="text-[#1e558b]" />
          <span>{formatEventDateTime(event.requested_at)}</span>
        </div>
        <div className="flex items-center gap-2">
          <MaterialIcon name="location_on" size={20} className="text-[#1e558b]" />
          <span>{event.location}</span>
        </div>
        <div className="flex items-center gap-2">
          <MaterialIcon name="group" size={20} className="text-[#1e558b]" />
          <span>{event.capacity} vagas</span>
        </div>
      </div>

      <p className="mt-5 rounded-[5px] border border-[#bdcde8] bg-[#f5f9ff] px-3 py-3 text-[13px] text-[#1e558b]">
        A edição dos dados do evento será implementada em seguida. Por enquanto, edite os equipamentos
        solicitados na aba ao lado.
      </p>
    </div>
  )
}
