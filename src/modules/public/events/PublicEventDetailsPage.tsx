import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { MaterialIcon } from '../../../shared/components/MaterialIcon'
import { useEventById } from '../../../features/events'
import { useEventAttendance } from '../../../features/event-attendance'
import { useCurrentUser } from '../../../features/auth'
import { useMobileToken } from '../../../features/sasi-token'
import { USER_MOBILE_ROUTES, LEADER_MOBILE_ROUTES, isLeaderPath } from '../../../app/routes/routePaths'
import { isPastEvent } from '../../../utils/eventDate'
import { EventBanner, EventDateLine } from './eventVisuals'
import { MobileDialog } from './MobileDialog'

/**
 * `/m/usuario/eventos/:id` e `/m/lider/eventos/:id` — detalhe do evento +
 * confirmar/cancelar participação. A navegação (voltar / pós-confirmação)
 * respeita o FLUXO da URL para não jogar o líder no fluxo de usuário comum.
 */
export function PublicEventDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { withMobileToken } = useMobileToken()
  const [modal, setModal] = useState<'confirm' | 'cancel' | null>(null)

  // Fluxo atual (líder ou usuário) — define para onde "Voltar" e o pós-confirmar
  // retornam, mantendo o usuário no mesmo fluxo.
  const isLeaderFlow = isLeaderPath(pathname)
  const eventsPath = isLeaderFlow ? LEADER_MOBILE_ROUTES.events : USER_MOBILE_ROUTES.events
  // Fluxo líder não tem "Meus Eventos": após confirmar, volta à lista do líder.
  const afterConfirmPath = isLeaderFlow ? LEADER_MOBILE_ROUTES.events : USER_MOBILE_ROUTES.myEvents

  const { masterUserId, name, email } = useCurrentUser()
  const { data: event, loading, error, refetch: refetchEvent } = useEventById(id)
  const {
    isConfirmed,
    mutating,
    confirm,
    cancel,
    error: attendanceError,
  } = useEventAttendance(event?.id_event, event?.id_slot, masterUserId)

  if (loading) {
    return <p className="py-10 text-center text-[15px] text-[#919191]">Carregando evento...</p>
  }

  if (error || !event) {
    return (
      <div className="py-10 text-center">
        <p className="text-[15px] text-[#eb5757]">Evento não encontrado.</p>
        <button
          type="button"
          onClick={() => navigate(withMobileToken(eventsPath))}
          className="mt-3 text-[14px] font-semibold text-[#1e558b]"
        >
          Voltar para eventos
        </button>
      </div>
    )
  }

  const handleConfirm = async () => {
    setModal(null)
    try {
      await confirm()
      // Sucesso (Figma 78-5298): vai para "Meus Eventos", preservando o token.
      navigate(withMobileToken(afterConfirmPath), { replace: true })
    } catch {
      /* erro: attendanceError exibido na tela; permanece e NÃO redireciona */
    }
  }
  const handleCancel = async () => {
    setModal(null)
    try {
      await cancel()
      await refetchEvent()
    } catch {
      /* erro exibido via attendanceError */
    }
  }

  return (
    <>
      <section className="flex flex-col gap-[14px] rounded-[12px] bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
        <span className="text-[18px] font-bold text-[#0f3255]">{event.title}</span>

        <EventBanner src={event.banner_url} alt={event.title} height={240} radius={8} />

        <span className="text-[16px] font-bold text-[#2a2a2a]">Sobre o Evento</span>
        <span className="text-justify text-[14px] leading-[1.5] text-[#2a2a2a]">{event.description}</span>

        <div className="flex flex-col gap-[10px]">
          <EventDateLine iso={event.requested_at} size={14} iconSize={18} />
          <div className="flex flex-row items-center gap-2">
            <MaterialIcon name="location_on" size={18} className="shrink-0 text-[#bdbdbd]" />
            <span className="text-[14px] text-[#2a2a2a]">{event.location}</span>
          </div>
          <div className="flex flex-row items-center gap-2">
            <MaterialIcon name="group" size={18} className="shrink-0 text-[#bdbdbd]" />
            <span className="text-[14px] text-[#2a2a2a]">
              {event.confirmed_count} pessoa(s) confirmaram · {event.capacity} vagas
            </span>
          </div>
        </div>

        {attendanceError && (
          <p className="text-[13px] text-[#eb5757]">
            {attendanceError.message || 'Não foi possível atualizar sua participação.'}
          </p>
        )}

        {!masterUserId && (
          <p className="rounded-[8px] bg-[#fdf3d8] px-3 py-2 text-[13px] text-[#8a6d1b]">
            Acesse pelo app SASI para confirmar sua presença.
          </p>
        )}

        <div className="mt-1 flex flex-row gap-2">
          <button
            type="button"
            onClick={() => navigate(withMobileToken(eventsPath))}
            className="h-[46px] flex-1 rounded-[8px] border-[1.5px] border-[#1e558b] bg-white text-[15px] font-bold text-[#1e558b]"
          >
            Voltar
          </button>
          {/* Evento que já ocorreu: participação congelada — sem confirmar nem
              cancelar ingresso (ação indisponível para evento passado). */}
          {masterUserId &&
            !isPastEvent(event.requested_at) &&
            (isConfirmed ? (
              <button
                type="button"
                disabled={mutating}
                onClick={() => setModal('cancel')}
                className="h-[46px] flex-1 rounded-[8px] bg-[#eb5757] text-[14px] font-bold text-white disabled:opacity-60"
              >
                Cancelar meu ingresso
              </button>
            ) : (
              <button
                type="button"
                disabled={mutating}
                onClick={() => setModal('confirm')}
                className="h-[46px] flex-1 rounded-[8px] bg-[#1e558b] text-[14px] font-bold text-white disabled:opacity-60"
              >
                Quero participar!
              </button>
            ))}
        </div>
      </section>

      {modal === 'confirm' && (
        <MobileDialog title="Confirme seus dados" onClose={() => setModal(null)}>
          <div className="flex flex-col gap-[6px]">
            <span className="text-[13px] font-bold text-[#2a2a2a]">Nome</span>
            <div className="flex h-[44px] items-center rounded-[8px] border-[1.5px] border-[#e1e7ee] px-3 text-[14px] text-[#2a2a2a]">
              {name || '—'}
            </div>
          </div>
          <div className="flex flex-col gap-[6px]">
            <span className="text-[13px] font-bold text-[#2a2a2a]">E-mail</span>
            <div className="flex h-[44px] items-center rounded-[8px] border-[1.5px] border-[#e1e7ee] px-3 text-[14px] text-[#2a2a2a]">
              {email || '—'}
            </div>
          </div>
          <div className="mt-0.5 flex flex-row gap-2">
            <button
              type="button"
              onClick={() => setModal(null)}
              className="h-[46px] flex-1 rounded-[8px] border-[1.5px] border-[#1e558b] text-[15px] font-bold text-[#1e558b]"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={mutating}
              onClick={handleConfirm}
              className="h-[46px] flex-1 rounded-[8px] bg-[#1e558b] text-[15px] font-bold text-white disabled:opacity-60"
            >
              Confirmar
            </button>
          </div>
        </MobileDialog>
      )}

      {modal === 'cancel' && (
        <MobileDialog title="Cancelar participação" onClose={() => setModal(null)}>
          <span className="text-center text-[14px] leading-[1.5] text-[#2a2a2a]">
            Tem certeza que deseja cancelar sua participação neste evento?
          </span>
          <div className="mt-0.5 flex flex-row gap-2">
            <button
              type="button"
              onClick={() => setModal(null)}
              className="h-[46px] flex-1 rounded-[8px] border-[1.5px] border-[#1e558b] text-[15px] font-bold text-[#1e558b]"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={mutating}
              onClick={handleCancel}
              className="h-[46px] flex-[1.3] rounded-[8px] bg-[#eb5757] text-[15px] font-bold text-white disabled:opacity-60"
            >
              Cancelar meu ingresso
            </button>
          </div>
        </MobileDialog>
      )}
    </>
  )
}
