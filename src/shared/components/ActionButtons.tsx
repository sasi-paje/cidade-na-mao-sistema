interface ActionButtonsProps {
  onEdit?: () => void
  onDelete?: () => void
  size?: 'sm' | 'md'
}

export function ActionButtons({ onEdit, onDelete, size = 'md' }: ActionButtonsProps) {
  const iconSize = size === 'sm' ? 16 : 20
  const containerSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'

  return (
    <div className="flex items-center justify-center gap-1">
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className={`flex items-center justify-center ${containerSize} hover:bg-[#f0f0f0] rounded transition-colors`}
        >
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4077d9"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className={`flex items-center justify-center ${containerSize} hover:bg-[#f0f0f0] rounded transition-colors`}
        >
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#eb5757"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}
    </div>
  )
}
