import { useState, useRef, useEffect } from 'react'
import { AppIcon } from './AppIcon'

interface Option {
  value: string
  label: string
  color?: string
}

interface MultiSelectDropdownProps {
  label: string
  options: Option[]
  selectedOptions: Option[]
  onChange?: (selected: Option[]) => void
  optional?: boolean
}

const PRIMARY_DARK = '#0f3255'
const SECONDARY = '#4077d9'
const TEXT_COLOR = '#2a2a2a'

export const MultiSelectDropdown = ({
  label,
  options,
  selectedOptions,
  onChange,
  optional = false,
}: MultiSelectDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleToggleOption = (option: Option) => {
    if (!onChange) return

    const isSelected = selectedOptions.some(s => s.value === option.value)
    if (isSelected) {
      onChange(selectedOptions.filter(s => s.value !== option.value))
    } else {
      onChange([...selectedOptions, option])
    }
  }

  return (
    <div className="flex flex-col gap-[8px] w-full" ref={containerRef}>
      <label
        className="font-semibold text-[14px]"
        style={{
          fontFamily: 'Inter, sans-serif',
          color: optional ? '#161a36' : PRIMARY_DARK,
          lineHeight: '24px',
        }}
      >
        {label}
        {optional && (
          <span style={{ color: '#919191' }}> (Opcional)</span>
        )}
      </label>
      <div className="relative">
        <div
          className="flex min-h-[45px] px-[16px] py-[8px] bg-white border border-[#0f3255] rounded-[5px] w-full cursor-pointer flex-wrap gap-[8px] items-center"
          onClick={() => setIsOpen(!isOpen)}
          data-name="Input"
        >
          <div className="flex flex-[1_0_0] items-center gap-[8px] flex-wrap">
            {selectedOptions.length === 0 ? (
              <span
                className="font-normal text-[14px]"
                style={{ fontFamily: 'Inter, sans-serif', color: '#919191', lineHeight: '24px' }}
              >
                Selecione...
              </span>
            ) : (
              selectedOptions.map((option, index) => (
                <div
                  key={index}
                  className="flex items-center justify-center px-[8px] rounded-[4px]"
                  style={{ backgroundColor: option.color || SECONDARY }}
                >
                  <span
                    className="font-normal text-[14px] text-white whitespace-nowrap"
                    style={{ fontFamily: 'Inter, sans-serif', lineHeight: '24px' }}
                  >
                    {option.label}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleOption(option)
                    }}
                    className="ml-1 text-white hover:text-gray-200 font-bold"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center justify-center w-[24px] h-[24px]">
            <AppIcon name="keyboard_arrow_down" size={14} color={PRIMARY_DARK} />
          </div>
        </div>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#0f3255] rounded-[5px] z-50 max-h-[200px] overflow-auto">
            {options.map((option) => {
              const isSelected = selectedOptions.some(s => s.value === option.value)
              return (
                <div
                  key={option.value}
                  className="flex items-center px-[16px] py-[12px] hover:bg-[#f0f0f0] cursor-pointer"
                  onClick={() => handleToggleOption(option)}
                >
                  <span
                    className="font-normal text-[14px]"
                    style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontStyle: 'normal', fontWeight: 400, color: TEXT_COLOR, lineHeight: '24px' }}
                  >
                    {option.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}