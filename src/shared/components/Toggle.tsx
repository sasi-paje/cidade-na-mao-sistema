import { useEffect, useState } from 'react'

interface ToggleProps {
  label?: string
  checked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

const SECONDARY = '#e67c26'
const GREY_LIGHTER = '#bdbdbd'

export const Toggle = ({
  label = '',
  checked,
  onChange,
  disabled = false,
  className = '',
}: ToggleProps) => {
  const isControlled = checked !== undefined
  const [internalChecked, setInternalChecked] = useState(false)

  useEffect(() => {
    if (isControlled) {
      setInternalChecked(checked)
    }
  }, [checked, isControlled])

  const isOn = isControlled ? checked : internalChecked

  const handleToggle = () => {
    if (disabled) return

    const newValue = !isOn

    if (!isControlled) {
      setInternalChecked(newValue)
    }

    onChange?.(newValue)
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      role="switch"
      aria-checked={isOn}
      disabled={disabled}
      className={[
        'inline-flex h-[25px] items-center gap-[8px]',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      ].join(' ')}
    >
      <div className="relative h-[25px] w-[44px]">
        {/* Track */}
        <div
          className="absolute left-0 top-1/2 h-[14px] w-[44px] -translate-y-1/2 rounded-full"
          style={{ backgroundColor: GREY_LIGHTER }}
        />

        {/* Thumb */}
        <div
          className="absolute top-1/2 h-[22px] w-[22px] -translate-y-1/2 rounded-full transition-all duration-200"
          style={{
            left: isOn ? '22px' : '0px',
            backgroundColor: SECONDARY,
          }}
        />
      </div>

      {label && (
        <span
          className={`whitespace-nowrap text-[14px] ${isOn ? 'font-bold' : 'font-normal'}`}
          style={{ fontFamily: 'Inter, sans-serif', color: isOn ? '#2a2a2a' : GREY_LIGHTER }}
        >
          {label}
        </span>
      )}
    </button>
  )
}