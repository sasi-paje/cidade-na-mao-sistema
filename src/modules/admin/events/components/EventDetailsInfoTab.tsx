import { useState } from 'react'
import { MaterialIcon } from '../../../../shared/components/MaterialIcon'
import { formatEventDay, formatEventTime } from '../../../../utils/eventDate'
import type { EventFullView } from '../../../../features/events'
import { EventStatusBadge } from './EventStatusBadge'

interface EventDetailsInfoTabProps {
  event: EventFullView
}

const label = 'mb-1 block text-[13px] font-semibold text-[#0f3255]'
const value = 'text-[14px] text-[#4c4c4c]'

export function EventDetailsInfoTab({ event }: EventDetailsInfoTabProps) {
  const [imageError, setImageError] = useState(false)

  return (
    <div className="space-y-4">
      <div>
        <span className={label}>Status</span>
        <EventStatusBadge status={event.slot_status} isActive={event.is_active} />
      </div>

      <div>
        <span className={label}>Banner</span>
        <div className="aspect-[16/9] w-full max-w-[360px] overflow-hidden rounded-[5px] border border-[#e2e8f0] bg-[#bdcde8]">
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
        </div>
      </div>

      <div>
        <span className={label}>Nome do Evento</span>
        <p className={value}>{event.title}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <span className={label}>Dia</span>
          <p className={`flex items-center gap-1.5 ${value}`}>
            <MaterialIcon name="calendar_month" size={18} className="text-[#1e558b]" />
            {formatEventDay(event.requested_at)}
          </p>
        </div>
        <div>
          <span className={label}>Hora</span>
          <p className={value}>{formatEventTime(event.requested_at)}</p>
        </div>
      </div>

      <div>
        <span className={label}>Local</span>
        <p className={`flex items-center gap-1.5 ${value}`}>
          <MaterialIcon name="location_on" size={18} className="text-[#1e558b]" />
          {event.location}
        </p>
      </div>

      <div>
        <span className={label}>Descrição</span>
        <p className={value}>{event.description}</p>
      </div>

      <div>
        <span className={label}>Vagas</span>
        <p className={value}>{event.capacity}</p>
      </div>
    </div>
  )
}
