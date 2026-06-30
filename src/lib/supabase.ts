import { createClient } from '@supabase/supabase-js'

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// =====================================================
// AMBIENTE TESTE x PRODUÇÃO — fonte ÚNICA da verdade
// =====================================================
// Controlado em build-time pela variável VITE_IS_TEST:
//   VITE_IS_TEST=true  → ambiente de teste/desenvolvimento (is_test = true)
//   VITE_IS_TEST=false → produção (is_test = false)
//
// Em .env.local (local/teste):       VITE_IS_TEST=true
// Em produção (Vercel):              VITE_IS_TEST=false
//
// Regra: is_test = false → produção | is_test = true → teste
export const IS_TEST: boolean = import.meta.env.VITE_IS_TEST === 'true'

// Pasta de Storage por ambiente (separa arquivos novos test/ x prod/)
export const STORAGE_ENV_FOLDER: 'test' | 'prod' = IS_TEST ? 'test' : 'prod'

// Environment context - determines if we're using test data
export type Environment = 'development' | 'test' | 'production'

// Ambiente derivado de IS_TEST (build-time, determinístico).
// Mantido por compatibilidade: o padrão `getEnvironment() !== 'production'`
// usado em todos os services agora resolve exatamente para IS_TEST.
export const getEnvironment = (): Environment => {
  return IS_TEST ? 'development' : 'production'
}

/** Builder de query encadeável com `.eq` (PostgREST filter builder). */
type EqFilterable<T> = { eq(column: string, value: unknown): T }

// Helper to add is_test filter to queries (trx_*, rel_*, master_*, stg_*)
export const withTestFilter = <T extends EqFilterable<T>>(query: T, isTest: boolean = true): T => {
  return query.eq('is_test', isTest)
}

/**
 * Aplica filtro is_test em tabelas ref_*:
 * - PROD: filtra is_test = false
 * - DEV/TEST: sem filtro (traz todos os registros)
 */
export const applyRefFilter = <T extends EqFilterable<T>>(query: T): T => {
  if (getEnvironment() === 'production') {
    return query.eq('is_test', false)
  }
  return query
}

