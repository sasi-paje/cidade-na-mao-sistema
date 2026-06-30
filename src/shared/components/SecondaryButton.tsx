import { AppIcon } from './AppIcon'

interface SecondaryButtonProps {
  label: string
  icon?: 'left_panel_close' | 'search' | 'edit' | 'delete_forever' | 'download' | 'add_circle' | 'add_box'
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export const SecondaryButton = ({
  label,
  icon,
  onClick,
  disabled = false,
  className = '',
}: SecondaryButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center justify-center gap-[8px]
        bg-white border border-[#e67c26] h-[45px] px-[8px] py-[2px]
        rounded-[4px]
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {icon && (
        <AppIcon name={icon} size={24} color="#e67c26" className="shrink-0" />
      )}
      <span
        className="font-bold text-[14px] whitespace-nowrap"
        style={{ fontFamily: 'Inter, sans-serif', color: '#e67c26' }}
      >
        {label}
      </span>
    </button>
  )
}