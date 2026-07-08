import { MaterialIcon } from '../../../shared/components/MaterialIcon'
import type { EventFullView } from '../../../features/events'
import { useLazyEventBanner } from '../../../features/events'
import { EventBanner, EventDateLine, EventPlaceLine } from './eventVisuals'

interface EventCardProps {
  event: EventFullView
  onClick?: (event: EventFullView) => void
  /** Marca o evento como já confirmado pelo usuário (badge verde). */
  confirmed?: boolean
}

/**
 * Card de evento da lista mobile (guia "SASI Eventos Mobile"):
 * banner 120px, badge de ingresso no canto, título, data e local.
 */
export function EventCard({ event, onClick, confirmed = false }: EventCardProps) {
  // O feed não traz banner_url (base64 pesado). Carrega sob demanda ao aparecer.
  const { ref, banner } = useLazyEventBanner<HTMLButtonElement>(event.id_event, event.banner_url)
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onClick?.(event)}
      className="w-full overflow-hidden rounded-[8px] bg-white text-left shadow-[0_1px_8px_rgba(0,0,0,0.16)] transition-transform active:scale-[0.99]"
    >
      <EventBanner src={banner} alt={event.title} height={120}>
        <span
          className="absolute right-2 top-2 flex h-[38px] w-[38px] items-center justify-center rounded-full text-white shadow-[0_2px_5px_rgba(0,0,0,0.3)]"
          style={{ background: confirmed ? '#1F9D57' : '#9AA3AE' }}
        >
          <MaterialIcon name="confirmation_number" size={22} />
        </span>
      </EventBanner>

      <div className="flex flex-col gap-[5px] px-4 pb-3 pt-[10px]">
        <span className="text-[16px] font-bold text-[#2a2a2a]">{event.title}</span>
        <EventDateLine iso={event.requested_at} />
        <EventPlaceLine place={event.location} />
      </div>
    </button>
  )
}
