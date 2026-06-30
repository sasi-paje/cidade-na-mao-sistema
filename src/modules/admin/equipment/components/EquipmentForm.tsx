import type { EquipmentFormData, EquipmentFormErrors } from './equipmentForm.model'

interface EquipmentFormProps {
  data: EquipmentFormData
  errors: EquipmentFormErrors
  onChange: (patch: Partial<EquipmentFormData>) => void
}

const label = 'mb-1 block text-[13px] font-semibold text-[#0f3255]'
const baseInput =
  'h-[45px] w-full rounded-[5px] border px-3 text-[14px] text-[#0f3255] outline-none focus:border-[#1e558b] placeholder:text-[#919191]'

function inputClass(hasError?: boolean): string {
  return `${baseInput} ${hasError ? 'border-[#eb5757]' : 'border-[#0f3255]'}`
}

export function EquipmentForm({ data, errors, onChange }: EquipmentFormProps) {
  return (
    <div>
      <h2 className="mb-3 text-[16px] font-bold text-[#2a2a2a]">Informações do equipamento</h2>

      <div className="mb-4">
        <label className={label}>Nome do Equipamento</label>
        <input
          className={inputClass(errors.name)}
          placeholder="Insira o Nome do Equipamento"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div className="mb-4">
        <label className={label}>Quantidade</label>
        <input
          type="number"
          min={0}
          className={inputClass(errors.quantity)}
          placeholder="Insira a quantidade"
          value={data.quantity}
          onChange={(e) => onChange({ quantity: e.target.value })}
        />
      </div>

      <div>
        <label className={label}>Descrição</label>
        <textarea
          className={`min-h-[150px] w-full rounded-[5px] border p-3 text-[14px] text-[#0f3255] outline-none focus:border-[#1e558b] placeholder:text-[#919191] ${
            errors.description ? 'border-[#eb5757]' : 'border-[#0f3255]'
          }`}
          placeholder="Insira a descrição do equipamento"
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>
    </div>
  )
}
