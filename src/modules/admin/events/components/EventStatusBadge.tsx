import type { SlotStatusCode } from '../../../../features/event-slots'

interface StatusMeta {
  label: string
  className: string
}

const STATUS_META: Record<SlotStatusCode, StatusMeta> = {
  pending: { label: 'Pendente', className: 'bg-[#fdf3d8] text-[#8a6d1b]' },
  approved: { label: 'Confirmado', className: 'bg-[#dcf3e4] text-[#1e8449]' },
  counter_proposed: { label: 'Validando nova data', className: 'bg-[#dce8f7] text-[#1e558b]' },
  rejected: { label: 'Reprovado', className: 'bg-[#fbe0e0] text-[#c0392b]' },
  inactive: { label: 'Inativo', className: 'bg-[#ececec] text-[#919191]' },
}

/** Fallback p/ status ausente/desconhecido (ex.: a view devolve null quando o
 *  slot não está em pending/approved/counter_proposed). Evita quebrar a UI. */
const FALLBACK_META: StatusMeta = { label: '—', className: 'bg-[#ececec] text-[#919191]' }

interface EventStatusBadgeProps {
  status: SlotStatusCode | null | undefined
  /** Quando `false`, mostra "Inativo" independentemente do status do slot. */
  isActive?: boolean
}

export function EventStatusBadge({ status, isActive }: EventStatusBadgeProps) {
  const meta =
    isActive === false ? STATUS_META.inactive : (status && STATUS_META[status]) || FALLBACK_META
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  )
}
