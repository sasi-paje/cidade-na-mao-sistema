import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * exchange-sasi-token — troca um token SASI válido por uma sessão real do
 * Supabase Auth (fluxo oficial via magic link, sem JWT manual).
 *
 * Fluxo:
 *  1. Recebe { token } (POST).
 *  2. Valida o token na SASI: GET {SASI_API_URL}/api/v2/providers/external/me.
 *  3. Extrai o e-mail do provider.
 *  4. Resolve master_user por e-mail (service role): 0 -> 403, >1 -> 409.
 *  5. Garante o auth.users correspondente (cria com email_confirm se faltar,
 *     pois o token SASI já foi validado) e concilia master_user.id_auth_user.
 *  6. Gera magic link com admin.generateLink (sem enviar e-mail) e devolve o
 *     hashed_token para o frontend trocar por sessão via verifyOtp.
 *
 * Segurança: a emissão da sessão só ocorre APÓS a validação SASI. O service
 * role nunca sai do servidor. Não logamos token nem hashed_token.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type JsonBody = Record<string, unknown>

interface ProviderResponse {
  id: number | string
  name: string
  role: string
  status: string
  customProps?: { email?: string; [key: string]: unknown }
  profileProps?: { email?: string; [key: string]: unknown }
}

const json = (body: JsonBody, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const fail = (message: string, status = 400): Response => json({ success: false, error: message }, status)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const extractProviderResponse = (payload: unknown): ProviderResponse | null => {
  const candidate = isRecord(payload) && isRecord(payload.data) ? payload.data : payload
  if (!isRecord(candidate)) return null
  const idType = typeof candidate.id
  if (
    (idType !== 'number' && idType !== 'string') ||
    typeof candidate.name !== 'string' ||
    typeof candidate.role !== 'string' ||
    typeof candidate.status !== 'string'
  ) {
    return null
  }
  return candidate as unknown as ProviderResponse
}

const getProviderEmail = (provider: ProviderResponse): string | null => {
  const email = provider.customProps?.email || provider.profileProps?.email
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null
}

const getSasiApiBaseUrl = (): string => {
  const apiBaseUrl = Deno.env.get('SASI_API_URL')
  if (!apiBaseUrl) throw new Error('SASI_API_URL nao configurada.')
  return apiBaseUrl.replace(/\/$/, '')
}

const getSupabaseAdmin = (): SupabaseClient => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao configurados.')
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const validateSasiToken = async (token: string): Promise<ProviderResponse> => {
  const response = await fetch(`${getSasiApiBaseUrl()}/api/v2/providers/external/me`, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Token SASI invalido ou expirado.')
    }
    throw new Error(`Erro ao validar token SASI: ${response.status} ${response.statusText}`)
  }

  const provider = extractProviderResponse(await response.json())
  if (!provider) throw new Error('Resposta da API SASI invalida.')
  return provider
}

/** Procura um auth user por e-mail varrendo páginas do admin.listUsers. */
const findAuthUserByEmail = async (supabase: SupabaseClient, email: string): Promise<User | null> => {
  const target = email.toLowerCase()
  const perPage = 1000
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = data?.users ?? []
    const match = users.find((u) => (u.email ?? '').toLowerCase() === target)
    if (match) return match
    if (users.length < perPage) break
  }
  return null
}