// Database types
export interface Database {
  public: {
    Tables: {
      // Master tables
      master_person_company_group: {
        Row: {
          id: number
          name: string
          description: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string | null
          created_by: string | null
          updated_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['master_person_company_group']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['master_person_company_group']['Insert']>
      }
      master_person_company: {
        Row: {
          id: string
          cnpj: string | null
          legal_name: string | null
          trade_name: string | null
          state_registration: string | null
          municipal_registration: string | null
          email: string | null
          phone: string | null
          id_company_group: number | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string | null
          created_by: string | null
          updated_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['master_person_company']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['master_person_company']['Insert']>
      }
      master_person_company_address: {
        Row: {
          id: string
          id_company: string
          id_company_address_type: string
          street: string | null
          street_number: string | null
          complement: string | null
          district: string | null
          city: string | null
          state: string | null
          zip_code: string | null
          is_primary: boolean
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string | null
          created_by: string | null
          updated_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['master_person_company_address']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['master_person_company_address']['Insert']>
      }
      master_route_area: {
        Row: {
          id: string
          code: string | null
          description: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['master_route_area']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['master_route_area']['Insert']>
      }
      master_fleet_vehicle: {
        Row: {
          id: string
          plate: string | null
          code: string | null
          name: string | null
          nominal_capacity: number | null
          responsible_name: string | null
          responsible_type: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['master_fleet_vehicle']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['master_fleet_vehicle']['Insert']>
      }
      master_person_driver: {
        Row: {
          id: string
          name: string | null
          tax_id: string | null
          phone: string | null
          email: string | null
          license_number: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string | null
          created_by: string | null
          updated_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['master_person_driver']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['master_person_driver']['Insert']>
      }
      master_person_helper: {
        Row: {
          id: string
          cpf: string | null
          name: string | null
          phone: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['master_person_helper']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['master_person_helper']['Insert']>
      }
      master_person_responsible: {
        Row: {
          id: string
          cpf: string | null
          name: string | null
          phone: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['master_person_responsible']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['master_person_responsible']['Insert']>
      }
      // Reference tables
      ref_route_responsible: {
        Row: {
          id: number
          name: string
          slug: string | null
          description: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['ref_route_responsible']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['ref_route_responsible']['Insert']>
      }
      ref_person_company_role_type: {
        Row: {
          id: string
          code: string | null
          description: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['ref_person_company_role_type']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['ref_person_company_role_type']['Insert']>
      }
      ref_person_company_address_type: {
        Row: {
          id: string
          code: string | null
          description: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['ref_person_company_address_type']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['ref_person_company_address_type']['Insert']>
      }
      ref_route_status: {
        Row: {
          id: string
          code: string | null
          description: string | null
          is_active: boolean
          is_test: boolean
          is_initial: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['ref_route_status']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['ref_route_status']['Insert']>
      }
      ref_route_delivery_status: {
        Row: {
          id: string
          code: string | null
          description: string | null
          is_active: boolean
          is_test: boolean
          is_initial: boolean
          allows_route_edition: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['ref_route_delivery_status']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['ref_route_delivery_status']['Insert']>
      }
      ref_route_type: {
        Row: {
          id: string
          code: string | null
          description: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['ref_route_type']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['ref_route_type']['Insert']>
      }
      ref_route_history_type: {
        Row: {
          id: string
          code: string | null
          description: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['ref_route_history_type']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['ref_route_history_type']['Insert']>
      }
      ref_fiscal_invoice_status: {
        Row: {
          id: string
          code: string | null
          description: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['ref_fiscal_invoice_status']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['ref_fiscal_invoice_status']['Insert']>
      }
      ref_fiscal_receipt_status: {
        Row: {
          id: string
          code: string | null
          description: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['ref_fiscal_receipt_status']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['ref_fiscal_receipt_status']['Insert']>
      }
      ref_fiscal_nfd_status: {
        Row: {
          id: string
          code: string | null
          description: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['ref_fiscal_nfd_status']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['ref_fiscal_nfd_status']['Insert']>
      }
      ref_fiscal_total_status: {
        Row: {
          id: string
          code: string | null
          description: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['ref_fiscal_total_status']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['ref_fiscal_total_status']['Insert']>
      }
      // Transaction tables
      trx_route: {
        Row: {
          id: string
          route_code: string | null
          departure_date: string | null
          id_route_status: string | null
          id_route_delivery_status: string | null
          id_route_type: string | null
          id_vehicle: string | null
          id_driver: string | null
          starts_at: string | null
          ends_at: string | null
          vehicle_start_photo_path: string | null
          observation: string | null
          daily_count: number | null
          transported_weight: number | null
          nominal_capacity: number | null
          utilization_percent: number | null
          area: string | null
          id_route_responsible: number
          responsible: string | null
          assistant: string[] | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string | null
          created_by: string | null
          updated_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['trx_route']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['trx_route']['Insert']>
      }
      trx_route_history: {
        Row: {
          id: string
          id_route: string
          id_history_type: string | null
          event_at: string | null
          description: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['trx_route_history']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['trx_route_history']['Insert']>
      }
      trx_route_stop: {
        Row: {
          id: number
          id_route: number
          id_company: number
          stop_sequence: number | null
          arrived_at: string | null
          departed_at: string | null
          arrival_photo_path: string | null
          arrival_observation: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string | null
          created_by: number | null
          updated_by: number | null
        }
        Insert: Omit<Database['public']['Tables']['trx_route_stop']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['trx_route_stop']['Insert']>
      }
      trx_fiscal_invoice_import: {
        Row: {
          id: number
          id_supplier_company: number
          trip_number: string
          bellog_arrival_date: string
          original_file_name: string | null
          file_path: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string | null
          created_by: number | null
          updated_by: number | null
        }
        Insert: Omit<Database['public']['Tables']['trx_fiscal_invoice_import']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['trx_fiscal_invoice_import']['Insert']>
      }
      trx_fiscal_invoice: {
        Row: {
          id: string
          invoice_access_key: string | null
          invoice_number: string
          invoice_series: string | null
          invoice_issue_date: string | null
          id_supplier_company: string | null
          id_customer_company: string | null
          box_quantity: number | null
          gross_weight: number | null
          invoice_amount: number | null
          id_fiscal_invoice_status: string | null
          id_fiscal_receipt_status: string | null
          id_fiscal_nfd_status: string | null
          id_fiscal_total_status: string | null
          id_fiscal_invoice_import: number | null
          xml_file_path: string | null
          id_route: string | null
          id_status: string | null
          id_receipt_status: string | null
          id_nfd_status: string | null
          id_total_status: string | null
          value: number | null
          weight: number | null
          volume: number | null
          issue_date: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string | null
          created_by: string | null
          updated_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['trx_fiscal_invoice']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['trx_fiscal_invoice']['Insert']>
      }
      // Relation tables
      rel_person_company_role_type: {
        Row: {
          id: string
          id_company: string
          id_company_role_type: string
          is_test: boolean
          created_at: string
          updated_at: string | null
          created_by: string | null
          updated_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['rel_person_company_role_type']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['rel_person_company_role_type']['Insert']>
      }
      rel_route_invoice: {
        Row: {
          id: string
          id_route: string
          id_fiscal_invoice: string
          id_route_stop: string | null
          assigned_at: string
          assigned_by: string | null
          unassigned_at: string | null
          unassigned_by: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string | null
          created_by: string | null
          updated_by: string | null
          attempt_number: number
          released_at: string | null
          release_reason: string | null
          planned_box_quantity: number | null
          planned_amount: number | null
          id_previous_route_invoice: number | null
        }
        Insert: Omit<Database['public']['Tables']['rel_route_invoice']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['rel_route_invoice']['Insert']>
      }
      rel_route_driver: {
        Row: {
          id: string
          id_route: string
          id_driver: string
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['rel_route_driver']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['rel_route_driver']['Insert']>
      }
      rel_route_helper: {
        Row: {
          id: string
          id_route: string
          id_helper: string
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['rel_route_helper']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['rel_route_helper']['Insert']>
      }
      rel_route_responsible: {
        Row: {
          id: string
          id_route: string
          id_responsible: string
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['rel_route_responsible']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['rel_route_responsible']['Insert']>
      }
      rel_route_destination: {
        Row: {
          id: string
          id_route: string
          id_company: string
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['rel_route_destination']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['rel_route_destination']['Insert']>
      }
      trx_route_invoice_delivery: {
        Row: {
          id: string
          id_route: string
          id_fiscal_invoice: string
          id_route_invoice: string | null
          id_delivery_type: number | null
          id_reason: string | null
          receipt_image_path: string | null
          nfd_image_path: string | null
          nfd_number: string | null
          returned_box_quantity: number | null
          returned_amount: number | null
          observation: string | null
          delivered_at: string | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['trx_route_invoice_delivery']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['trx_route_invoice_delivery']['Insert']>
      }
      ref_delivery_reason_type: {
        Row: {
          id: string
          code: string | null
          name: string | null
          description: string | null
          id_result_invoice_status: number | null
          releases_to_available: boolean
          finalizes_invoice: boolean
          uses_returned_balance: boolean
          requires_reason: boolean
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['ref_delivery_reason_type']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['ref_delivery_reason_type']['Insert']>
      }
      ref_delivery_reason: {
        Row: {
          id: string
          name: string | null
          id_reason_type: number | null
          id_reason_category: number | null
          sort_order: number | null
          is_active: boolean
          is_test: boolean
          created_at: string
          updated_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['ref_delivery_reason']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['ref_delivery_reason']['Insert']>
      }
      // Staging / ETL tables
      stg_integration_route_csv: {
        Row: {
          id: string
          csv_content: string | null
          processed_at: string | null
          is_valid: boolean
          is_test: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['stg_integration_route_csv']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['stg_integration_route_csv']['Insert']>
      }
      stg_integration_fiscal_invoice_xml: {
        Row: {
          id: string
          xml_content: string | null
          processed_at: string | null
          is_valid: boolean
          is_test: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['stg_integration_fiscal_invoice_xml']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['stg_integration_fiscal_invoice_xml']['Insert']>
      }
      etl_integration_execution: {
        Row: {
          id: string
          integration_type: string | null
          started_at: string | null
          finished_at: string | null
          records_processed: number | null
          records_success: number | null
          records_error: number | null
          is_test: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['etl_integration_execution']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['etl_integration_execution']['Insert']>
      }
      etl_integration_error: {
        Row: {
          id: string
          id_execution: string
          error_message: string | null
          line_number: number | null
          data_json: string | null
          is_test: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['etl_integration_error']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['etl_integration_error']['Insert']>
}
      // =====================================================
      // STAGING TABLES - LEGACY
      // =====================================================
      // ATENÇÃO: stg_route_card e stg_route_card_notes são LEGACY
      // Não usar em novos fluxos. Fonte oficial é:
      //   - trx_route para rotas
      //   - rel_route_invoice para notas vinculadas
      //   - RPC get_assign_notes_board para dados da tela Atribuir Notas
      // =====================================================
      stg_route_card: {
        Row: {
          id: string
          id_vehicle: string | null
          vehicle_plate: string | null
          capacidade: number | null
          is_test: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['stg_route_card']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['stg_route_card']['Insert']>
      }
      stg_route_card_notes: {
        Row: {
          id: string
          id_route_card: string | null
          id_invoice: string | null
          invoice_number: string | null
          peso: number | null
          order_index: number | null
          is_test: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['stg_route_card_notes']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['stg_route_card_notes']['Insert']>
      }
    }
  }
}

// Type aliases for easier usage
export type MasterPersonCompany = Database['public']['Tables']['master_person_company']['Row']
export type MasterPersonCompanyAddress = Database['public']['Tables']['master_person_company_address']['Row']
export type MasterPersonCompanyGroup = Database['public']['Tables']['master_person_company_group']['Row']
export type MasterRouteArea = Database['public']['Tables']['master_route_area']['Row']
export type MasterFleetVehicle = Database['public']['Tables']['master_fleet_vehicle']['Row']
export type MasterPersonDriver = Database['public']['Tables']['master_person_driver']['Row']
export type MasterPersonHelper = Database['public']['Tables']['master_person_helper']['Row']
export type MasterPersonResponsible = Database['public']['Tables']['master_person_responsible']['Row']

export type RefPersonCompanyRoleType = Database['public']['Tables']['ref_person_company_role_type']['Row']
export type RefPersonCompanyAddressType = Database['public']['Tables']['ref_person_company_address_type']['Row']
export type RefRouteResponsible = Database['public']['Tables']['ref_route_responsible']['Row']
export type RefRouteStatus = Database['public']['Tables']['ref_route_status']['Row']
export type RefRouteDeliveryStatus = Database['public']['Tables']['ref_route_delivery_status']['Row']
export type RefRouteType = Database['public']['Tables']['ref_route_type']['Row']
export type RefRouteHistoryType = Database['public']['Tables']['ref_route_history_type']['Row']
export type RefFiscalInvoiceStatus = Database['public']['Tables']['ref_fiscal_invoice_status']['Row']
export type RefFiscalReceiptStatus = Database['public']['Tables']['ref_fiscal_receipt_status']['Row']
export type RefFiscalNfdStatus = Database['public']['Tables']['ref_fiscal_nfd_status']['Row']
export type RefFiscalTotalStatus = Database['public']['Tables']['ref_fiscal_total_status']['Row']

export type TrxRoute = Database['public']['Tables']['trx_route']['Row']
export type TrxRouteHistory = Database['public']['Tables']['trx_route_history']['Row']
export type TrxRouteStop = Database['public']['Tables']['trx_route_stop']['Row']
export type TrxFiscalInvoiceImport = Database['public']['Tables']['trx_fiscal_invoice_import']['Row']
export type TrxFiscalInvoice = Database['public']['Tables']['trx_fiscal_invoice']['Row']

export type RelPersonCompanyRoleType = Database['public']['Tables']['rel_person_company_role_type']['Row']
export type RelRouteInvoice = Database['public']['Tables']['rel_route_invoice']['Row']

// =====================================================
// REL TABLES - Status de uso (LEACY - não usar em novos fluxos)
// =====================================================
/** @deprecated LEGACY - Fonte oficial é trx_route.id_driver */
export type RelRouteDriver = Database['public']['Tables']['rel_route_driver']['Row']
/** @deprecated LEGACY - Não usado no código. Manter para possível uso futuro com trx_route.assistant text[] */
export type RelRouteHelper = Database['public']['Tables']['rel_route_helper']['Row']
/** @deprecated LEGACY - Fonte oficial é trx_route.id_route_responsible */
export type RelRouteResponsible = Database['public']['Tables']['rel_route_responsible']['Row']
/** @deprecated LEGACY - Fonte oficial é trx_route_stop */
export type RelRouteDestination = Database['public']['Tables']['rel_route_destination']['Row']

export type StgIntegrationRouteCsv = Database['public']['Tables']['stg_integration_route_csv']['Row']
export type StgIntegrationFiscalInvoiceXml = Database['public']['Tables']['stg_integration_fiscal_invoice_xml']['Row']
export type EtlIntegrationExecution = Database['public']['Tables']['etl_integration_execution']['Row']
export type EtlIntegrationError = Database['public']['Tables']['etl_integration_error']['Row']

// =====================================================
// LEGACY TYPES - Não usar em novos fluxos
// =====================================================
/** @deprecated LEGACY - Use rel_route_invoice + get_assign_notes_board RPC */
export type StgRouteCard = Database['public']['Tables']['stg_route_card']['Row']
/** @deprecated LEGACY - Use rel_route_invoice */
export type StgRouteCardNotes = Database['public']['Tables']['stg_route_card_notes']['Row']
