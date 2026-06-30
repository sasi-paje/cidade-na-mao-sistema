import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AWS_LAMBDA_URL = 'https://b83wfxw8bk.execute-api.sa-east-1.amazonaws.com/v1/send-email'
const AWS_API_KEY = 'CBXYuDom0PFmFu6a4Yo3MlOQn7K81cNwRR6kTXDYlYFysb6z0jqNUsMcCbDkZkeR1IzQBwlRf0GRyMyCg0vnssKgUlccD3VMvuB4'

// Hashfixo para o template (pode ser qualquer string única)
const HTML_HASH = 'bellog_first_access_template_v1'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { receiver_email, fields } = await req.json()

    if (!receiver_email || !fields) {
      return new Response(
        JSON.stringify({ error: 'receiver_email e fields são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const response = await fetch(AWS_LAMBDA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': AWS_API_KEY
      },
      body: JSON.stringify({
        html_hash: HTML_HASH,
        receiver_email: receiver_email,
        subject: 'Primeiro Acesso',
        display_name: 'Sistema Bellog',
        fields: fields
      }),
    })

    const data = await response.json().catch(() => ({}))
    console.log('[Edge Function] Lambda response:', data)

    return new Response(
      JSON.stringify({ success: true, message: data.message || 'Email enviado' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[Edge Function] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})