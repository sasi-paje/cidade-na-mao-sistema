import type { SlotStatusCode } from '../../../../features/event-slots'

interface StatusMeta {
  label: string
  /** Cor do indicador (dot) e do pill sólido. */
  color: string
  /** Cor do texto sobre o pill sólido. */
  solidText: string
}

const SLOT_STATUS_META: Record<SlotStatusCode, StatusMeta> = {
  pending: { label: 'Aguardando aprovação', color: '#F59E0B', solidText: '#0F3255' },
  counter_proposed: { label: 'Nova data sugerida', color: '#F59E0B', solidText: '#0F3255' },
  approved: { label: 'Aprovado', color: '#1F9D57', solidText: '#FFFFFF' },
  rejected: { label: 'Reprovado', color: '#EB5757', solidText: '#FFFFFF' },
  inactive: { label: 'Inativo', color: '#919191', solidText: '#FFFFFF' },
}

export function getSlotStatusMeta(status: SlotStatusCode): StatusMeta {
  return SLOT_STATUS_META[status]
}

interface EventRequestStatusBadgeProps {
  status: SlotStatusCode
  /** 'pill' = sólido (cards sobre banner); 'dot' = indicador + rótulo (detalhe). */
  variant?: 'pill' | 'dot'
}

/** Indicador de status da solicitação (guia "SASI Eventos Mobile"). */
export function EventRequestStatusBadge({ status, variant = 'pill' }: EventRequestStatusBadgeProps) {
  const meta = SLOT_STATUS_META[status]

  if (variant === 'dot') {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="h-[10px] w-[10px] shrink-0 rounded-full" style={{ background: meta.color }} />
        <span className="text-[14px] text-[#2a2a2a]">{meta.label}</span>
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-[6px] rounded-full py-[3px] pl-[10px] pr-3 text-[12px] font-bold"
      style={{ background: meta.color, color: meta.solidText }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: meta.solidText }} />
      {meta.label}
    </span>
  )
}
