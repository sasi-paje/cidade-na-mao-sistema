import { useState } from 'react'
import { MaterialIcon } from '../../../../shared/components/MaterialIcon'
import { formatEventDateTime } from '../../../../utils/eventDate'
import type { EventFullView } from '../../../../features/events'
import { EventStatusBadge } from './EventStatusBadge'

interface WebEventCardProps {
  event: EventFullView
  onOpenInfo?: (event: EventFullView) => void
  onEdit?: (event: EventFullView) => void
}

export function WebEventCard({ event, onOpenInfo, onEdit }: WebEventCardProps) {
  const [imageError, setImageError] = useState(false)

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[8px] bg-white shadow-[0_1px_4px_0_rgba(15,50,85,0.12)]">
      <div className="relative aspect-[16/9] w-full bg-[#bdcde8]">
        {event.banner_url && !imageError ? (
          <img
            src={event.banner_url}
            alt={event.title}
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#1e558b] to-[#0f3255]" />
        )}
        <div className="absolute top-2 left-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#e67c26] text-white shadow-sm">
          <MaterialIcon name="confirmation_number" size={18} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="text-[16px] font-bold uppercase text-[#0f3255] leading-tight">{event.title}</h3>

        <div className="mt-2 flex items-center gap-1.5 text-[13px] text-[#4c4c4c]">
          <MaterialIcon name="event" size={18} className="text-[#1e558b]" />
          <span>{formatEventDateTime(event.requested_at)}</span>
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-[13px] text-[#919191]">
          <MaterialIcon name="location_on" size={18} className="text-[#1e558b]" />
          <span className="truncate">{event.location}</span>
        </div>

        <div className="mt-2">
          <EventStatusBadge status={event.slot_status} isActive={event.is_active} />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenInfo?.(event)}
            className="flex h-[38px] flex-1 items-center justify-center gap-1 rounded-[6px] border border-[#1e558b] text-[14px] font-semibold text-[#1e558b]"
          >
            <MaterialIcon name="open_in_new" size={18} />
            Abrir Informações
          </button>
          <button
            type="button"
            onClick={() => onEdit?.(event)}
            aria-label="Editar evento"
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[6px] border border-[#bdcde8] text-[#1e558b]"
          >
            <MaterialIcon name="edit" size={18} />
          </button>
        </div>
      </div>
    </article>
  )
}
