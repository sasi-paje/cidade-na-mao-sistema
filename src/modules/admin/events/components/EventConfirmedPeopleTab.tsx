import { MaterialIcon } from '../../../../shared/components/MaterialIcon'
import { formatEventDateTime } from '../../../../utils/eventDate'
import type { EventFullView } from '../../../../features/events'
import { useConfirmedPeople, type ConfirmedPerson } from '../../../../features/event-attendance'

interface EventConfirmedPeopleTabProps {
  event: EventFullView
}

/** CSV apenas com dados reais (sem nomes/e-mails fictícios). */
function buildCsv(people: ConfirmedPerson[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const header = ['Nome', 'Email', 'Status', 'Confirmado em'].join(',')
  const rows = people.map((p) =>
    [esc(p.name), esc(p.email ?? ''), esc(p.status), esc(p.confirmed_at ?? '')].join(','),
  )
  return [header, ...rows].join('\n')
}

export function EventConfirmedPeopleTab({ event }: EventConfirmedPeopleTabProps) {
  const { data: people, loading, error } = useConfirmedPeople(event.id_event, event.id_slot)

  const handleDownload = () => {
    if (people.length === 0) return
    const csv = buildCsv(people)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pessoas-confirmadas-${event.id_event}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[14px] text-[#4c4c4c]">
          <MaterialIcon name="groups" size={20} className="text-[#1e558b]" />
          <span>{people.length} pessoa(s) confirmada(s)</span>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={people.length === 0}
          className="flex h-9 items-center gap-1 rounded-[6px] border border-[#1e558b] px-3 text-[13px] font-semibold text-[#1e558b] disabled:opacity-40"
        >
          <MaterialIcon name="download" size={18} />
          Baixar relação
        </button>
      </div>

      {loading && <p className="py-8 text-center text-[14px] text-[#919191]">Carregando pessoas confirmadas...</p>}

      {!loading && error && (
        <p className="py-8 text-center text-[14px] text-[#eb5757]">
          Não foi possível carregar as pessoas confirmadas.
        </p>
      )}

      {!loading && !error && people.length === 0 && (
        <p className="py-8 text-center text-[14px] text-[#919191]">Nenhuma pessoa confirmada até o momento.</p>
      )}

      {!loading && !error && people.length > 0 && (
        <div>
          <div className="grid grid-cols-[1.2fr_1.4fr_1fr] gap-2 border-b border-[#e2e8f0] pb-2 text-[13px] font-semibold text-[#0f3255]">
            <span>Nome</span>
            <span>Email</span>
            <span>Confirmado em</span>
          </div>
          {people.map((person) => (
            <div
              key={person.id}
              className="grid grid-cols-[1.2fr_1.4fr_1fr] gap-2 border-b border-[#e2e8f0] py-2.5 text-[14px] text-[#2a2a2a]"
            >
              <span className="truncate">{person.name}</span>
              <span className="truncate text-[#4c4c4c]">{person.email ?? '—'}</span>
              <span className="truncate text-[#4c4c4c]">{formatEventDateTime(person.confirmed_at) || '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
