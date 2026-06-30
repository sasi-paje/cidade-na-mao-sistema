interface FormInputProps {
  label: string
  value: string
  placeholder?: string
  optional?: boolean
  readOnly?: boolean
  onChange?: (value: string) => void
  type?: 'text' | 'date' | 'number'
}

const PRIMARY_DARK = '#0f3255'
const TEXT_LIGHT75 = '#2a2a2a'
const TEXT_LIGHT25 = '#919191'

export const FormInput = ({
  label,
  value,
  placeholder = '',
  optional = false,
  readOnly = false,
  onChange,
  type = 'text',
}: FormInputProps) => {
  return (
    <div className="flex flex-col gap-[8px] w-full">
      <div className="flex items-center">
        <label
          className="font-semibold text-[14px]"
          style={{ fontFamily: 'Inter, sans-serif', color: optional ? PRIMARY_DARK : PRIMARY_DARK }}
        >
          {label}
          {optional && (
            <span style={{ color: TEXT_LIGHT25 }}> (Opcional)</span>
          )}
        </label>
      </div>
      <div
        className={`flex h-[45px] items-center px-[16px] py-[12px] bg-white border rounded-[5px] w-full ${
          readOnly ? 'border-transparent' : 'border-[#0f3255]'
        }`}
        data-name="Input"
      >
        <div className="flex flex-[1_0_0] items-center">
          <input
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={(e) => !readOnly && onChange?.(e.target.value)}
            readOnly={readOnly}
            className={type === 'date' ? '' : undefined}
            className={`flex-[1_0_0] font-normal text-[14px] bg-transparent outline-none ${
              readOnly ? 'cursor-not-allowed' : ''
            }`}
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              fontStyle: 'normal',
              fontWeight: 400,
              color: (readOnly || value) ? TEXT_LIGHT75 : TEXT_LIGHT25,
              lineHeight: '24px',
            }}
          />
        </div>
      </div>
    </div>
  )
}