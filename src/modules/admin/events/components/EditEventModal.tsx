import { useLockBodyScroll } from '../../../../shared/hooks/useLockBodyScroll'
import { useEquipment } from '../../../../features/equipment'
import { useEventById } from '../../../../features/events'
import type { EventFullView } from '../../../../features/events'
import { useWebTenant } from '../../../../features/web-tenant'
import { EditEventForm } from './EditEventForm'

interface EditEventModalProps {
  event: EventFullView | null
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** Toast global — usado p/ notificar inscritos após edição de evento confirmado. */
  onNotify?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void
}

/**
 * Drawer de edição de evento (web/admin). Busca o evento COMPLETO (com
 * equipamentos reais via `getEventById`) e inicializa o `EditEventForm` a partir
 * dele. Salva real via `admin_update_event` (sem mock/localStorage).
 */
export function EditEventModal({ event, open, onClose, onSaved, onNotify }: EditEventModalProps) {
  const { tenant } = useWebTenant()
  const { data: full, loading } = useEventById(open && event ? event.id_event : undefined, tenant)
  const { data: catalog } = useEquipment(tenant)

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
            onNotify={onNotify}
          />
        )}
      </div>
    </div>
  )
}
