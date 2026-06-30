import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AWS_LAMBDA_URL = 'https://b83wfxw8bk.execute-api.sa-east-1.amazonaws.com/v1/send-email'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { receiver_email, fields } = await req.json()

    if (!receiver_email || !fields?.nome || !fields?.senha_temporaria || !fields?.link) {
      return new Response(
        JSON.stringify({ error: 'receiver_email and fields (nome, senha_temporaria, link) are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call AWS Lambda
    const response = await fetch(AWS_LAMBDA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        receiver_email,
        subject: 'Primeiro Acesso',
        fields,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return new Response(
        JSON.stringify({ error: errorData.message || `AWS Lambda error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json().catch(() => ({}))
    return new Response(
      JSON.stringify({ success: true, message: data.message || 'Email sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})