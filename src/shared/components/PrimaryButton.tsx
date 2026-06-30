import { AppIcon } from './AppIcon'

interface PrimaryButtonProps {
  label: string
  icon?: 'add_circle' | 'add_box' | 'search' | 'edit' | 'delete_forever' | 'download'
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export const PrimaryButton = ({
  label,
  icon,
  onClick,
  disabled = false,
  className = '',
}: PrimaryButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center justify-center gap-[10px]
        bg-[#e67c26] h-[45px] px-[8px] py-[2px]
        rounded-[4px] w-[150px]
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {icon && (
        <AppIcon name={icon} size={24} color="#ffffff" className="shrink-0" />
      )}
      <span
        className="font-bold text-[14px] text-white whitespace-nowrap"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        {label}
      </span>
    </button>
  )
}