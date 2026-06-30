import { AppIcon } from './AppIcon'

interface PaginationProps {
  currentPage?: number
  totalPages?: number
  onPageChange?: (page: number) => void
}

// Figma Design Tokens
const PRIMARY_DARK = '#0F3255'
const BORDER_COLOR = '#E0E0E0'

interface ArrowButtonProps {
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
}

const ArrowButton = ({ onClick, disabled = false, children }: ArrowButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center justify-center transition-opacity hover:opacity-60 disabled:cursor-not-allowed disabled:opacity-30"
    style={{ width: '32px', height: '32px' }}
  >
    <span style={{ color: PRIMARY_DARK }}>
      {children}
    </span>
  </button>
)

export const Pagination = ({
  currentPage = 1,
  totalPages = 20,
  onPageChange,
}: PaginationProps) => {
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages)

  const handleFirst = () => onPageChange?.(1)
  const handlePrev = () => onPageChange?.(Math.max(1, safeCurrentPage - 1))
  const handleNext = () => onPageChange?.(Math.min(totalPages, safeCurrentPage + 1))
  const handleLast = () => onPageChange?.(totalPages)

  const isFirstPage = safeCurrentPage === 1
  const isLastPage = safeCurrentPage === totalPages

  return (
    <div
      className="inline-flex items-center gap-1 whitespace-nowrap"
      style={{ padding: '8px 0' }}
    >
      <ArrowButton onClick={handleFirst} disabled={isFirstPage}>
        <AppIcon name="chevrons_left" size={18} color={PRIMARY_DARK} />
      </ArrowButton>

      <ArrowButton onClick={handlePrev} disabled={isFirstPage}>
        <AppIcon name="chevron_left" size={18} color={PRIMARY_DARK} />
      </ArrowButton>

      <div className="inline-flex items-center gap-2 px-2">
        {/* Current page input - Figma: small box */}
        <div
          className="inline-flex items-center justify-center rounded border"
          style={{
            minWidth: '40px',
            height: '32px',
            padding: '0 8px',
            borderColor: BORDER_COLOR,
          }}
        >
          <span
            className="text-center text-[13px] font-medium"
            style={{ fontFamily: 'Inter, sans-serif', color: PRIMARY_DARK }}
          >
            {safeCurrentPage}
          </span>
        </div>

        <span
          className="text-center text-[13px] font-medium whitespace-nowrap"
          style={{ fontFamily: 'Inter, sans-serif', color: PRIMARY_DARK }}
        >
          de {totalPages}
        </span>
      </div>

      <ArrowButton onClick={handleNext} disabled={isLastPage}>
        <AppIcon name="chevron_right" size={18} color={PRIMARY_DARK} />
      </ArrowButton>

      <ArrowButton onClick={handleLast} disabled={isLastPage}>
        <AppIcon name="chevrons_right" size={18} color={PRIMARY_DARK} />
      </ArrowButton>
    </div>
  )
}