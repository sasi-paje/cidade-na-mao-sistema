import { MaterialIcon } from '../../../../shared/components/MaterialIcon'

interface EquipmentPaginationProps {
  page: number
  totalPages: number
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
  onLast: () => void
}

const btnClass =
  'flex h-8 w-8 items-center justify-center rounded-[6px] border border-[#bdcde8] text-[#1e558b] disabled:opacity-40 disabled:cursor-not-allowed'

export function EquipmentPagination({
  page,
  totalPages,
  onFirst,
  onPrev,
  onNext,
  onLast,
}: EquipmentPaginationProps) {
  const isFirst = page <= 1
  const isLast = page >= totalPages

  return (
    <div className="flex items-center gap-1">
      <button type="button" className={btnClass} onClick={onFirst} disabled={isFirst} aria-label="Primeira página">
        <MaterialIcon name="keyboard_double_arrow_left" size={18} />
      </button>
      <button type="button" className={btnClass} onClick={onPrev} disabled={isFirst} aria-label="Página anterior">
        <MaterialIcon name="chevron_left" size={18} />
      </button>
      <span className="min-w-[72px] text-center text-[13px] text-[#4c4c4c]">
        {page} de {totalPages}
      </span>
      <button type="button" className={btnClass} onClick={onNext} disabled={isLast} aria-label="Próxima página">
        <MaterialIcon name="chevron_right" size={18} />
      </button>
      <button type="button" className={btnClass} onClick={onLast} disabled={isLast} aria-label="Última página">
        <MaterialIcon name="keyboard_double_arrow_right" size={18} />
      </button>
    </div>
  )
}
