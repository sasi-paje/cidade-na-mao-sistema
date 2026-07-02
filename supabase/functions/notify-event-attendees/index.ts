import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from '../_shared/smtp-client.ts'

// =====================================================================
// notify-event-attendees — notifica os INSCRITOS CONFIRMADOS de um evento
// quando o evento é INATIVADO ou EDITADO pelo admin (web /web/eventos).
//
// Segurança/tenant:
//  - Usa o JWT do admin chamador (Authorization) para ler os inscritos sob
//    RLS — o mesmo caminho da aba "Pessoas Confirmadas". Assim o tenant é
//    garantido pelo próprio Supabase (não vaza dados entre tenants) e só um
//    admin autenticado consegue enumerar os inscritos.
//  - O envio usa SMTP (mesma infra de `send-email`/`_shared/smtp-client`).
//    Branding SASI / Cidade na Mão — sem marca legada.
//
// Não notifica presenças canceladas (só `confirmed`) nem e-mails inválidos.
// Falha de envio é isolada por destinatário (não desfaz a ação do admin).
// =====================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ChangeType = 'inactivated' | 'updated'

interface NotifyRequest {
  id_event: string
  id_slot?: string | null
  change_type: ChangeType
  /** Dados de exibição (já formatados no front) para compor a mensagem. */
  event: { title: string; date: string; time: string; location: string }
  /** Linhas legíveis do que mudou (só para `updated`). */
  changes?: string[]
}

interface AttendeeRow {
  id: string
  user: { name: string | null; email: string | null } | null
  status: { code: string } | null
}

const SIGNATURE = 'Cidade na Mão'

function isValidEmail(email: string | null | undefined): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function buildMessage(
  changeType: ChangeType,
  ev: NotifyRequest['event'],
  name: string | null,
  changes?: string[],
): { subject: string; body: string } {
  const safeName = (name ?? '').trim() || 'participante'
  if (changeType === 'inactivated') {
    return {
      subject: `Evento inativado: ${ev.title}`,
      body:
        `Olá, ${safeName}. O evento "${ev.title}", previsto para ${ev.date} às ${ev.time} em ` +
        `${ev.location}, foi inativado. Caso tenha dúvidas, entre em contato com a organização.` +
        `\n\n— ${SIGNATURE}`,
    }
  }
  const lines = [
    `Olá, ${safeName}. O evento "${ev.title}" teve informações atualizadas.`,
    ...(changes && changes.length > 0 ? ['', ...changes] : []),
    '',
    'Caso tenha dúvidas, entre em contato com a organização.',
    '',
    `— ${SIGNATURE}`,
  ]
  return { subject: `Evento atualizado: ${ev.title}`, body: lines.join('\n') }
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Authorization required' }, 401)
    }

    const body = (await req.json()) as NotifyRequest
    if (!body?.id_event || !body?.change_type || !body?.event?.title) {
      return json({ error: 'Campos obrigatórios: id_event, change_type, event.title' }, 400)
    }
    if (body.change_type !== 'inactivated' && body.change_type !== 'updated') {
      return json({ error: 'change_type inválido' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !anonKey) {
      return json({ error: 'Supabase env incomplete' }, 500)
    }

    // Cliente sob o JWT do admin chamador → RLS aplica tenant + visibilidade.
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    let query = supabase
      .from('trx_event_attendance')
      .select('id, user:master_user(name, email), status:ref_attendance_status(code)')
      .eq('id_event', body.id_event)
    if (body.id_slot) query = query.eq('id_slot', body.id_slot)

    const { data, error } = await query
    if (error) {
      console.error('notify-event-attendees: erro ao ler inscritos:', error.message)
      return json({ error: error.message }, 403)
    }

    const confirmed = ((data ?? []) as unknown as AttendeeRow[]).filter(
      (r) => r.status?.code === 'confirmed',
    )
    const withEmail = confirmed.filter((r) => isValidEmail(r.user?.email))
    const skipped_no_email = confirmed.length - withEmail.length

    // Sem ninguém a notificar: retorna cedo (não é erro).
    if (withEmail.length === 0) {
      return json({ total: confirmed.length, sent: 0, failed: 0, skipped_no_email }, 200)
    }

    const smtpServer = Deno.env.get('SMTP_SERVER')
    const smtpPort = Deno.env.get('SMTP_PORT')
    const smtpUsername = Deno.env.get('SMTP_USERNAME')
    const smtpPassword = Deno.env.get('SMTP_PASSWORD')
    const smtpSender = Deno.env.get('SMTP_SENDER_EMAIL')
    if (!smtpServer || !smtpPort || !smtpUsername || !smtpPassword || !smtpSender) {
      return json({ error: 'SMTP configuration incomplete' }, 500)
    }

    const smtp = new SMTPClient({
      host: smtpServer,
      port: parseInt(smtpPort),
      username: smtpUsername,
      password: smtpPassword,
      from: smtpSender,
    })

    let sent = 0
    let failed = 0
    for (const r of withEmail) {
      const { subject, body: text } = buildMessage(body.change_type, body.event, r.user!.name, body.changes)
      try {
        await smtp.sendEmail({ to: r.user!.email!, subject, body: text })
        sent++
      } catch (e) {
        failed++
        // Registra a falha (sem vazar corpo/e-mail em nível de erro sensível).
        console.error('notify-event-attendees: falha ao enviar para inscrito:', (e as Error)?.message)
      }
    }

    return json({ total: confirmed.length, sent, failed, skipped_no_email }, 200)
  } catch (error) {
    console.error('notify-event-attendees error:', (error as Error)?.message)
    return json({ error: (error as Error)?.message ?? 'Erro interno' }, 500)
  }
})
