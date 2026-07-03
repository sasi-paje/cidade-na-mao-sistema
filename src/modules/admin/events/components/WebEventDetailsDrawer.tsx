import { useState } from 'react'
import { MaterialIcon } from '../../../../shared/components/MaterialIcon'
import { useLockBodyScroll } from '../../../../shared/hooks/useLockBodyScroll'
import { useEventById, adminSetEventActive } from '../../../../features/events'
import { useEventApproval } from '../../../../features/event-approvals'
import { notifyEventAttendees, buildNotifyMessage } from '../../../../features/event-notifications'
import { useWebTenant } from '../../../../features/web-tenant'
import { formatEventDay, formatEventTime, isPastEvent } from '../../../../utils/eventDate'
import { MOCK_ADMIN_USER_ID } from '../../../../app/constants/currentUser'
import { EventDetailsInfoTab } from './EventDetailsInfoTab'
import { EventConfirmedPeopleTab } from './EventConfirmedPeopleTab'
import { EventRequestedEquipmentTab } from './EventRequestedEquipmentTab'
import { ApproveEventModal } from './ApproveEventModal'
import { SuggestNewDateModal } from './SuggestNewDateModal'
import { EditEventModal } from './EditEventModal'

type DetailTab = 'info' | 'people' | 'equipment'
type SubModal = 'approve' | 'suggest' | null

type NotifyToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => void

interface WebEventDetailsDrawerProps {
  eventId: string
  onClose: () => void
  /** Exibe toast global (sucesso/aviso das ações + notificação de inscritos). */
  onNotify?: NotifyToast
}

/**
 * Drawer lateral de detalhe do evento (Informações/Pessoas/Equipamentos).
 * Renderizado por cima da lista (overlay) — a lista permanece montada atrás.
 */
