import { useState } from 'react'
import { MaterialIcon } from '../../../../shared/components/MaterialIcon'
import { BannerUploadField } from '../../../../shared/components/BannerUploadField'
import type { Equipment } from '../../../../features/equipment'
import type { EventRequestFlowInput } from '../../../../features/events'

interface RequestEventFormProps {
  equipment: Equipment[]
  submitting: boolean
  error?: Error | null
  /** Identidade real do líder (contexto de sessão). */
  leaderUserId: string | null
  tenantId: string | null
  onSubmit: (input: EventRequestFlowInput) => void
  onCancel: () => void
}

const fieldLabel = 'text-[13px] font-bold text-[#2a2a2a]'
const textInput =
  'h-[44px] w-full rounded-[8px] border-[1.5px] border-[#e1e7ee] px-3 text-[14px] text-[#2a2a2a] outline-none focus:border-[#1e558b]'

/**
 * Formulário de solicitação de evento em página única, seguindo o guia
 * "SASI Eventos Mobile". Mantém o contrato de `onSubmit`
 * (event + slot + equipment) da camada de dados.
 */
export function RequestEventForm({
  equipment,
  submitting,
  error,
  leaderUserId,
  tenantId,
  onSubmit,
  onCancel,
}: RequestEventFormProps) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [capacity, setCapacity] = useState('')
  const [description, setDescription] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [equipIds, setEquipIds] = useState<string[]>([])
  const [equipOpen, setEquipOpen] = useState(false)

  const hasIdentity = Boolean(leaderUserId && tenantId)
  const capacityNum = Number(capacity)
  const canSubmit =
    title.trim().length > 0 &&
    Boolean(date) &&
    Boolean(time) &&
    location.trim().length > 0 &&
    capacityNum > 0

  const toggleEquip = (id: string) =>
    setEquipIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const nameOf = (id: string) => equipment.find((e) => e.id === id)?.name ?? id

  const handleSubmit = () => {
    if (!canSubmit || !leaderUserId || !tenantId) return
    const requested_at = new Date(`${date}T${time}`).toISOString()
    onSubmit({
      event: {
        id_tenant: tenantId,
        id_user: leaderUserId,
        title: title.trim(),
        location: location.trim(),
        description: description.trim(),
        banner_url: bannerUrl.trim() || null,
      },
      slot: { capacity: capacityNum, requested_at },
      equipment: equipIds.map((id) => ({ id_equipment: id, quantity: 1 })),
    })
  }

  return (
    <section className="flex flex-col gap-[14px] rounded-[12px] bg-white p-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
      <span className="text-[18px] font-bold text-[#0f3255]">Solicitar Evento</span>

      {/* Banner — input de arquivo real: no celular abre Galeria/Câmera/Arquivos */}
      <div className="flex flex-col gap-[6px]">
        <span className={fieldLabel}>Banner</span>
        <BannerUploadField value={bannerUrl || null} onChange={(b) => setBannerUrl(b ?? '')} />
      </div>

      {/* Nome */}
      <div className="flex flex-col gap-[6px]">
        <span className={fieldLabel}>Nome do Evento</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Insira o Nome do Evento"
          className={textInput}
        />
      </div>

      {/* Dia */}
      <div className="flex flex-col gap-[6px]">
        <span className={fieldLabel}>Dia</span>
        <div className="flex h-[44px] flex-row items-center gap-2 rounded-[8px] border-[1.5px] border-[#e1e7ee] px-3 focus-within:border-[#1e558b]">
          <MaterialIcon name="calendar_today" size={18} className="shrink-0 text-[#1e558b]" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 bg-transparent text-[14px] text-[#2a2a2a] outline-none"
          />
        </div>
      </div>

      {/* Hora */}
      <div className="flex flex-col gap-[6px]">
        <span className={fieldLabel}>Hora</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={textInput} />
      </div>

      {/* Local */}
      <div className="flex flex-col gap-[6px]">
        <span className={fieldLabel}>Local</span>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Insira o Local"
          className={textInput}
        />
      </div>

      {/* Vagas */}
      <div className="flex flex-col gap-[6px]">
        <span className={fieldLabel}>Vagas</span>
        <input
          inputMode="numeric"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ''))}
          placeholder="Insira as vagas"
          className={textInput}
        />
      </div>

      {/* Equipamentos */}
      <div className="flex flex-col gap-[6px]">
        <span className={fieldLabel}>Equipamentos</span>
        <button
          type="button"
          onClick={() => setEquipOpen((v) => !v)}
          className="flex min-h-[44px] flex-row items-center justify-between gap-2 rounded-[8px] border-[1.5px] border-[#e1e7ee] px-3 py-[7px] text-left"
        >
          <span className="flex flex-1 flex-row flex-wrap items-center gap-[6px]">
            {equipIds.length === 0 ? (
              <span className="text-[14px] text-[#bdbdbd]">Selecione os equipamentos</span>
            ) : (
              equipIds.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-[6px] rounded-[5px] bg-[#1e558b] py-[3px] pl-[9px] pr-[6px] text-[13px] font-medium text-white"
                >
                  {nameOf(id)}
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleEquip(id)
                    }}
                    className="cursor-pointer text-[16px] leading-none opacity-85"
                  >
                    ×
                  </span>
                </span>
              ))
            )}
          </span>
          <MaterialIcon name="expand_more" size={20} className="shrink-0 text-[#919191]" />
        </button>

        {equipOpen && (
          <div className="overflow-hidden rounded-[8px] border-[1.5px] border-[#e1e7ee]">
            {equipment.length === 0 ? (
              <p className="px-3 py-3 text-[14px] text-[#919191]">Nenhum equipamento disponível.</p>
            ) : (
              equipment.map((eq) => {
                const selected = equipIds.includes(eq.id)
                return (
                  <button
                    key={eq.id}
                    type="button"
                    onClick={() => toggleEquip(eq.id)}
                    className="flex w-full flex-row items-center gap-[10px] border-b border-[#f0f2f5] px-3 py-[11px] text-left last:border-b-0"
                  >
                    <span
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-2"
                      style={{
                        borderColor: selected ? '#1e558b' : '#919191',
                        background: selected ? '#1e558b' : 'transparent',
                      }}
                    >
                      {selected && <MaterialIcon name="check" size={14} className="text-white" />}
                    </span>
                    <span className="text-[14px] text-[#2a2a2a]">{eq.name}</span>
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Descrição */}
      <div className="flex flex-col gap-[6px]">
        <span className={fieldLabel}>Descrição</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Insira a descrição do evento"
          className="h-[110px] w-full resize-none rounded-[8px] border-[1.5px] border-[#e1e7ee] px-3 py-[10px] text-[14px] text-[#2a2a2a] outline-none focus:border-[#1e558b]"
        />
      </div>

      {error && <p className="text-[13px] text-[#eb5757]">Não foi possível solicitar o evento.</p>}
      {!hasIdentity && (
        <p className="text-[13px] text-[#eb5757]">Sessão inválida: faça login como líder para solicitar.</p>
      )}

      <div className="mt-1 flex flex-row gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-[46px] flex-1 rounded-[8px] border-[1.5px] border-[#1e558b] bg-white text-[15px] font-bold text-[#1e558b]"
        >
          Voltar
        </button>
        <button
          type="button"
          disabled={!canSubmit || submitting || !hasIdentity}
          onClick={handleSubmit}
          className="h-[46px] flex-1 rounded-[8px] text-[15px] font-bold text-white"
          style={{ background: canSubmit && !submitting && hasIdentity ? '#1e558b' : '#c9cdd3' }}
        >
          {submitting ? 'Enviando...' : 'Solicitar'}
        </button>
      </div>
    </section>
  )
}
