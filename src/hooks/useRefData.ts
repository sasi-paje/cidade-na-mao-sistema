import { useState, useCallback } from 'react'
import { supabase, getEnvironment } from '../lib/supabase'

export interface RefData {
  id: string
  code: string | null
  description: string | null
  name?: string | null
  permissions?: number[]
  is_active: boolean
  is_test: boolean
  created_at: string
}

interface UseRefDataResult {
  data: RefData[]
  total: number
  loading: boolean
  error: string | null
  fetchData: (params?: { search?: string; isActive?: boolean; page?: number; limit?: number }) => Promise<void>
  create: (data: Partial<RefData>) => Promise<void>
  update: (id: string, data: Partial<RefData>) => Promise<void>
  toggleActive: (id: string, isActive: boolean) => Promise<void>
}

export const useRefData = (tableName: string): UseRefDataResult => {
  const [data, setData] = useState<RefData[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (params?: {
    search?: string
    isActive?: boolean
    page?: number
    limit?: number
  }) => {
    setLoading(true)
    setError(null)

    try {
      const page = params?.page || 1
      const limit = params?.limit || 20
      const start = (page - 1) * limit
      const end = start + limit - 1
      const isReferenceTable = tableName.startsWith('ref_')

      let query = supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(start, end)

      if (!isReferenceTable) {
        const isTest = getEnvironment() !== 'production'
        query = query.eq('is_test', isTest)
      }

      if (params?.isActive !== undefined && params.isActive) {
        query = query.eq('is_active', true)
      }

      if (params?.search) {
        // Use 'name' for master_user_role, 'description' for others
        const searchFields = tableName === 'master_user_role'
          ? 'name'
          : 'description,code'
        query = query.or(`${searchFields}.ilike.%${params.search}%`)
      }

      const { data: result, error: fetchError, count } = await query

      if (fetchError) throw new Error(fetchError.message)

      setData(result || [])
      setTotal(count || 0)
    } catch (err) {
      setError((err as Error).message)
      console.error(`[useRefData/${tableName}] Error:`, err)
    } finally {
      setLoading(false)
    }
  }, [tableName])

  const create = async (item: Partial<RefData>) => {
    const isTest = getEnvironment() !== 'production'
    // Generate a unique code if not provided
    const code = item.code || `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    // For master_user_role table, use 'name' instead of 'description'
    const insertData = tableName === 'master_user_role'
      ? { name: item.name || item.description, code, is_test: isTest, is_active: true }
      : { ...item, code, is_test: isTest, is_active: true }
    const { error } = await supabase
      .from(tableName)
      .insert(insertData)

    if (error) throw new Error(error.message)
  }

  const update = async (id: string, item: Partial<RefData>) => {
    const { error } = await supabase
      .from(tableName)
      .update(item)
      .eq('id', id)

    if (error) throw new Error(error.message)
  }

  const toggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from(tableName)
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw new Error(error.message)
  }

  return {
    data,
    total,
    loading,
    error,
    fetchData,
    create,
    update,
    toggleActive,
  }
}

// Hooks específicos para cada referência
export const useCargos = () => useRefData('ref_user_role')
export const useRecusas = () => useRefData('ref_recusas')
export const useAbortadas = () => useRefData('ref_abortadas')