export function WebEventDetailsDrawer({ eventId, onClose, onNotify }: WebEventDetailsDrawerProps) {
  const { tenant } = useWebTenant()
  const { data: event, loading, error, refetch } = useEventById(eventId, tenant)
  const { approve, proposeCounter, loading: acting } = useEventApproval(tenant)

  const [activeTab, setActiveTab] = useState<DetailTab>('info')
  const [subModal, setSubModal] = useState<SubModal>(null)
  const [editing, setEditing] = useState(false)
  const [confirmToggle, setConfirmToggle] = useState(false)
  const [togglingActive, setTogglingActive] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [approveError, setApproveError] = useState<string | null>(null)

  useLockBodyScroll(true)

  const handleToggleActive = async () => {
    if (!event) return
    const wasActive = event.is_active
    // Só evento CONFIRMADO (approved) dispara notificação de inscritos.
    const notifyOnInactivate = wasActive && event.slot_status === 'approved'
    const eventSnapshot = {
      id_event: event.id_event,
      id_slot: event.id_slot,
      title: event.title,
      date: formatEventDay(event.requested_at),
      time: formatEventTime(event.requested_at),
      location: event.location,
    }
    setToggleError(null)
    setTogglingActive(true)
    try {
      await adminSetEventActive(event.id_event, !wasActive, tenant)
      setConfirmToggle(false)
      await refetch()
      if (notifyOnInactivate) {
        // Inativação persistiu; notificação NÃO desfaz a ação em caso de falha.
        try {
          const result = await notifyEventAttendees({
            id_event: eventSnapshot.id_event,
            id_slot: eventSnapshot.id_slot,
            change_type: 'inactivated',
            event: {
              title: eventSnapshot.title,
              date: eventSnapshot.date,
              time: eventSnapshot.time,
              location: eventSnapshot.location,
            },
          })
          const { text, type } = buildNotifyMessage('inativado', result)
          onNotify?.(text, type)
        } catch {
          onNotify?.('Evento inativado, mas houve falha ao notificar os inscritos.', 'warning')
        }
      } else {
        onNotify?.(wasActive ? 'Evento inativado com sucesso.' : 'Evento reativado com sucesso.', 'success')
      }
    } catch (e) {
      setToggleError(e instanceof Error ? e.message : 'Falha ao atualizar o evento.')
    } finally {
      setTogglingActive(false)
    }
  }

  const handleApprove = async () => {
    if (!event) return
    setApproveError(null)
    try {
      await approve(event.id_event, event.id_slot)
      setSubModal(null)
      await refetch()
    } catch (e) {
      // erro de aprovação: mantém o modal aberto e mostra mensagem amigável
      setApproveError(e instanceof Error ? e.message : 'Não foi possível aprovar o evento.')
    }
  }

  const handleSuggest = async (counterDateIso: string) => {
    if (!event) return
    try {
      await proposeCounter({
        id_event: event.id_event,
        id_slot: event.id_slot,
        id_reviewed_by: MOCK_ADMIN_USER_ID,
        counter_date: counterDateIso,
        reason: 'Nova data sugerida pela gestão',
      })
      setSubModal(null)
      await refetch()
    } catch {
      /* mantém o modal aberto em caso de erro */
    }
  }

  const tab = (key: DetailTab, label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(key)}
      className={[
        'relative pb-2 text-[14px] transition-colors',
        activeTab === key
          ? 'font-semibold text-[#0f3255]'
          : 'font-medium text-[#919191] hover:text-[#1e558b]',
      ].join(' ')}
    >
      {label}
      {activeTab === key && (
        <span className="absolute -bottom-px left-0 h-[2px] w-full rounded-full bg-[#1e558b]" />
      )}
    </button>
  )

  return (
    <>
      {/* Overlay + drawer lateral à direita (lista permanece montada atrás) */}
      <div
        className="fixed inset-0 z-50 flex justify-center bg-black/40 sm:justify-end"
        onClick={onClose}
      >
        <section
          className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {loading && <p className="p-8 text-center text-[14px] text-[#919191]">Carregando evento...</p>}

          {!loading && (error || !event) && (
            <div className="p-8 text-center">
              <p className="text-[14px] text-[#eb5757]">Evento não encontrado.</p>
              <button type="button" onClick={onClose} className="mt-3 text-[14px] font-semibold text-[#1e558b]">
                Voltar para eventos
              </button>
            </div>
          )}

          {!loading && event && (
            <>
              {/* Header fixo */}
              <div className="flex shrink-0 items-center justify-between px-6 py-4">
                <div className="flex items-center gap-2">
                  <MaterialIcon name="calendar_month" size={24} className="text-[#1e558b]" />
                  <h1 className="text-[18px] font-bold uppercase text-[#0f3255]">{event.title}</h1>
                </div>
                <button type="button" onClick={onClose} aria-label="Fechar" className="text-[#0f3255]">
                  <MaterialIcon name="close" size={22} />
                </button>
              </div>
              <div className="shrink-0 border-b border-[#e2e8f0]" />

              {/* Abas fixas */}
              <div className="flex shrink-0 items-center gap-6 px-6 pt-4">
                {tab('info', 'Informações')}
                {tab('people', 'Pessoas Confirmadas')}
                {tab('equipment', 'Equipamentos Solicitados')}
              </div>
              <div className="shrink-0 border-b border-[#e2e8f0]" />

              {/* Conteúdo (scroll interno) */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {activeTab === 'info' && <EventDetailsInfoTab event={event} />}
                {activeTab === 'people' && <EventConfirmedPeopleTab event={event} />}
                {activeTab === 'equipment' && <EventRequestedEquipmentTab event={event} />}
              </div>

              {/*
                Footer fixo — ações por status (usa `slot_status` code, não label):
                  • pending  → Sugerir nova Data + Aprovar (sem Inativar/Editar/Reprovar)
                  • demais   → Inativar/Ativar + Editar (gestão do evento já decidido)
                Decisão p/ outros status (approved/counter_proposed/rejected/inactive):
                tratados como o ramo de gestão — só ações seguras (toggle ativo + editar),
                nunca aprovar/sugerir/reprovar.
              */}
              <div className="shrink-0 border-t border-[#e2e8f0]" />
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-6 py-4">
                {event.slot_status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setSubModal('suggest')}
                      className="h-[45px] rounded-[5px] border border-[#0f3255] px-4 text-[14px] font-semibold text-[#0f3255]"
                    >
                      Sugerir nova Data
                    </button>
                    <button
                      type="button"
                      onClick={() => { setApproveError(null); setSubModal('approve') }}
                      className="h-[45px] rounded-[5px] bg-[#1e558b] px-6 text-[14px] font-bold text-white"
                    >
                      Aprovar
                    </button>
                  </>
                ) : (
                  <>
                    {/* Evento que já ocorreu: não pode inativar (ação removida).
                        Reativar um evento passado inativo continua permitido. */}
                    {!(isPastEvent(event.requested_at) && event.is_active) && (
                      <button
                        type="button"
                        onClick={() => { setToggleError(null); setConfirmToggle(true) }}
                        className={[
                          'flex h-[45px] items-center gap-1 rounded-[5px] border px-5 text-[14px] font-semibold',
                          event.is_active
                            ? 'border-[#eb5757] text-[#eb5757]'
                            : 'border-[#1e8449] text-[#1e8449]',
                        ].join(' ')}
                      >
                        <MaterialIcon name={event.is_active ? 'block' : 'check_circle'} size={18} />
                        {event.is_active ? 'Inativar' : 'Ativar'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="flex h-[45px] items-center gap-1 rounded-[5px] bg-[#1e558b] px-8 text-[14px] font-bold text-white"
                    >
                      <MaterialIcon name="edit" size={18} />
                      Editar
                    </button>
                  </>
                )}
              </div>

              {/* Sub-modais de decisão (pending) */}
              {subModal === 'approve' && (
                <ApproveEventModal
                  event={event}
                  busy={acting}
                  error={approveError}
                  onCancel={() => { setApproveError(null); setSubModal(null) }}
                  onConfirm={handleApprove}
                />
              )}
              {subModal === 'suggest' && (
                <SuggestNewDateModal
                  event={event}
                  busy={acting}
                  onCancel={() => setSubModal(null)}
                  onConfirm={handleSuggest}
                />
              )}
            </>
          )}
        </section>
      </div>

      {/* Editar (reaproveita o fluxo existente) */}
      <EditEventModal
        event={event ?? null}
        open={editing && !!event}
        onClose={() => setEditing(false)}
        onSaved={() => { void refetch() }}
        onNotify={onNotify}
      />

      {/* Confirmação de ativar/inativar (RPC real admin_set_event_active) */}
      {confirmToggle && event && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
          onClick={() => { if (!togglingActive) setConfirmToggle(false) }}
        >
          <div className="w-full max-w-md rounded-[8px] bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-bold text-[#0f3255]">
              {event.is_active ? 'Inativar evento' : 'Reativar evento'}
            </p>
            <p className="mt-2 text-[14px] text-[#4c4c4c]">
              {event.is_active
                ? 'Este evento deixará de ficar ativo. Deseja continuar?'
                : 'Este evento voltará a ficar ativo. Deseja continuar?'}
            </p>
            {event.is_active && event.slot_status === 'approved' && (
              <p className="mt-2 text-[13px] text-[#1e558b]">
                Os inscritos confirmados serão notificados sobre a inativação deste evento.
              </p>
            )}
            {toggleError && <p className="mt-2 text-[13px] text-[#eb5757]">{toggleError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmToggle(false)}
                disabled={togglingActive}
                className="h-[40px] rounded-[6px] border border-[#0f3255] px-5 text-[14px] font-semibold text-[#0f3255] disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={togglingActive}
                className={[
                  'h-[40px] rounded-[6px] px-5 text-[14px] font-bold text-white disabled:opacity-60',
                  event.is_active ? 'bg-[#eb5757]' : 'bg-[#1e8449]',
                ].join(' ')}
              >
                {togglingActive ? 'Salvando...' : event.is_active ? 'Inativar' : 'Ativar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
