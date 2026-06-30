import { useState, useEffect } from 'react'
import { PageHeader, Pagination, SharedTable, TableColumn, AppIcon, Toggle, useToast, ToastContainer } from '../../shared/components'
import { supabase, getEnvironment } from '../../lib/supabase'
import { UserModal, UserFormData } from './components/UserModal'
import { UsersToolbar, UserFilterData, EMPTY_USER_FILTERS } from './components/UsersToolbar'
import { inviteUser, resendInvite } from '../../features/email'
import { saveUserPageAccessFromRole } from '../../features/users/api/user-page-access.service'

interface UsersPageProps {
  userName?: string
  userRole?: string
  onLogout?: () => void
  userEmail?: string
  isSidebarOpen?: boolean
  onToggleSidebar?: () => void
}

const TEXT_LIGHT75 = '#2a2a2a'
const TEXT_LIGHT25 = '#919191'

interface UserData {
  id: string
  full_name: string
  email: string
  cargo: string
  convite_envio: string
  status: string
  is_active: boolean
}

const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return dateStr
  }
}

const getStatusStyle = (status: string | undefined): React.CSSProperties => {
  if (!status) return { color: TEXT_LIGHT25 }
  const normalized = status.toLowerCase().trim()
  if (normalized === 'ativo') return { color: TEXT_LIGHT75 }
  return { color: TEXT_LIGHT25 }
}

const renderStatus = (status: string | undefined) => (
  <span className="font-bold text-[14px] whitespace-nowrap" style={getStatusStyle(status)}>
    {status || '-'}
  </span>
)

const renderText = (value: string | undefined) => (
  <span className="font-medium text-[14px]" style={{ fontFamily: 'Inter, sans-serif', color: TEXT_LIGHT75 }}>
    {value || '-'}
  </span>
)

const renderSmallText = (value: string | undefined) => (
  <span className="font-medium text-[12px]" style={{ fontFamily: 'Inter, sans-serif', color: TEXT_LIGHT75 }}>
    {value || '-'}
  </span>
)

