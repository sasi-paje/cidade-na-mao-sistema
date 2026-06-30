import { supabase } from '../../../lib/supabase'

export interface EmailServiceResponse {
  success: boolean
  message?: string
  error?: string
}

export interface InviteUserRequest {
  email: string
  full_name: string
  id_user_role?: string
}

export interface InviteUserResponse extends EmailServiceResponse {
  user_id?: string
}

/**
 * Convida um novo usuário.
 * Cria a conta no Supabase Auth + master_system_user e envia email de convite via AWS SES.
 */
export const inviteUser = async (data: InviteUserRequest): Promise<InviteUserResponse> => {
  try {
    const { data: result, error } = await supabase.functions.invoke('invite-user', {
      body: data,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      message: result?.message || 'Convite enviado com sucesso',
      user_id: result?.user_id,
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao convidar usuário' }
  }
}

/**
 * Reenvia convite / envia link de redefinição de senha.
 * Chama send-password-reset que gera novo link de recovery via AWS SES.
 */
export const resendInvite = async (email: string): Promise<EmailServiceResponse> => {
  try {
    const { data: result, error } = await supabase.functions.invoke('send-password-reset', {
      body: { email },
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      message: result?.message || 'Convite reenviado com sucesso',
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao reenviar convite' }
  }
}

