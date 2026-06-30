import { useState, useEffect, useRef } from 'react'
import { AppIcon } from './AppIcon'

interface FormDropdownProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange?: (value: string) => void
  optional?: boolean
  readOnly?: boolean
}

const PRIMARY_DARK = '#0f3255'
const TEXT_COLOR = '#2a2a2a'

export const FormDropdown = ({
  label,
  value,
  options,
  onChange,
  optional = false,
  readOnly = false,
}: FormDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleSelect = (optionValue: string) => {
    if (!readOnly && onChange) {
      onChange(optionValue)
      setIsOpen(false)
    }
  }

  const selectedOption = options.find(opt => opt.value === value)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div className="flex flex-col gap-[8px] w-full" ref={containerRef}>
      <label
        className="font-semibold text-[14px]"
        style={{ fontFamily: 'Inter, sans-serif', color: PRIMARY_DARK }}
      >
        {label}
        {optional && <span style={{ color: '#919191' }}> (Opcional)</span>}
      </label>
      <div className="relative">
        <div
          className={`flex h-[45px] items-center px-[16px] py-[12px] bg-white border rounded-[5px] w-full ${readOnly ? 'border-transparent cursor-default' : 'border-[#0f3255] cursor-pointer'}`}
          onClick={() => !readOnly && setIsOpen(!isOpen)}
          data-name="Input"
        >
          <div className="flex flex-[1_0_0] items-center gap-[4px]">
            <span
              className="font-normal text-[14px]"
              style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontStyle: 'normal', fontWeight: 400, color: readOnly ? TEXT_COLOR : (value ? TEXT_COLOR : '#919191'), lineHeight: '24px' }}
            >
              {selectedOption?.label || value || 'Selecione...'}
            </span>
          </div>
          {!readOnly && (
            <div className="flex items-center justify-center w-[24px] h-[24px]">
              <AppIcon name="keyboard_arrow_down" size={14} color={PRIMARY_DARK} />
            </div>
          )}
        </div>
        {isOpen && !readOnly && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#0f3255] rounded-[5px] z-50 max-h-[200px] overflow-auto">
            {options.map((option) => (
              <div
                key={option.value}
                className="flex items-center px-[16px] py-[12px] hover:bg-[#f0f0f0] cursor-pointer"
                onClick={() => handleSelect(option.value)}
              >
                <span
                  className="font-normal text-[14px]"
                  style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontStyle: 'normal', fontWeight: 400, color: TEXT_COLOR, lineHeight: '24px' }}
                >
                  {option.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
