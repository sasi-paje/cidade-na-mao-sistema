import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { formatEventDateTime, formatEventDay, formatEventTime } from '../../../../utils/eventDate'
import { useEventById } from '../../../../features/events'
import { useEventSlot } from '../../../../features/event-slots'
import { useLatestApproval } from '../../../../features/event-approvals'
import { useMobileToken } from '../../../../features/sasi-token'
import { LEADER_MOBILE_ROUTES } from '../../../../app/routes/routePaths'
import { EventBanner } from '../../../public/events/eventVisuals'
import { MobileDialog } from '../../../public/events/MobileDialog'
import { EventRequestStatusBadge } from '../components/EventRequestStatusBadge'

const fieldLabel = 'text-[13px] font-bold text-[#2a2a2a]'
const fieldValue = 'text-[14px] text-[#2a2a2a]'

/** `/m/lider/eventos-solicitados/:id` — detalhe da solicitação do líder. */
export function EventRequestDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { withMobileToken } = useMobileToken()
  const [reviewOpen, setReviewOpen] = useState(false)

  const { data: event, loading, error, refetch } = useEventById(id)
  const { acceptCounter, rejectCounter, mutating } = useEventSlot(event?.id_slot)
  const { data: approval } = useLatestApproval(event?.id_event, event?.id_slot)

  const handleAccept = async () => {
    setReviewOpen(false)
    await acceptCounter()
    await refetch()
  }

  const handleReject = async () => {
    if (!event) return
    setReviewOpen(false)
    await rejectCounter(event.id_event)
    await refetch()
  }

  if (loading) {
    return <p className="py-10 text-center text-[15px] text-[#919191]">Carregando solicitação...</p>
  }

  if (error || !event) {
    return (
      <div className="py-10 text-center">
        <p className="text-[15px] text-[#eb5757]">Solicitação não encontrada.</p>
        <button
          type="button"
          onClick={() => navigate(withMobileToken(LEADER_MOBILE_ROUTES.requestedEvents))}
          className="mt-3 text-[14px] font-semibold text-[#1e558b]"
        >
          Voltar
        </button>
      </div>
    )
  }

  const isCounter = event.slot_status === 'counter_proposed'

  return (
    <>
      <section className="flex flex-col gap-[14px] rounded-[12px] bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <span className="text-[18px] font-bold text-[#0f3255]">Evento Solicitado</span>

        <div className="flex flex-col gap-[6px]">
          <span className={fieldLabel}>Status</span>
          <EventRequestStatusBadge status={event.slot_status} variant="dot" />
        </div>

        <EventBanner src={event.banner_url} alt={event.title} height={160} radius={8} />

        <div className="flex flex-col gap-[6px]">
          <span className={fieldLabel}>Nome do Evento</span>
          <span className={fieldValue}>{event.title}</span>
        </div>

        <div className="flex flex-row gap-6">
          <div className="flex flex-col gap-[6px]">
            <span className={fieldLabel}>Dia</span>
            <span className={fieldValue}>{formatEventDay(event.requested_at) || '—'}</span>
          </div>
          <div className="flex flex-col gap-[6px]">
            <span className={fieldLabel}>Hora</span>
            <span className={fieldValue}>{formatEventTime(event.requested_at) || '—'}</span>
          </div>
          <div className="flex flex-col gap-[6px]">
            <span className={fieldLabel}>Vagas</span>
            <span className={fieldValue}>{event.capacity}</span>
          </div>
        </div>

        <div className="flex flex-col gap-[6px]">
          <span className={fieldLabel}>Local</span>
          <span className={fieldValue}>{event.location}</span>
        </div>

        {event.equipment_requests && event.equipment_requests.length > 0 && (
          <div className="flex flex-col gap-[6px]">
            <span className={fieldLabel}>Equipamentos</span>
            <div className="flex flex-row flex-wrap gap-[6px]">
              {event.equipment_requests.map((req) => (
                <span
                  key={req.id}
                  className="rounded-[5px] bg-[#1e558b] px-[9px] py-[3px] text-[13px] font-medium text-white"
                >
                  {req.equipment?.name ?? req.id_equipment} · {req.quantity}
                </span>
              ))}
            </div>
          </div>
        )}

        {event.description && (
          <div className="flex flex-col gap-[6px]">
            <span className={fieldLabel}>Descrição</span>
            <span className="text-justify text-[14px] leading-[1.5] text-[#2a2a2a]">{event.description}</span>
          </div>
        )}

        {event.slot_status === 'rejected' && approval?.reason && (
          <p className="rounded-[8px] bg-[#fbe0e0] px-3 py-2 text-[14px] text-[#c0392b]">
            Motivo da reprovação: {approval.reason}
          </p>
        )}

        {isCounter ? (
          <div className="mt-1 flex flex-row gap-2">
            <button
              type="button"
              onClick={() => navigate(withMobileToken(LEADER_MOBILE_ROUTES.requestedEvents))}
              className="h-[46px] flex-1 rounded-[8px] border-[1.5px] border-[#1e558b] bg-white text-[15px] font-bold text-[#1e558b]"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              className="h-[46px] flex-1 rounded-[8px] bg-[#1e558b] text-[15px] font-bold text-white"
            >
              Revisar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => navigate(withMobileToken(LEADER_MOBILE_ROUTES.requestedEvents))}
            className="mt-1 h-[46px] rounded-[8px] border-[1.5px] border-[#1e558b] bg-white text-[15px] font-bold text-[#1e558b]"
          >
            Voltar
          </button>
        )}
      </section>

      {reviewOpen && (
        <MobileDialog title="Revisar evento" onClose={() => setReviewOpen(false)}>
          <span className="text-[14px] text-[#2a2a2a]">Uma nova data foi sugerida para o evento.</span>

          <div className="flex flex-col gap-[6px]">
            <span className={fieldLabel}>Nova data proposta</span>
            <div className="flex h-[44px] items-center rounded-[8px] border-[1.5px] border-[#e1e7ee] px-3 text-[14px] text-[#2a2a2a]">
              {formatEventDateTime(event.counter_date) || '—'}
            </div>
          </div>

          {approval?.reason && <span className="text-[13px] text-[#5b6675]">Motivo: {approval.reason}</span>}

          <div className="mt-0.5 flex flex-row gap-2">
            <button
              type="button"
              disabled={mutating}
              onClick={handleReject}
              className="h-[46px] flex-1 rounded-[8px] border-[1.5px] border-[#eb5757] text-[15px] font-bold text-[#eb5757] disabled:opacity-60"
            >
              Recusar
            </button>
            <button
              type="button"
              disabled={mutating}
              onClick={handleAccept}
              className="h-[46px] flex-1 rounded-[8px] bg-[#1e558b] text-[15px] font-bold text-white disabled:opacity-60"
            >
              Aceitar nova data
            </button>
          </div>
        </MobileDialog>
      )}
    </>
  )
}
