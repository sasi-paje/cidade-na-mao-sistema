import { useState } from 'react'
import { MaterialIcon } from '../../../../shared/components/MaterialIcon'
import type { Equipment } from '../../../../features/equipment'

export interface EquipItem {
  id_equipment: string
  quantity: number
}

interface EditEventEquipmentTabProps {
  items: EquipItem[]
  catalog: Equipment[]
  onChange: (items: EquipItem[]) => void
}

const QUANTITIES = Array.from({ length: 20 }, (_, i) => i + 1)

export function EditEventEquipmentTab({ items, catalog, onChange }: EditEventEquipmentTabProps) {
  const [selectedId, setSelectedId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)

  const nameOf = (id: string) => catalog.find((e) => e.id === id)?.name ?? id

  const handleAdd = () => {
    setFeedback(null)
    if (!selectedId) {
      setFeedback('Selecione um equipamento.')
      return
    }
    const qty = Number(quantity)
    if (!quantity || qty < 1) {
      setFeedback('Informe uma quantidade válida (mínimo 1).')
      return
    }

    const existing = items.find((i) => i.id_equipment === selectedId)
    if (existing) {
      onChange(items.map((i) => (i.id_equipment === selectedId ? { ...i, quantity: qty } : i)))
      setFeedback(`Quantidade de "${nameOf(selectedId)}" atualizada.`)
    } else {
      onChange([...items, { id_equipment: selectedId, quantity: qty }])
    }
    setSelectedId('')
    setQuantity('')
  }

  const handleRemove = (id: string) => {
    onChange(items.filter((i) => i.id_equipment !== id))
  }

  const selectClass =
    'h-[42px] w-full rounded-[5px] border border-[#bdcde8] bg-white px-2 text-[14px] text-[#0f3255] outline-none focus:border-[#1e558b]'

  return (
    <div>
      {/* Linha de adição */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label>
          <span className="mb-1 block text-[13px] font-semibold text-[#0f3255]">Equipamento</span>
          <select className={selectClass} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">Selecione o equipamento</option>
            {catalog.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-[13px] font-semibold text-[#0f3255]">Quantidade</span>
          <select className={selectClass} value={quantity} onChange={(e) => setQuantity(e.target.value)}>
            <option value="">Selecione a quantidade</option>
            {QUANTITIES.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={handleAdd}
          aria-label="Adicionar equipamento"
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#1e558b] text-white"
        >
          <MaterialIcon name="add_circle" size={22} />
        </button>
      </div>

      {feedback && <p className="mt-2 text-[12px] text-[#8a6d1b]">{feedback}</p>}

      {/* Tabela de itens */}
      <div className="mt-4">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 border-b border-[#e2e8f0] pb-2 text-[13px] font-semibold text-[#0f3255]">
          <span>Equipamento</span>
          <span>Quantidade</span>
          <span className="w-10 text-right">Ação</span>
        </div>

        {items.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-[#919191]">Nenhum equipamento solicitado.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id_equipment}
              className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-b border-[#e2e8f0] py-3 text-[14px] text-[#2a2a2a]"
            >
              <span>{nameOf(item.id_equipment)}</span>
              <span>{item.quantity}</span>
              <button
                type="button"
                onClick={() => handleRemove(item.id_equipment)}
                aria-label={`Remover ${nameOf(item.id_equipment)}`}
                className="flex w-10 justify-end text-[#c0392b]"
              >
                <MaterialIcon name="delete" size={20} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
