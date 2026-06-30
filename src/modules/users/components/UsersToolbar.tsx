import { useState, useEffect, useRef } from 'react'
import { AppIcon, FormDropdown } from '../../../shared/components'
import { supabase, getEnvironment } from '../../../lib/supabase'
import { fetchActivePermissions } from '../../../features/roles/api/role-permissions.service'
import { fetchAvailablePages } from '../../../features/users/api/user-pages.service'

export interface UserFilterData {
  ordenar: string
  cargo: string
  pagina: string
  acao: string
}

export const EMPTY_USER_FILTERS: UserFilterData = {
  ordenar: 'recentes',
  cargo: '',
  pagina: '',
  acao: '',
}

interface UsersToolbarProps {
  onSearch?: (term: string) => void
  onAddNew?: () => void
  onFilter?: (filters: UserFilterData) => void
  initialSearch?: string
}

const PRIMARY_DARK = '#0f3255'
const ORANGE = '#e67c26'

export const UsersToolbar = ({
  onSearch,
  onAddNew,
  onFilter,
  initialSearch = '',
}: UsersToolbarProps) => {
  const [searchValue, setSearchValue] = useState(initialSearch)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<UserFilterData>(EMPTY_USER_FILTERS)
  const filterWrapperRef = useRef<HTMLDivElement>(null)

  const [cargoOptions, setCargoOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: 'Selecione o cargo' },
  ])
  const [paginaOptions, setPaginaOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: 'Selecione a página' },
  ])
  const [acaoOptions, setAcaoOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: 'Selecione a ação' },
  ])

  useEffect(() => {
    const loadRefData = async () => {
      const isTest = getEnvironment() !== 'production'
      try {
        const [cargosRes, paginas, acoes] = await Promise.all([
          supabase
            .from('master_user_role')
            .select('id, name')
            .eq('is_test', isTest)
            .eq('is_active', true)
            .order('name', { ascending: true }),
          fetchAvailablePages(),
          fetchActivePermissions(),
        ])

        setCargoOptions([
          { value: '', label: 'Selecione o cargo' },
          ...(cargosRes.data || []).map(r => ({ value: String(r.id), label: r.name })),
        ])
        setPaginaOptions([
          { value: '', label: 'Selecione a página' },
          ...paginas.map(r => ({ value: String(r.id), label: r.name })),
        ])
        setAcaoOptions([
          { value: '', label: 'Selecione a ação' },
          ...acoes.map(r => ({ value: String(r.id), label: r.name })),
        ])
      } catch (err) {
        console.error('[UsersToolbar] Error loading ref data:', err)
      }
    }
    loadRefData()
  }, [])

  useEffect(() => {
    if (!showFilters) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowFilters(false)
    }
    const handleClickOutside = (e: MouseEvent) => {
      if (filterWrapperRef.current && !filterWrapperRef.current.contains(e.target as Node)) {
        setShowFilters(false)
      }
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showFilters])

  const handleSearch = () => onSearch?.(searchValue)

  const set = (field: keyof UserFilterData) => (value: string) =>
    setFilters(prev => ({ ...prev, [field]: value }))

  const handleClearFilters = () => {
    setFilters(EMPTY_USER_FILTERS)
    onFilter?.(EMPTY_USER_FILTERS)
  }

  const handleApplyFilters = () => {
    onFilter?.(filters)
    setShowFilters(false)
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative w-[526px]">
          <input
            type="text"
            placeholder="Busque por um Usuário..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full h-[40px] px-3 pr-12 border border-[#bdbdbd] rounded-[5px] bg-[#f9f9f9] text-[14px] font-normal"
            style={{ fontFamily: 'Inter, sans-serif' }}
          />
          <button
            type="button"
            onClick={handleSearch}
            className="absolute right-0 top-0 h-full px-3 bg-[#e67c26] rounded-br-[4px] rounded-tr-[4px] flex items-center justify-center"
          >
            <AppIcon name="search" size={20} color="white" />
          </button>
        </div>

        {/* Filter Button + Popup */}
        <div className="relative" ref={filterWrapperRef}>
          <button
            type="button"
            onClick={() => setShowFilters(prev => !prev)}
            className="w-[40px] h-[40px] border border-[#e67c26] rounded-[5px] flex items-center justify-center bg-white"
            aria-label="Filtros avançados"
          >
            <AppIcon name="filter_alt" size={20} color={ORANGE} />
          </button>

          {showFilters && (
            <div
              className="absolute top-full left-0 mt-2 z-[9999] flex flex-col bg-white border border-[#bdbdbd] rounded-[5px] shadow-lg"
              style={{ width: 'min(560px, calc(100vw - 32px))' }}
            >
              {/* Ordenação */}
              <div className="p-4">
                <span
                  className="font-semibold text-[14px] mb-2 block"
                  style={{ fontFamily: 'Inter, sans-serif', color: PRIMARY_DARK }}
                >
                  Ordenação
                </span>
                <div className="flex">
                  <button
                    type="button"
                    onClick={() => set('ordenar')('recentes')}
                    className="flex-1 flex items-center justify-center rounded-l-[4px] font-bold text-[12px] h-[38px]"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      backgroundColor: filters.ordenar === 'recentes' ? '#FFF9F4' : 'white',
                      color: filters.ordenar === 'recentes' ? ORANGE : '#999999',
                      border: `1px solid ${filters.ordenar === 'recentes' ? ORANGE : '#cccccc'}`,
                    }}
                  >
                    Mais Recentes Primeiro
                  </button>
                  <button
                    type="button"
                    onClick={() => set('ordenar')('antigos')}
                    className="flex-1 flex items-center justify-center rounded-r-[4px] font-bold text-[12px] h-[38px]"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      backgroundColor: filters.ordenar === 'antigos' ? '#FFF9F4' : 'white',
                      color: filters.ordenar === 'antigos' ? ORANGE : '#999999',
                      border: `1px solid ${filters.ordenar === 'antigos' ? ORANGE : '#cccccc'}`,
                    }}
                  >
                    Mais Antigos Primeiro
                  </button>
                </div>
              </div>

              {/* Fields */}
              <div className="flex flex-col gap-[16px] px-4 pb-4">
                <FormDropdown
                  label="Cargo"
                  value={filters.cargo}
                  options={cargoOptions}
                  onChange={set('cargo')}
                />

                <div className="flex gap-[16px]">
                  <div className="flex-1">
                    <FormDropdown
                      label="Página com acesso"
                      value={filters.pagina}
                      options={paginaOptions}
                      onChange={set('pagina')}
                    />
                  </div>
                  <div className="flex-1">
                    <FormDropdown
                      label="Ação herdada do cargo"
                      value={filters.acao}
                      options={acaoOptions}
                      onChange={set('acao')}
                    />
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="flex justify-between px-4 pb-4">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="flex items-center justify-center rounded-[4px] border border-[#e67c26] bg-white w-[150px] h-[45px]"
                >
                  <span
                    className="font-bold text-[13px]"
                    style={{ fontFamily: 'Inter, sans-serif', color: ORANGE }}
                  >
                    Limpar Filtro
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className="flex items-center justify-center rounded-[4px] bg-[#e67c26] w-[150px] h-[45px]"
                >
                  <span
                    className="font-bold text-[13px]"
                    style={{ fontFamily: 'Inter, sans-serif', color: 'white' }}
                  >
                    Filtrar
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Button */}
      <button
        type="button"
        onClick={onAddNew}
        className="h-[45px] px-4 bg-[#e67c26] rounded-[4px] flex items-center gap-2"
      >
        <AppIcon name="add_box" size={20} color="white" />
        <span className="font-bold text-[14px] text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
          Adicionar Novo
        </span>
      </button>
    </div>
  )
}