/** Resolve o cargo (rel_user_role -> ref_user_role.code) do usuário. */
const resolveRole = async (
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<string | null> => {
  const { data: rel, error: relError } = await supabase
    .from('rel_user_role')
    .select('id_role')
    .eq('id_user', userId)
    .eq('id_tenant', tenantId)
    .limit(1)
    .maybeSingle()
  if (relError || !rel?.id_role) return null

  const { data: roleRow } = await supabase
    .from('ref_user_role')
    .select('code')
    .eq('id', rel.id_role)
    .maybeSingle()
  return (roleRow?.code as string | undefined) ?? null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail('Metodo nao permitido.', 405)

  try {
    const supabase = getSupabaseAdmin()
    const body = await req.json().catch(() => null)
    if (!isRecord(body)) return fail('Corpo da requisicao invalido.')

    const token = String(body.token || '').trim()
    const refreshToken = String(body.refreshToken || '').trim()
    if (!token && !refreshToken) return fail('Token de acesso nao informado.', 401)

    // Caminho refreshToken → refresh → access → /v2/profile/self → profile.id:
    // PENDENTE de confirmação do contrato SASI (webclient.sasi.com.br).
    // Ver docs/INTEGRACAO-SASI-MOBILE.md (§10/§14/§15). Enquanto não confirmado,
    // não implementamos o fluxo novo — só aceitamos o campo na entrada.
    if (!token && refreshToken) {
      return fail('Fluxo refreshToken ainda nao habilitado (pendente confirmacao SASI).', 501)
    }

    // 1-3. Valida na SASI e extrai o e-mail (não logamos o token).
    const provider = await validateSasiToken(token)
    const providerEmail = getProviderEmail(provider)
    if (!providerEmail) {
      return fail('Email do usuario nao encontrado no retorno da SASI.', 401)
    }

    // 4. Resolve o usuário de eventos por e-mail.
    const { data: users, error: userError } = await supabase
      .from('master_user')
      .select('id, id_tenant, name, email, is_active, id_auth_user')
      .ilike('email', providerEmail)
      .eq('is_active', true)
      .limit(2)

    if (userError) {
      console.error('[exchange-sasi-token] master_user lookup failed:', userError)
      return fail('Erro ao buscar usuario vinculado ao token SASI.', 500)
    }
    if (!users?.length) {
      return fail('Usuario nao encontrado para o email retornado pela SASI.', 403)
    }
    if (users.length > 1) {
      return fail('Mais de um usuario encontrado para o email retornado pela SASI.', 409)
    }

    const user = users[0] as {
      id: string
      id_tenant: string
      name: string | null
      email: string | null
      id_auth_user: string | null
    }

    // 5. Garante o auth.users e concilia master_user.id_auth_user.
    const existingByEmail = await findAuthUserByEmail(supabase, providerEmail)
    let authUserId: string

    if (user.id_auth_user) {
      // Vínculo já existe: se houver um auth user com este e-mail diferente do
      // vinculado, é conflito — não corrigimos cegamente.
      if (existingByEmail && existingByEmail.id !== user.id_auth_user) {
        return fail('Conflito de vinculo de usuario (id_auth_user divergente).', 409)
      }
      authUserId = user.id_auth_user
    } else if (existingByEmail) {
      // Auth user já existe para o e-mail, mas o master_user ainda não estava
      // vinculado: preenche o vínculo.
      authUserId = existingByEmail.id
      const { error: linkError } = await supabase
        .from('master_user')
        .update({ id_auth_user: authUserId })
        .eq('id', user.id)
      if (linkError) {
        console.error('[exchange-sasi-token] link update failed:', linkError)
        return fail('Erro ao vincular usuario de autenticacao.', 500)
      }
    } else {
      // Não há auth user: cria (token SASI já validado => email_confirm).
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: providerEmail,
        email_confirm: true,
      })
      if (createError || !created?.user) {
        console.error('[exchange-sasi-token] createUser failed:', createError)
        return fail('Erro ao criar usuario de autenticacao.', 500)
      }
      authUserId = created.user.id
      const { error: linkError } = await supabase
        .from('master_user')
        .update({ id_auth_user: authUserId })
        .eq('id', user.id)
      if (linkError) {
        console.error('[exchange-sasi-token] link update failed:', linkError)
        return fail('Erro ao vincular usuario de autenticacao.', 500)
      }
    }

    const role = await resolveRole(supabase, user.id, user.id_tenant)

    // 6. Gera magic link (sem enviar e-mail) e devolve o hashed_token.
    const { data: link, error: linkGenError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: providerEmail,
    })
    if (linkGenError || !link?.properties?.hashed_token) {
      console.error('[exchange-sasi-token] generateLink failed:', linkGenError)
      return fail('Erro ao gerar sessao de acesso.', 500)
    }

    console.log('[exchange-sasi-token] session issued for master_user:', user.id, 'auth:', authUserId)

    return json({
      success: true,
      identity: {
        id: user.id,
        tenantId: user.id_tenant,
        name: user.name,
        email: user.email ?? providerEmail,
        role,
      },
      supabaseAuth: {
        email: providerEmail,
        tokenHash: link.properties.hashed_token,
        type: 'magiclink',
      },
    })
  } catch (error) {
    console.error('[exchange-sasi-token] unhandled error:', error)
    const message = error instanceof Error ? error.message : 'Falha ao trocar token.'
    const status = /invalido|expirado/i.test(message) ? 401 : 500
    return fail(message, status)
  }
})
