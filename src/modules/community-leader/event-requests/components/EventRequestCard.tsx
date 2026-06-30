import { MaterialIcon } from '../../../../shared/components/MaterialIcon'
import type { EventFullView } from '../../../../features/events'
import { EventBanner, EventDateLine, EventPlaceLine } from '../../../public/events/eventVisuals'
import { EventRequestStatusBadge } from './EventRequestStatusBadge'

interface EventRequestCardProps {
  request: EventFullView
  onOpenDetails?: (request: EventFullView) => void
}

/**
 * Card de solicitação de evento do líder (guia "SASI Eventos Mobile"):
 * banner 120px, pill de status no canto superior esquerdo e atalho para o
 * detalhe no canto direito; o card inteiro é clicável.
 */
export function EventRequestCard({ request, onOpenDetails }: EventRequestCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpenDetails?.(request)}
      className="w-full overflow-hidden rounded-[8px] bg-white text-left shadow-[0_1px_8px_rgba(0,0,0,0.16)] transition-transform active:scale-[0.99]"
    >
      <EventBanner src={request.banner_url} alt={request.title} height={120}>
        <span className="absolute left-[10px] top-[10px]">
          <EventRequestStatusBadge status={request.slot_status} />
        </span>
        <span className="absolute right-2 top-2 flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#1e558b] text-white shadow-[0_2px_5px_rgba(0,0,0,0.3)]">
          <MaterialIcon name="open_in_new" size={20} />
        </span>
      </EventBanner>

      <div className="flex flex-col gap-[5px] px-4 pb-3 pt-[10px]">
        <span className="text-[16px] font-bold text-[#2a2a2a]">{request.title}</span>
        <EventDateLine iso={request.requested_at} />
        <EventPlaceLine place={request.location} />
      </div>
    </button>
  )
}
