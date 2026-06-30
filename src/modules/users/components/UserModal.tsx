import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../../../shared/components'
import { supabase, getEnvironment } from '../../../lib/supabase'
import { fetchAvailablePages } from '../../../features/users/api/user-pages.service'

interface UserModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: UserFormData) => Promise<void>
  onEdit?: () => void
  onResendInvite?: () => void
  onInactivate?: () => void
  onActivate?: () => void
  isActing?: boolean
  user?: UserFormData | null
}

export interface UserFormData {
  id?: string
  full_name: string
  email: string
  id_user_role: string
  permissions: string[]
  is_active?: boolean
}

const PRIMARY = '#0f3255'
const HEADER_COLOR = '#161a36'
const LABEL: React.CSSProperties = { fontFamily: 'Inter, sans-serif', color: PRIMARY }
const FF: React.CSSProperties = { fontFamily: 'Inter, sans-serif' }

const inputBase =
  'h-[45px] px-4 border border-[#0f3255] rounded-[5px] text-[14px] outline-none w-full'

export const UserModal = ({
  isOpen,
  onClose,
  onSave,
  onEdit,
  onResendInvite,
  onInactivate,
  onActivate,
  isActing = false,
  user,
}: UserModalProps) => {
  const [formData, setFormData] = useState<UserFormData>({
    full_name: '',
    email: '',
    id_user_role: '',
    permissions: [],
  })
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [availablePages, setAvailablePages] = useState<{ value: string; label: string }[]>([])
  const [rolePermissions, setRolePermissions] = useState<string[]>([])
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const [showPageDropdown, setShowPageDropdown] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'inativar' | 'ativar' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pagesError, setPagesError] = useState<string | null>(null)

  const roleWrapRef = useRef<HTMLDivElement>(null)
  const pageWrapRef = useRef<HTMLDivElement>(null)
  const pageDropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null)

  // ── Reset on open ────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    setFormData(user ?? { full_name: '', email: '', id_user_role: '', permissions: [] })
    setIsEditMode(false)
    setIsSaving(false)
    setError(null)
    setConfirmAction(null)
    setShowRoleDropdown(false)
    setShowPageDropdown(false)
    fetchRoles()
    fetchPages()
  }, [isOpen, user])

  // ── Load cargo permissions when cargo changes ─────────────────
  useEffect(() => {
    if (!formData.id_user_role) {
      setRolePermissions([])
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const { data: permData } = await supabase
          .from('master_user_role_permission')
          .select('permission_id')
          .eq('role_id', formData.id_user_role)
        if (cancelled || !permData?.length) {
          if (!cancelled) setRolePermissions([])
          return
        }
        const ids = permData.map(d => d.permission_id)
        const { data: names } = await supabase
          .from('master_system_permission')
          .select('name')
          .in('id', ids)
          .eq('is_active', true)
          .eq('is_test', false)
          .order('name')
        if (!cancelled) setRolePermissions(names?.map(d => d.name) || [])
      } catch {
        if (!cancelled) setRolePermissions([])
      }
    }
    load()
    return () => { cancelled = true }
  }, [formData.id_user_role])

  // ── ESC closes dropdowns ──────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (showRoleDropdown) { setShowRoleDropdown(false); return }
      if (showPageDropdown) { setShowPageDropdown(false) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, showRoleDropdown, showPageDropdown])

  // ── Click outside closes dropdowns ───────────────────────────
  useEffect(() => {
    if (!showRoleDropdown && !showPageDropdown) return
    const onMouse = (e: MouseEvent) => {
      if (showRoleDropdown && roleWrapRef.current && !roleWrapRef.current.contains(e.target as Node)) {
        setShowRoleDropdown(false)
      }
      if (showPageDropdown) {
        const inTrigger = pageWrapRef.current?.contains(e.target as Node)
        const inDropdown = pageDropdownRef.current?.contains(e.target as Node)
        if (!inTrigger && !inDropdown) setShowPageDropdown(false)
      }
    }
    document.addEventListener('mousedown', onMouse)
    return () => document.removeEventListener('mousedown', onMouse)
  }, [showRoleDropdown, showPageDropdown])

  // ── Data fetchers ─────────────────────────────────────────────
  const fetchRoles = async () => {
    try {
      const isTest = getEnvironment() !== 'production'
      const { data } = await supabase
        .from('master_user_role')
        .select('id, name')
        .eq('is_active', true)
        .eq('is_test', isTest)
        .order('name')
      setRoles((data || []).map(r => ({ id: String(r.id), name: r.name })))
    } catch {
      /* silencia — dropdown fica sem opções */
    }
  }

  const fetchPages = async () => {
    try {
      setPagesError(null)
      const pages = await fetchAvailablePages()
      setAvailablePages(pages.map(p => ({ value: String(p.id), label: p.name })))
    } catch {
      setPagesError('Não foi possível carregar as páginas do sistema.')
      setAvailablePages([])
    }
  }

  // ── Handlers ──────────────────────────────────────────────────
  const handlePageDropdownToggle = () => {
    if (isSaving) return
    if (!showPageDropdown && pageWrapRef.current) {
      const rect = pageWrapRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    setShowPageDropdown(prev => !prev)
  }

  const handleChange = (field: keyof UserFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const togglePage = (pageId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(pageId)
        ? prev.permissions.filter(p => p !== pageId)
        : [...prev.permissions, pageId],
    }))
  }

  const handleSubmit = () => {
    if (!formData.full_name || !formData.email || !formData.id_user_role) {
      setError('Preencha todos os campos obrigatórios')
      return
    }
    setError(null)
    setIsSaving(true)
    onSave(formData)
      .catch(err => setError(err instanceof Error ? err.message : 'Erro ao salvar'))
      .finally(() => setIsSaving(false))
  }

  const handleEditClick = () => {
    if (user?.id) {
      setIsEditMode(true)
      onEdit?.()
    }
  }

  const handleConfirmAction = () => {
    const action = confirmAction
    setConfirmAction(null)
    if (action === 'inativar') onInactivate?.()
    else if (action === 'ativar') onActivate?.()
  }

  // ── Derived ───────────────────────────────────────────────────
  const isNewUser = !user?.id
  const isUserActive = user?.is_active !== false
  const canEdit = isNewUser || isEditMode
  const isValid = !!(formData.full_name && formData.email && formData.id_user_role)
  const selectedRoleName = roles.find(r => r.id === String(formData.id_user_role))?.name
  const anyLoading = isSaving || isActing

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full bg-white shadow-lg z-50 flex flex-col min-w-[50vw]">

          {/* Header */}
          <div className="flex items-center justify-between shrink-0 px-6 h-[60px]">
            <div className="flex items-center gap-[8px]">
              <div className="w-[32px] h-[32px] flex items-center justify-center">
                <AppIcon name="group" size={24} color={HEADER_COLOR} />
              </div>
              <h2
                className="font-semibold text-[20px]"
                style={{ ...FF, color: HEADER_COLOR }}
              >
                {isNewUser ? 'Novo Usuário' : 'Editar Usuário'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-[32px] h-[32px] flex items-center justify-center hover:bg-[#f0f0f0] rounded"
            >
              <AppIcon name="close" size={20} color={HEADER_COLOR} />
            </button>
          </div>
          <div className="h-[1px] bg-[#e0e0e0] shrink-0" />

          {/* Scrollable body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col gap-[16px]">

            {/* Nome */}
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-[14px]" style={LABEL}>Nome</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={e => handleChange('full_name', e.target.value)}
                placeholder="Insira o nome"
                readOnly={!canEdit}
                disabled={isSaving}
                className={`${inputBase} ${!canEdit ? 'bg-[#f5f5f5] cursor-default' : 'bg-white cursor-text'}`}
                style={{ ...FF, color: '#2a2a2a' }}
              />
            </div>

            {/* E-mail */}
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-[14px]" style={LABEL}>E-mail</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => handleChange('email', e.target.value)}
                placeholder="Insira o E-mail"
                readOnly={!isNewUser}
                disabled={isSaving}
                className={`${inputBase} ${!isNewUser ? 'bg-[#f5f5f5] cursor-default' : 'bg-white cursor-text'}`}
                style={{ ...FF, color: '#2a2a2a' }}
              />
            </div>

            {/* Cargo */}
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-[14px]" style={LABEL}>Cargo</label>
              {!canEdit ? (
                <div
                  className="h-[45px] px-4 border border-[#0f3255] rounded-[5px] text-[14px] bg-[#f5f5f5] flex items-center"
                  style={{ ...FF, color: '#2a2a2a' }}
                >
                  {selectedRoleName || '-'}
                </div>
              ) : (
                <div ref={roleWrapRef} className="flex flex-col">
                  <div
                    onClick={() => !isSaving && setShowRoleDropdown(prev => !prev)}
                    className="h-[45px] px-4 border border-[#0f3255] rounded-[5px] text-[14px] bg-white flex items-center justify-between cursor-pointer select-none"
                    style={FF}
                  >
                    <span style={{ color: formData.id_user_role ? '#2a2a2a' : '#919191' }}>
                      {selectedRoleName || 'Selecione o cargo'}
                    </span>
                    <AppIcon
                      name={showRoleDropdown ? 'arrow_drop_up' : 'arrow_drop_down'}
                      size={24}
                      color={PRIMARY}
                    />
                  </div>
                  {showRoleDropdown && (
                    <div className="border border-[#0f3255] rounded-[5px] bg-white mt-1 max-h-[180px] overflow-y-auto shadow-md">
                      {roles.length > 0 ? (
                        roles.map(role => {
                          const isSelected = role.id === String(formData.id_user_role)
                          return (
                            <div
                              key={role.id}
                              onClick={() => {
                                handleChange('id_user_role', role.id)
                                setShowRoleDropdown(false)
                              }}
                              className="px-4 py-2 cursor-pointer text-[14px] hover:bg-gray-50"
                              style={{
                                ...FF,
                                ...(isSelected
                                  ? { backgroundColor: '#EDF2FB', color: '#1e558b', fontWeight: 600 }
                                  : { color: '#2a2a2a' }),
                              }}
                            >
                              {role.name}
                            </div>
                          )
                        })
                      ) : (
                        <div className="px-4 py-3 text-[14px]" style={{ ...FF, color: '#919191' }}>
                          Nenhum cargo disponível
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Ações herdadas do cargo */}
            {formData.id_user_role && (
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-[14px]" style={LABEL}>
                  Ações herdadas do cargo
                </label>
                <div
                  className="min-h-[45px] px-4 py-3 border border-[#0f3255] rounded-[5px] bg-[#f5f5f5] flex flex-wrap items-center gap-2"
                  style={FF}
                >
                  {rolePermissions.length > 0 ? (
                    rolePermissions.map(name => (
                      <span
                        key={name}
                        className="bg-[#0f3255] text-white px-3 py-1 rounded-[4px] text-[13px] font-medium"
                        style={FF}
                      >
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[14px]" style={{ ...FF, color: '#919191' }}>
                      Este cargo não possui ações configuradas.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Páginas com acesso */}
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-[14px]" style={LABEL}>Páginas com acesso</label>
              {pagesError && (
                <span className="text-[12px]" style={{ color: '#d32f2f', ...FF }}>
                  {pagesError}
                </span>
              )}
              {!canEdit ? (
                <div
                  className="min-h-[45px] max-h-[96px] overflow-y-auto overflow-x-hidden px-4 py-3 border border-[#0f3255] rounded-[5px] bg-[#f5f5f5] flex flex-wrap items-center gap-2"
                  style={FF}
                >
                  {formData.permissions.length > 0 ? (
                    formData.permissions.map(pageId => {
                      const page = availablePages.find(p => p.value === pageId)
                      return (
                        <span
                          key={pageId}
                          className="bg-[#0f3255] text-white px-3 py-1 rounded-[4px] text-[13px] font-medium shrink-0"
                          style={FF}
                        >
                          {page?.label || pageId}
                        </span>
                      )
                    })
                  ) : (
                    <span className="text-[14px]" style={{ ...FF, color: '#919191' }}>-</span>
                  )}
                </div>
              ) : (
                <div ref={pageWrapRef}>
                  <div
                    onClick={handlePageDropdownToggle}
                    className="h-[45px] px-4 border border-[#0f3255] rounded-[5px] bg-white flex items-center gap-2 cursor-pointer select-none overflow-hidden"
                    style={FF}
                  >
                    <div className="flex items-center gap-2 flex-1 overflow-hidden">
                      {formData.permissions.length > 0 ? (
                        <>
                          {formData.permissions.slice(0, 3).map(pageId => {
                            const page = availablePages.find(p => p.value === pageId)
                            return (
                              <span
                                key={pageId}
                                className="bg-[#0f3255] text-white px-2 py-[2px] rounded-[4px] text-[13px] font-medium flex items-center gap-1 shrink-0"
                                style={FF}
                                onClick={e => { e.stopPropagation(); togglePage(pageId) }}
                              >
                                {page?.label || pageId}
                                <AppIcon name="close" size={12} color="white" />
                              </span>
                            )
                          })}
                          {formData.permissions.length > 3 && (
                            <span
                              className="bg-[#0f3255] text-white px-2 py-[2px] rounded-[4px] text-[13px] font-medium shrink-0"
                              style={FF}
                            >
                              +{formData.permissions.length - 3}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[14px]" style={{ color: '#919191' }}>
                          Selecione as páginas
                        </span>
                      )}
                    </div>
                    <AppIcon
                      name={showPageDropdown ? 'arrow_drop_up' : 'arrow_drop_down'}
                      size={24}
                      color={PRIMARY}
                      className="shrink-0"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Erro de validação / save */}
            {error && (
              <p className="text-[13px]" style={{ color: '#d32f2f', ...FF }}>
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="h-[1px] bg-[#e0e0e0] shrink-0" />
          <div className="flex items-center justify-between px-6 py-4 shrink-0 bg-white">
            {/* Esquerda */}
            {isNewUser || isEditMode ? (
              <button
                type="button"
                onClick={isEditMode ? () => setIsEditMode(false) : onClose}
                disabled={anyLoading}
                className="flex items-center justify-center h-[45px] px-[8px] py-[2px] rounded-[4px] border border-[#e67c26] bg-white w-[150px] disabled:opacity-50"
              >
                <span className="font-bold text-[14px]" style={{ fontFamily: 'Inter, sans-serif', color: '#e67c26' }}>
                  Voltar
                </span>
              </button>
            ) : isUserActive ? (
              <button
                type="button"
                onClick={() => setConfirmAction('inativar')}
                disabled={anyLoading}
                className="flex items-center justify-center h-[45px] px-[8px] py-[2px] rounded-[4px] bg-[#eb5757] w-[150px] disabled:opacity-50"
              >
                <span className="font-bold text-[14px] text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Inativar
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmAction('ativar')}
                disabled={anyLoading}
                className="flex items-center justify-center h-[45px] px-[8px] py-[2px] rounded-[4px] bg-[#27ae60] w-[150px] disabled:opacity-50"
              >
                <span className="font-bold text-[14px] text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Ativar
                </span>
              </button>
            )}

            {/* Direita */}
            <div className="flex items-center gap-3">
              {isNewUser ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isValid || anyLoading}
                  className="flex items-center justify-center h-[45px] px-[8px] py-[2px] rounded-[4px] bg-[#e67c26] w-[150px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-bold text-[14px] text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {isSaving ? 'Criando...' : 'Criar'}
                  </span>
                </button>
              ) : isEditMode ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isValid || anyLoading}
                  className="flex items-center justify-center h-[45px] px-[8px] py-[2px] rounded-[4px] bg-[#e67c26] w-[150px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-bold text-[14px] text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onResendInvite?.()}
                    disabled={anyLoading}
                    className="flex items-center justify-center h-[45px] px-[8px] py-[2px] rounded-[4px] border border-[#e67c26] bg-white w-[150px] disabled:opacity-50"
                  >
                    <span className="font-bold text-[14px]" style={{ fontFamily: 'Inter, sans-serif', color: '#e67c26' }}>
                      Reenviar convite
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleEditClick}
                    disabled={anyLoading}
                    className="flex items-center justify-center h-[45px] px-[8px] py-[2px] rounded-[4px] bg-[#e67c26] w-[150px] disabled:opacity-50"
                  >
                    <span className="font-bold text-[14px] text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
                      Editar
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
      </div>

      {/* Dropdown de páginas via portal */}
      {showPageDropdown && dropdownPos && createPortal(
        <div
          ref={pageDropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 9999,
          }}
          className="max-h-[220px] overflow-y-auto overflow-x-hidden bg-white border border-[#0f3255] rounded-[5px] shadow-lg"
        >
          {availablePages.length > 0 ? (
            availablePages.map(page => {
              const isSelected = formData.permissions.includes(page.value)
              return (
                <div
                  key={page.value}
                  onClick={() => togglePage(page.value)}
                  className="px-4 py-2 cursor-pointer text-[14px] flex items-center gap-3 hover:bg-gray-50"
                  style={{
                    ...FF,
                    ...(isSelected ? { backgroundColor: '#EDF2FB' } : {}),
                  }}
                >
                  <div
                    className="w-4 h-4 border rounded flex items-center justify-center shrink-0"
                    style={{
                      borderColor: isSelected ? '#0f3255' : '#bdbdbd',
                      backgroundColor: isSelected ? '#0f3255' : 'white',
                    }}
                  >
                    {isSelected && <AppIcon name="check" size={12} color="white" />}
                  </div>
                  <span style={{ color: '#2a2a2a' }}>{page.label}</span>
                </div>
              )
            })
          ) : (
            <div className="px-4 py-3 text-[14px]" style={{ ...FF, color: '#919191' }}>
              Nenhuma página disponível
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Modal de confirmação (inativar / ativar) */}
      {confirmAction && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={() => setConfirmAction(null)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-[61]">
            <div
              className="bg-white border border-[#bdbdbd] rounded-[6px] p-6 w-[480px] flex flex-col gap-4"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-[20px] font-bold text-center" style={{ ...FF, color: '#2a2a2a' }}>
                Atenção
              </p>
              <div className="border-t border-[#e0e0e0]" />
              <p className="text-[14px] text-center" style={{ ...FF, color: '#2a2a2a' }}>
                {confirmAction === 'inativar'
                  ? <>Tem certeza que deseja inativar o Usuário{' '}<span className="font-bold">{user?.full_name}</span>?</>
                  : <>Tem certeza que deseja ativar o Usuário{' '}<span className="font-bold">{user?.full_name}</span>?</>
                }
              </p>
              <div className="border-t border-[#e0e0e0]" />
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  disabled={isActing}
                  className="flex items-center justify-center h-[45px] px-4 rounded-[4px] border border-[#e67c26] w-[150px] disabled:opacity-50"
                >
                  <span className="font-bold text-[14px]" style={{ ...FF, color: '#e67c26' }}>
                    Cancelar
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAction}
                  disabled={isActing}
                  className="flex items-center justify-center h-[45px] px-4 rounded-[4px] w-[150px] disabled:opacity-50"
                  style={{
                    backgroundColor: confirmAction === 'inativar' ? '#c7392c' : '#27ae60',
                  }}
                >
                  <span className="font-bold text-[14px] text-white" style={FF}>
                    {confirmAction === 'inativar' ? 'Inativar' : 'Ativar'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
