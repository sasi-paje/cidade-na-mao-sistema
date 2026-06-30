import { useRef } from 'react'
import { MaterialIcon } from './MaterialIcon'

interface BannerUploadFieldProps {
  value: string | null
  onChange: (base64: string | null) => void
  error?: boolean
}

/**
 * Upload de banner com preview em base64 (sem storage — apenas no estado).
 *
 * Usa `<input type="file" accept="image/*">` sem `capture`: no celular o sistema
 * oferece o menu nativo completo (Galeria / Câmera / Arquivos); no desktop abre
 * o seletor de arquivos. Compartilhado por admin (criar/editar evento) e líder
 * (solicitar evento).
 */
export function BannerUploadField({ value, onChange, error = false }: BannerUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') onChange(reader.result)
    }
    reader.readAsDataURL(file)
  }

  if (value) {
    return (
      <div className="relative w-full overflow-hidden rounded-[5px] border border-[#0f3255]">
        <div className="aspect-[16/9] w-full bg-[#bdcde8]">
          <img src={value} alt="Banner do evento" className="h-full w-full object-cover" />
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Remover imagem"
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#c0392b] shadow-sm"
        >
          <MaterialIcon name="close" size={18} />
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={[
          'flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-[5px] border border-dashed text-[#1e558b]',
          error ? 'border-[#eb5757] bg-[#fff6f6]' : 'border-[#0f3255]',
        ].join(' ')}
      >
        <MaterialIcon name="attach_file" size={28} />
        <span className="text-[13px] font-semibold">Clique para anexar foto</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </>
  )
}
