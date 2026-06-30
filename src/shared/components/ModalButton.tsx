/**
 * ModalButton - Botão padronizado para modais
 */

interface ModalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'default' | 'danger' | 'success'
  children: React.ReactNode
}

const VARIANTS = {
  primary: { bg: '#E67C26', border: '#E67C26', color: '#FFFFFF' },
  secondary: { bg: 'transparent', border: '#E67C26', color: '#E67C26' },
  default: { bg: 'white', border: '#E67C26', color: '#E67C26' },
  danger: { bg: '#C7392C', border: '#C7392C', color: '#FFFFFF' },
  success: { bg: '#27AE60', border: '#27AE60', color: '#FFFFFF' },
}

export const ModalButton = ({ variant = 'primary', children, style, ...props }: ModalButtonProps) => {
  const v = VARIANTS[variant]

  return (
    <button
      {...props}
      className={`flex items-center justify-center whitespace-nowrap ${props.className || ''}`}
      style={{
        display: 'flex',
        minWidth: '150px',
        width: 'auto',
        height: '45px',
        padding: '2px 8px',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '10px',
        backgroundColor: v.bg,
        borderWidth: '1px',
        borderColor: props.disabled ? '#999999' : v.border,
        borderStyle: 'solid',
        borderRadius: '4px',
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        fontWeight: 700,
        color: props.disabled ? '#999999' : v.color,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export default ModalButton