export const UsersPage = ({
  userName = 'Leon Kennedy',
  userRole = 'Usuário',
  onLogout,
  userEmail,
  isSidebarOpen = true,
  onToggleSidebar,
}: UsersPageProps) => {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [activeFilters, setActiveFilters] = useState<UserFilterData>(EMPTY_USER_FILTERS)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserFormData | null>(null)
  const [isActing, setIsActing] = useState(false)
  const { toasts, showSuccess, showError, removeToast } = useToast()
  const LIMIT = 50

  const columns: TableColumn<UserData>[] = [
    { key: 'full_name', label: 'Nome Completo', render: (row) => renderText(row.full_name) },
    { key: 'cargo', label: 'Cargo', render: (row) => renderSmallText(row.cargo) },
    { key: 'convite_envio', label: 'Envio do convite', render: (row) => renderSmallText(formatDate(row.convite_envio)) },
    { key: 'status', label: 'Status', render: (row) => renderStatus(row.status) },
    {
      key: 'actions',
      label: 'Ações',
      width: '60px',
      render: (row) => (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => handleEdit(row)}
            className="flex items-center justify-center w-8 h-8 rounded hover:bg-[#F0F4F9] transition-colors"
          >
            <AppIcon name="edit" size={18} color="#2a2a2a" />
          </button>
        </div>
      ),
      align: 'center'
    },
  ]

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const isTest = getEnvironment() !== 'production'
      const start = (currentPage - 1) * LIMIT
      const end = start + LIMIT - 1

      // Pre-query: filtro por página com acesso (rel_user_role_page)
      let filteredUserIdsByPage: string[] | null = null
      if (activeFilters.pagina) {
        const { data: pageAccess } = await supabase
          .from('rel_user_role_page')
          .select('id_user')
          .eq('id_system_page', Number(activeFilters.pagina))
          .eq('is_active', true)
          .eq('is_test', isTest)
        filteredUserIdsByPage = (pageAccess || []).map(r => String(r.id_user))
        if (filteredUserIdsByPage.length === 0) {
          setUsers([])
          setTotal(0)
          setLoading(false)
          return
        }
      }

      // Pre-query: filtro por ação herdada do cargo
      let filteredRoleIdsByAction: string[] | null = null
      if (activeFilters.acao) {
        const { data: rolePerm } = await supabase
          .from('master_user_role_permission')
          .select('role_id')
          .eq('permission_id', Number(activeFilters.acao))
        const allRoleIds = (rolePerm || []).map(r => String(r.role_id))
        if (allRoleIds.length === 0) {
          setUsers([])
          setTotal(0)
          setLoading(false)
          return
        }
        const { data: envRoles } = await supabase
          .from('master_user_role')
          .select('id')
          .eq('is_test', isTest)
          .in('id', allRoleIds)
        filteredRoleIdsByAction = (envRoles || []).map(r => String(r.id))
        if (filteredRoleIdsByAction.length === 0) {
          setUsers([])
          setTotal(0)
          setLoading(false)
          return
        }
      }

      // Query principal
      let query = supabase
        .from('master_system_user')
        .select('*', { count: 'exact' })
        .eq('is_test', isTest)

      if (!showInactive) {
        query = query.eq('is_active', true)
      }

      if (searchTerm.trim()) {
        const term = searchTerm.trim()
        query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
      }

      if (activeFilters.cargo) {
        query = query.eq('id_user_role', activeFilters.cargo)
      }

      if (filteredUserIdsByPage !== null) {
        query = query.in('id', filteredUserIdsByPage)
      }

      if (filteredRoleIdsByAction !== null) {
        query = query.in('id_user_role', filteredRoleIdsByAction)
      }

      const ascending = activeFilters.ordenar === 'antigos'
      query = query.order('created_at', { ascending }).range(start, end)

      const { data, error, count } = await query

      if (error) throw error

      // Buscar nomes dos cargos
      const roleIds = (data || [])
        .map(u => u.id_user_role)
        .filter(id => id != null && String(id).trim() !== '')
      const rolesMap: Record<string, string> = {}

      if (roleIds.length > 0) {
        const uniqueRoleIds = [...new Set(roleIds.map(id => String(id)))]
        const { data: rolesData } = await supabase
          .from('master_user_role')
          .select('id, name')
          .in('id', uniqueRoleIds)
          .eq('is_test', isTest)

        if (rolesData) {
          rolesData.forEach(role => {
            rolesMap[role.id] = role.name
          })
        }
      }

      const usersData: UserData[] = (data || []).map(u => ({
        id: u.id,
        full_name: u.full_name || '',
        email: u.email || '',
        cargo: u.id_user_role ? (rolesMap[u.id_user_role] || u.id_user_role) : '-',
        convite_envio: u.created_at || '',
        status: u.is_active ? 'Ativo' : 'Inativo',
        is_active: u.is_active ?? true,
      }))

      setUsers(usersData)
      setTotal(count || 0)
    } catch (err) {
      console.error('[UsersPage] Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [currentPage, searchTerm, showInactive, activeFilters])

  const handleSearch = (term: string) => {
    setSearchTerm(term)
    setCurrentPage(1)
  }

  const handleFilter = (filters: UserFilterData) => {
    setActiveFilters(filters)
    setCurrentPage(1)
  }

  const handleAddNew = () => {
    setSelectedUser(null)
    setIsModalOpen(true)
  }

  const handleEdit = async (user: UserData) => {
    try {
      const isTest = getEnvironment() !== 'production'
      let permissions: string[] = []
      let cargoId = ''

      if (user.cargo && user.cargo !== '-') {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.cargo)
        let roleData = null

        if (isUuid) {
          const { data } = await supabase
            .from('master_user_role')
            .select('id, name')
            .eq('id', user.cargo)
            .eq('is_test', isTest)
            .maybeSingle()
          roleData = data
        }

        if (!roleData) {
          const { data } = await supabase
            .from('master_user_role')
            .select('id, name')
            .eq('name', user.cargo)
            .eq('is_test', isTest)
            .maybeSingle()
          roleData = data
        }

        if (roleData) {
          cargoId = roleData.id
        }
      }

      const { data: userPermissions } = await supabase
        .from('rel_user_role_page')
        .select('id_system_page')
        .eq('id_user', user.id)
        .eq('is_test', isTest)
        .eq('is_active', true)

      if (userPermissions && userPermissions.length > 0) {
        permissions = userPermissions.map(p => p.id_system_page.toString())
      }

      setSelectedUser({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        id_user_role: cargoId,
        permissions,
        is_active: user.is_active,
      })
      setIsModalOpen(true)
    } catch (err) {
      console.error('[UsersPage] Error fetching user permissions:', err)
      setSelectedUser({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        id_user_role: '',
        permissions: [],
        is_active: user.is_active,
      })
      setIsModalOpen(true)
    }
  }

  const handleSaveUser = async (data: UserFormData) => {
    try {
      const isTest = getEnvironment() !== 'production'
      let userId = data.id

      if (data.id) {
        const { error } = await supabase
          .from('master_system_user')
          .update({
            full_name: data.full_name,
            id_user_role: data.id_user_role || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.id)

        if (error) {
          console.error('[UsersPage] Update error:', error)
          throw new Error(error.message)
        }
      } else {
        const inviteResult = await inviteUser({
          email: data.email,
          full_name: data.full_name,
          id_user_role: data.id_user_role || undefined,
        })

        if (!inviteResult.success) {
          throw new Error(inviteResult.error || 'Erro ao convidar usuário')
        }

        userId = inviteResult.user_id!
      }

      if (userId) {
        await saveUserPageAccessFromRole({
          userId,
          roleId: data.id_user_role,
          pageIds: data.permissions,
          isTest,
        })
      }

      showSuccess(data.id ? 'Usuário atualizado com sucesso.' : 'Usuário criado com sucesso.')
      setIsModalOpen(false)
      fetchUsers()
    } catch (err) {
      console.error('[UsersPage] Error saving user:', err)
      throw err
    }
  }

  const handleInactivateUser = async () => {
    if (!selectedUser?.id) return
    setIsActing(true)
    try {
      await supabase
        .from('master_system_user')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', selectedUser.id)
      showSuccess('Usuário inativado com sucesso.')
      setIsModalOpen(false)
      fetchUsers()
    } catch (err) {
      console.error('[UsersPage] Error inactivating user:', err)
      showError('Não foi possível inativar o usuário.')
    } finally {
      setIsActing(false)
    }
  }

  const handleActivateUser = async () => {
    if (!selectedUser?.id) return
    setIsActing(true)
    try {
      await supabase
        .from('master_system_user')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', selectedUser.id)
      showSuccess('Usuário ativado com sucesso.')
      setIsModalOpen(false)
      fetchUsers()
    } catch (err) {
      console.error('[UsersPage] Error activating user:', err)
      showError('Não foi possível ativar o usuário.')
    } finally {
      setIsActing(false)
    }
  }

  const handleResendInvite = async () => {
    if (!selectedUser?.id || !selectedUser?.email || !selectedUser?.full_name) {
      showError('Dados do usuário incompletos.')
      return
    }
    setIsActing(true)
    try {
      const result = await resendInvite(selectedUser.email)
      if (result.success) {
        showSuccess('Convite reenviado com sucesso.')
      } else {
        showError('Não foi possível reenviar o convite.')
      }
    } catch (err) {
      console.error('[UsersPage] Error resending invite:', err)
      showError('Não foi possível reenviar o convite.')
    } finally {
      setIsActing(false)
    }
  }

  const totalPages = Math.ceil(total / LIMIT) || 1

  return (
    <>
      <PageHeader
        title="Usuários"
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar || (() => {})}
        userName={userName}
        userEmail={userEmail}
        userRole={userRole}
        onLogout={onLogout}
      />

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Toolbar */}
        <UsersToolbar
          onSearch={handleSearch}
          onAddNew={handleAddNew}
          onFilter={handleFilter}
        />

        {/* Toggle + Paginação */}
        <div className="flex items-center justify-between">
          <Toggle
            label="Exibir inativos"
            checked={showInactive}
            onChange={(checked) => {
              setShowInactive(checked)
              setCurrentPage(1)
            }}
          />

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>

        {/* Table */}
        <div className="flex flex-1 flex-col w-full min-w-0">
          <SharedTable<UserData>
            columns={columns}
            data={users}
            loading={loading}
            emptyMessage="Nenhum usuário encontrado."
            onRowClick={handleEdit}
          />
        </div>
      </div>

      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveUser}
        onResendInvite={handleResendInvite}
        onInactivate={handleInactivateUser}
        onActivate={handleActivateUser}
        isActing={isActing}
        user={selectedUser}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  )
}
