import { useMemo, useState } from 'react'
import { useAllEquipment } from '../../../../features/equipment'
import { useWebTenant } from '../../../../features/web-tenant'
import type { Equipment } from '../../../../features/equipment'
import { EquipmentToolbar } from '../components/EquipmentToolbar'
import { EquipmentPagination } from '../components/EquipmentPagination'
import { EquipmentTable } from '../components/EquipmentTable'
import { CreateEquipmentModal } from '../components/CreateEquipmentModal'
import { EquipmentDetailsModal } from '../components/EquipmentDetailsModal'

const PAGE_SIZE = 10

/** `/web/equipamentos` — gestão de equipamentos (admin). */
export function WebEquipmentPage() {
  const { tenant } = useWebTenant()
  const { data: all, loading, error, refetch } = useAllEquipment(tenant)

  const [search, setSearch] = useState('')
  const [onlyInactive, setOnlyInactive] = useState(false)
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selected, setSelected] = useState<Equipment | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all
      .filter((e) => (q ? e.name.toLowerCase().includes(q) : true))
      .filter((e) => (onlyInactive ? !e.is_active : true))
  }, [all, search, onlyInactive])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }
  const handleToggleInactive = (value: boolean) => {
    setOnlyInactive(value)
    setPage(1)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
      <EquipmentToolbar
        search={search}
        onSearchChange={handleSearchChange}
        onSearchSubmit={() => { /* filtro em tempo real */ }}
        onCalendar={() => setNotice('Filtro por data será definido em breve.')}
        onlyInactive={onlyInactive}
        onToggleInactive={handleToggleInactive}
        onAddNew={() => setIsCreateOpen(true)}
        pagination={
          <EquipmentPagination
            page={currentPage}
            totalPages={totalPages}
            onFirst={() => setPage(1)}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            onLast={() => setPage(totalPages)}
          />
        }
      />

      </div>

      <section className="mt-5 flex-1 overflow-y-auto">
        {loading && <p className="py-10 text-center text-[14px] text-[#919191]">Carregando equipamentos...</p>}
        {error && (
          <p className="py-10 text-center text-[14px] text-[#eb5757]">Não foi possível carregar os equipamentos.</p>
        )}
        {!loading && !error && <EquipmentTable items={pageItems} onOpenDetails={setSelected} />}
      </section>

      <CreateEquipmentModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSaved={() => { void refetch() }}
      />

      <EquipmentDetailsModal
        key={selected?.id ?? 'none'}
        equipment={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        onSaved={() => { void refetch() }}
      />

      {notice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setNotice(null)}
        >
          <div className="w-full max-w-md rounded-[8px] bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] text-[#0f3255]">{notice}</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="h-[40px] rounded-[6px] bg-[#1e558b] px-5 text-[14px] font-semibold text-white"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
