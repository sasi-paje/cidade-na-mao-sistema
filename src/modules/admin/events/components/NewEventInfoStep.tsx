import { BannerUploadField } from '../../../../shared/components/BannerUploadField'
import type { NewEventFormData, NewEventFormErrors } from './newEvent.model'

interface NewEventInfoStepProps {
  data: NewEventFormData
  errors: NewEventFormErrors
  onChange: (patch: Partial<NewEventFormData>) => void
}

const labelClass = 'mb-1 block text-[13px] font-semibold text-[#0f3255]'
const baseInput =
  'h-[45px] w-full rounded-[5px] border px-3 text-[14px] text-[#0f3255] outline-none focus:border-[#1e558b] placeholder:text-[#919191]'

function inputClass(hasError?: boolean): string {
  return `${baseInput} ${hasError ? 'border-[#eb5757]' : 'border-[#0f3255]'}`
}

export function NewEventInfoStep({ data, errors, onChange }: NewEventInfoStepProps) {
  return (
    <div>
      <h2 className="mb-3 text-[16px] font-bold text-[#2a2a2a]">Informações do evento</h2>

      {/* Banner */}
      <div className="mb-4">
        <span className={labelClass}>Banner</span>
        <BannerUploadField
          value={data.banner}
          error={errors.banner}
          onChange={(banner) => onChange({ banner })}
        />
      </div>

      {/* Nome */}
      <div className="mb-4">
        <label className={labelClass}>Nome do Evento</label>
        <input
          className={inputClass(errors.name)}
          placeholder="Insira o Nome do Evento"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      {/* Dia + Hora */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Dia</label>
          <input
            type="date"
            className={inputClass(errors.day)}
            value={data.day}
            onChange={(e) => onChange({ day: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Hora</label>
          <input
            type="time"
            className={inputClass(errors.time)}
            value={data.time}
            onChange={(e) => onChange({ time: e.target.value })}
          />
        </div>
      </div>

      {/* Local */}
      <div className="mb-4">
        <label className={labelClass}>Local</label>
        <input
          className={inputClass(errors.location)}
          placeholder="Insira o Local"
          value={data.location}
          onChange={(e) => onChange({ location: e.target.value })}
        />
      </div>

      {/* Vagas */}
      <div className="mb-4">
        <label className={labelClass}>Vagas</label>
        <input
          type="number"
          min={1}
          className={inputClass(errors.capacity)}
          placeholder="Insira as vagas"
          value={data.capacity}
          onChange={(e) => onChange({ capacity: e.target.value })}
        />
      </div>

      {/* Descrição */}
      <div className="mb-1">
        <label className={labelClass}>Descrição</label>
        <textarea
          className={`min-h-[140px] w-full rounded-[5px] border p-3 text-[14px] text-[#0f3255] outline-none focus:border-[#1e558b] placeholder:text-[#919191] ${
            errors.description ? 'border-[#eb5757]' : 'border-[#0f3255]'
          }`}
          placeholder="Insira a descrição do evento"
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>
    </div>
  )
}
