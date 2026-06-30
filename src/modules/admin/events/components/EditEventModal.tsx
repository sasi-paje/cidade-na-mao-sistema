import { useLockBodyScroll } from '../../../../shared/hooks/useLockBodyScroll'
import { useEquipment } from '../../../../features/equipment'
import { useEventById } from '../../../../features/events'
import type { EventFullView } from '../../../../features/events'
import { EditEventForm } from './EditEventForm'

interface EditEventModalProps {
  event: EventFullView | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

/**
 * Drawer de edição de evento (web/admin). Busca o evento COMPLETO (com
 * equipamentos reais via `getEventById`) e inicializa o `EditEventForm` a partir
 * dele. Salva real via `admin_update_event` (sem mock/localStorage).
 */
export function EditEventModal({ event, open, onClose, onSaved }: EditEventModalProps) {
  const { data: full, loading } = useEventById(open && event ? event.id_event : undefined)
  const { data: catalog } = useEquipment()

  useLockBodyScroll(open)

  if (!open || !event) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/40 sm:justify-end" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {loading || !full ? (
          <p className="p-8 text-center text-[14px] text-[#919191]">Carregando evento...</p>
        ) : (
          <EditEventForm
            key={full.id_event}
            event={full}
            catalog={catalog}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </div>
    </div>
  )
}
