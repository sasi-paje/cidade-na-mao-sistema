# 📧 Guia Completo: Envio de Email via AWS SES SMTP em Projetos Lovable + Supabase

> **Documento de referência** extraído de implementação real e funcional.
> Pronto para copiar e usar como prompt no Lovable ou como guia técnico.

---

## 📋 Índice

1. [Prompt para o Lovable](#1-prompt-para-o-lovable)
2. [Arquitetura](#2-arquitetura)
3. [SMTPClient Compartilhado](#3-smtpclient-compartilhado)
4. [Edge Functions](#4-edge-functions)
   - [send-email](#41-send-email)
   - [invite-user](#42-invite-user)
   - [send-password-reset](#43-send-password-reset)
   - [test-smtp-connection](#44-test-smtp-connection)
5. [Configuração](#5-configuração)
6. [Segurança](#6-segurança)
7. [Templates HTML](#7-templates-html)
8. [Checklist de Implementação](#8-checklist-de-implementação)

---

## 1. Prompt para o Lovable

> **Cole este prompt em qualquer novo projeto Lovable para implementar email via AWS SES SMTP:**

```
Implemente envio de emails via AWS SES SMTP usando Supabase Edge Functions (Deno).

ARQUITETURA:
- Crie um SMTPClient compartilhado em supabase/functions/_shared/smtp-client.ts
- O SMTPClient deve implementar a sequência SMTP completa: TCP → EHLO → STARTTLS → TLS upgrade → EHLO → AUTH LOGIN → envio → QUIT
- Use Deno.connect() para TCP, Deno.startTls() para TLS upgrade
- Autenticação AUTH LOGIN com Base64 encoding
- Construção de mensagens MIME multipart/alternative (texto + HTML)

EDGE FUNCTIONS:
1. send-email: função genérica de envio, autenticada apenas por service_role_key (uso interno)
2. invite-user: convite de novos usuários com criação de conta + link de recuperação + email customizado
3. send-password-reset: recuperação de senha com rate limiting e prevenção de enumeração de usuários
4. test-smtp-connection: teste de conexão SMTP, restrito a admins

SEGURANÇA:
- send-email: aceita APENAS service_role_key (chamadas internas entre edge functions)
- invite-user e test-smtp-connection: validam JWT do usuário + verificam role na tabela user_roles
- send-password-reset: verify_jwt=false, com rate limiting (3 requests/5min por email) e respostas genéricas
- NUNCA exponha credenciais SMTP nos logs ou respostas

SECRETS NECESSÁRIAS NO SUPABASE:
- SMTP_SERVER (ex: email-smtp.us-east-1.amazonaws.com)
- SMTP_PORT (ex: 587)
- SMTP_USERNAME (AWS SES SMTP username)
- SMTP_PASSWORD (AWS SES SMTP password)
- SMTP_SENDER_EMAIL (email verificado no SES)
- FRONTEND_URL (URL do frontend para links de redirecionamento)

CONFIG.TOML:
Todas as edge functions com verify_jwt = false (validação é feita no código)
```

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│                                                     │
│  InviteUserDialog ──→ fetch("/functions/v1/invite-user")
│  PasswordReset   ──→ fetch("/functions/v1/send-password-reset")
│  SMTPTest        ──→ fetch("/functions/v1/test-smtp-connection")
└──────────────┬──────────────┬───────────────────────┘
               │              │
               ▼              ▼
┌──────────────────────────────────────────────────────┐
│              Supabase Edge Functions                  │
│                                                      │
│  ┌──────────────┐  ┌─────────────────┐               │
│  │ invite-user  │  │send-password-   │               │
│  │              │  │    reset        │               │
│  │ JWT + Role   │  │ Rate Limiting   │               │
│  │ Check        │  │ No JWT          │               │
│  └──────┬───────┘  └───────┬─────────┘               │
│         │                  │                         │
│         ▼                  ▼                         │
│  ┌──────────────────────────────┐                    │
│  │        send-email            │                    │
│  │  (service_role_key only)     │                    │
│  └──────────┬───────────────────┘                    │
│             │                                        │
│             ▼                                        │
│  ┌──────────────────────────────┐                    │
│  │   _shared/smtp-client.ts     │                    │
│  │  TCP→EHLO→STARTTLS→TLS→AUTH  │                    │
│  └──────────┬───────────────────┘                    │
│             │                                        │
└─────────────┼────────────────────────────────────────┘
              │
              ▼
     ┌─────────────────┐
     │   AWS SES SMTP   │
     │   Port 587       │
     │   STARTTLS       │
     └─────────────────┘
```

---

## 3. SMTPClient Compartilhado

**Arquivo:** `supabase/functions/_shared/smtp-client.ts`

```typescript
interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
}

interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export class SMTPClient {
  private config: SMTPConfig;

  constructor(config: SMTPConfig) {
    this.config = config;
  }

  // Sequência exata: TCP → EHLO → STARTTLS → TLS → EHLO → AUTH LOGIN
  async sendEmail(message: EmailMessage): Promise<void> {
    console.log("📧 Starting email send process");
    console.log(`From: ${this.config.from}`);
    console.log(`To: ${message.to}`);
    console.log(`Subject: ${message.subject}`);

    if (!this.config.from || !this.config.from.includes("@")) {
      throw new Error(`Invalid sender email: ${this.config.from}. Check SMTP_SENDER_EMAIL.`);
    }

    let conn: Deno.Conn | null = null;
    let tlsConn: Deno.TlsConn | null = null;

    try {
      // 1. TCP Connection
      conn = await Deno.connect({
        hostname: this.config.host,
        port: this.config.port,
      });
      console.log("✓ TCP connection established");

      // 2. Ler banner inicial
      await this.readResponse(conn);

      // 3. EHLO inicial
      await this.sendCommand(conn, `EHLO ${this.config.host}\r\n`);
      await this.readResponse(conn);
      console.log("✓ Initial EHLO sent");

      // 4. STARTTLS
      await this.sendCommand(conn, "STARTTLS\r\n");
      await this.readResponse(conn);
      console.log("✓ STARTTLS initiated");

      // 5. Upgrade para TLS
      tlsConn = await Deno.startTls(conn, {
        hostname: this.config.host,
      });
      console.log("✓ TLS connection upgraded");

      // 6. EHLO após TLS
      await this.sendCommand(tlsConn, `EHLO ${this.config.host}\r\n`);
      await this.readResponse(tlsConn);
      console.log("✓ EHLO after TLS sent");

      // 7. AUTH LOGIN
      await this.sendCommand(tlsConn, "AUTH LOGIN\r\n");
      await this.readResponse(tlsConn);

      const usernameB64 = btoa(this.config.username);
      await this.sendCommand(tlsConn, `${usernameB64}\r\n`);
      await this.readResponse(tlsConn);

      const passwordB64 = btoa(this.config.password);
      await this.sendCommand(tlsConn, `${passwordB64}\r\n`);
      await this.readResponse(tlsConn);
      console.log("✓ AUTH LOGIN successful");

      // 8. Enviar email
      await this.sendCommand(tlsConn, `MAIL FROM:<${this.config.from}>\r\n`);
      await this.readResponse(tlsConn);

      await this.sendCommand(tlsConn, `RCPT TO:<${message.to}>\r\n`);
      await this.readResponse(tlsConn);

      await this.sendCommand(tlsConn, "DATA\r\n");
      await this.readResponse(tlsConn);

      const emailContent = this.buildMIMEMessage(message);
      await this.sendCommand(tlsConn, emailContent);
      await this.readResponse(tlsConn);
      console.log("✓ Email sent successfully");

      // 9. QUIT
      try {
        await this.sendCommand(tlsConn, "QUIT\r\n");
        await this.readResponse(tlsConn);
      } catch (_) {
        console.log("⚠ QUIT command failed (non-critical)");
      }

      try { if (tlsConn) tlsConn.close(); } catch (_) {}
    } catch (error) {
      console.error("❌ Error during email send:", error);
      try { if (tlsConn) tlsConn.close(); } catch (_) {}
      try { if (conn) conn.close(); } catch (_) {}
      throw error;
    }
  }

  private async sendCommand(conn: Deno.Conn, command: string): Promise<void> {
    const encoder = new TextEncoder();
    await conn.write(encoder.encode(command));
  }

  private async readResponse(conn: Deno.Conn): Promise<string> {
    const decoder = new TextDecoder();
    const buffer = new Uint8Array(4096);
    const n = await conn.read(buffer);
    if (n === null) throw new Error("Connection closed");
    const response = decoder.decode(buffer.subarray(0, n));
    console.log("← SMTP:", response.trim());

    const code = parseInt(response.substring(0, 3));
    if (code >= 400) {
      throw new Error(`SMTP Error ${code}: ${response}`);
    }

    return response;
  }

  private buildMIMEMessage(message: EmailMessage): string {
    const boundary = `----=_Part_${Date.now()}`;
    const date = new Date().toUTCString();

    let mime = `From: ${this.config.from}\r\n`;
    mime += `To: ${message.to}\r\n`;
    mime += `Subject: ${message.subject}\r\n`;
    mime += `Date: ${date}\r\n`;
    mime += `MIME-Version: 1.0\r\n`;
    mime += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
    mime += `\r\n`;

    // Texto plano
    mime += `--${boundary}\r\n`;
    mime += `Content-Type: text/plain; charset=UTF-8\r\n`;
    mime += `Content-Transfer-Encoding: 7bit\r\n`;
    mime += `\r\n`;
    mime += `${message.body}\r\n`;
    mime += `\r\n`;

    // HTML (opcional)
    if (message.html) {
      mime += `--${boundary}\r\n`;
      mime += `Content-Type: text/html; charset=UTF-8\r\n`;
      mime += `Content-Transfer-Encoding: 7bit\r\n`;
      mime += `\r\n`;
      mime += `${message.html}\r\n`;
      mime += `\r\n`;
    }

    mime += `--${boundary}--\r\n`;
    mime += `.\r\n`;

    return mime;
  }

  // Teste de conexão (mesma sequência, sem envio)
  async testConnection(): Promise<boolean> {
    console.log("🔍 Testing SMTP connection...");
    let conn: Deno.Conn | null = null;
    let tlsConn: Deno.TlsConn | null = null;

    try {
      conn = await Deno.connect({ hostname: this.config.host, port: this.config.port });
      await this.readResponse(conn);
      await this.sendCommand(conn, `EHLO ${this.config.host}\r\n`);
      await this.readResponse(conn);
      await this.sendCommand(conn, "STARTTLS\r\n");
      await this.readResponse(conn);
      tlsConn = await Deno.startTls(conn, { hostname: this.config.host });
      await this.sendCommand(tlsConn, `EHLO ${this.config.host}\r\n`);
      await this.readResponse(tlsConn);
      await this.sendCommand(tlsConn, "AUTH LOGIN\r\n");
      await this.readResponse(tlsConn);
      await this.sendCommand(tlsConn, `${btoa(this.config.username)}\r\n`);
      await this.readResponse(tlsConn);
      await this.sendCommand(tlsConn, `${btoa(this.config.password)}\r\n`);
      await this.readResponse(tlsConn);
      console.log("✅ Authentication successful");
      try { await this.sendCommand(tlsConn, "QUIT\r\n"); await this.readResponse(tlsConn); } catch (_) {}
      try { if (tlsConn) tlsConn.close(); } catch (_) {}
      return true;
    } catch (error) {
      console.error("❌ Connection test failed:", error);
      try { if (tlsConn) tlsConn.close(); } catch (_) {}
      try { if (conn) conn.close(); } catch (_) {}
      return false;
    }
  }
}
```

---

## 4. Edge Functions

### 4.1 send-email

**Arquivo:** `supabase/functions/send-email/index.ts`

Função genérica de envio, usada internamente pelas outras edge functions.
Aceita **apenas** `SUPABASE_SERVICE_ROLE_KEY` como autenticação.

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "../_shared/smtp-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Autenticação: apenas service_role_key
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (token !== serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: internal use only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to, subject, body, html }: SendEmailRequest = await req.json();

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar SMTP secrets
    const smtpServer = Deno.env.get("SMTP_SERVER");
    const smtpPort = Deno.env.get("SMTP_PORT");
    const smtpUsername = Deno.env.get("SMTP_USERNAME");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const smtpSender = Deno.env.get("SMTP_SENDER_EMAIL");

    if (!smtpServer || !smtpPort || !smtpUsername || !smtpPassword || !smtpSender) {
      return new Response(
        JSON.stringify({ error: "SMTP configuration incomplete" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const smtpClient = new SMTPClient({
      host: smtpServer,
      port: parseInt(smtpPort),
      username: smtpUsername,
      password: smtpPassword,
      from: smtpSender,
    });

    await smtpClient.sendEmail({ to, subject, body, html });

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### 4.2 invite-user

**Arquivo:** `supabase/functions/invite-user/index.ts`

Fluxo: valida JWT → verifica role (admin/super_admin) → cria usuário → gera link recovery → envia email customizado via send-email.

**Pontos-chave:**
- Valida JWT do chamador via `supabase.auth.getUser(token)`
- Verifica role na tabela `user_roles` (não em `profiles`)
- `super_admin` pode definir role; `admin` só cria `user`
- Cria usuário com `auth.admin.createUser()` + senha temporária
- Insere role em `user_roles` com upsert
- Gera link de recovery via `auth.admin.generateLink()`
- Chama `send-email` internamente com `service_role_key`

```typescript
// Padrão de chamada interna para send-email:
const sendEmailResponse = await fetch(
  `${supabaseUrl}/functions/v1/send-email`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseServiceKey}`, // service_role_key
    },
    body: JSON.stringify({
      to: email,
      subject: "Convite para acessar o sistema",
      body: emailBody,     // texto plano
      html: emailHtml,     // HTML formatado
    }),
  }
);
```

### 4.3 send-password-reset

**Arquivo:** `supabase/functions/send-password-reset/index.ts`

Fluxo: rate limiting → valida email → verifica existência (sem revelar) → gera link recovery → envia email.

**Pontos-chave de segurança:**
- `verify_jwt = false` (qualquer pessoa pode solicitar reset)
- Rate limiting: 3 requests por email a cada 5 minutos
- Respostas genéricas: sempre retorna sucesso (previne enumeração de usuários)
- Mesmo em caso de erro, retorna mensagem genérica de sucesso

```typescript
// Rate limiting em memória
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutos
const MAX_REQUESTS_PER_WINDOW = 3;

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }
  if (record.count >= MAX_REQUESTS_PER_WINDOW) return true;
  record.count++;
  return false;
}
```

### 4.4 test-smtp-connection

**Arquivo:** `supabase/functions/test-smtp-connection/index.ts`

Testa conexão SMTP sem enviar email. Restrito a admins.

**Padrão de verificação de role:**
```typescript
const { data: userRole } = await supabaseAdmin
  .from("user_roles")
  .select("role")
  .eq("user_id", user.id)
  .single();

if (!userRole || userRole.role !== "admin") {
  return new Response(
    JSON.stringify({ error: "Admin access required" }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

---

## 5. Configuração

### 5.1 Secrets do Supabase

Configure em **Supabase Dashboard → Settings → Edge Functions → Secrets**:

| Secret | Exemplo | Descrição |
|--------|---------|-----------|
| `SMTP_SERVER` | `email-smtp.us-east-1.amazonaws.com` | Endpoint SMTP do AWS SES |
| `SMTP_PORT` | `587` | Porta SMTP (587 para STARTTLS) |
| `SMTP_USERNAME` | `AKIA...` | Credencial SMTP do SES (diferente do IAM!) |
| `SMTP_PASSWORD` | `BDsa...` | Senha SMTP do SES |
| `SMTP_SENDER_EMAIL` | `noreply@seudominio.com` | Email verificado no SES |
| `FRONTEND_URL` | `https://seuapp.com` | URL do frontend para links |

> ⚠️ **As credenciais SMTP do SES são diferentes das credenciais IAM!**
> Gere-as em: AWS Console → SES → SMTP Settings → Create SMTP credentials

### 5.2 config.toml

```toml
[functions.send-email]
verify_jwt = false

[functions.invite-user]
verify_jwt = false

[functions.send-password-reset]
verify_jwt = false

[functions.test-smtp-connection]
verify_jwt = false
```

> Todas com `verify_jwt = false` porque a validação é feita no código de cada função.

### 5.3 Estrutura de Pastas

```
supabase/
├── config.toml
└── functions/
    ├── _shared/
    │   └── smtp-client.ts          # SMTPClient compartilhado
    ├── send-email/
    │   └── index.ts                # Envio genérico (interno)
    ├── invite-user/
    │   └── index.ts                # Convite de usuários
    ├── send-password-reset/
    │   └── index.ts                # Recuperação de senha
    └── test-smtp-connection/
        └── index.ts                # Teste de conexão SMTP
```

---

## 6. Segurança

### 6.1 Modelo de Autenticação por Função

| Função | Autenticação | Autorização |
|--------|-------------|-------------|
| `send-email` | `service_role_key` apenas | Nenhuma (uso interno) |
| `invite-user` | JWT do usuário | `admin` ou `super_admin` via `user_roles` |
| `send-password-reset` | Nenhuma (público) | Rate limiting por email |
| `test-smtp-connection` | JWT do usuário | `admin` via `user_roles` |

### 6.2 Tabela user_roles (Fonte de verdade para autorização)

```sql
-- NUNCA use profiles.role para verificação de permissões em Edge Functions
-- Sempre use user_roles (tabela separada com RLS)

CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'manager', 'super_admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
```

### 6.3 Padrão de Verificação de Role nas Edge Functions

```typescript
// 1. Validar JWT
const { data: { user }, error } = await supabaseClient.auth.getUser(token);
if (error || !user) return 401;

// 2. Verificar role via service_role_key (bypassa RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const { data: userRole } = await supabaseAdmin
  .from("user_roles")
  .select("role")
  .eq("user_id", user.id)
  .single();

// 3. Verificar permissão
if (!userRole || !["admin", "super_admin"].includes(userRole.role)) {
  return 403;
}
```

### 6.4 Prevenção de Enumeração de Usuários

No `send-password-reset`, SEMPRE retorne a mesma resposta:

```typescript
// Mesmo se o email não existir ou ocorrer erro:
return new Response(
  JSON.stringify({
    success: true,
    message: "If this email exists, a password reset link will be sent"
  }),
  { status: 200 }
);
```

---

## 7. Templates HTML

### 7.1 Template de Convite

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 8px; margin-top: 20px; }
    .button { display: inline-block; background-color: #4F46E5; color: #ffffff !important;
              padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .info { background-color: #e0e7ff; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Bem-vindo ao [SISTEMA]</h1>
    </div>
    <div class="content">
      <p>Olá <strong>[NOME]</strong>,</p>
      <p>Você foi convidado para acessar o sistema.</p>
      <p>Clique no botão abaixo para definir sua senha:</p>
      <a href="[LINK]" class="button">Definir Senha</a>
      <div class="info">
        <p><strong>Sua função:</strong> [ROLE]</p>
      </div>
      <p><strong>Este link expirará em 1 hora.</strong></p>
    </div>
    <div class="footer">
      <p>Atenciosamente,<br>Equipe [SISTEMA]</p>
    </div>
  </div>
</body>
</html>
```

### 7.2 Template de Reset de Senha

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 8px; margin-top: 20px; }
    .button { display: inline-block; background-color: #4F46E5; color: #ffffff !important;
              padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Redefinir Senha</h1>
    </div>
    <div class="content">
      <p>Olá,</p>
      <p>Recebemos uma solicitação para redefinir sua senha.</p>
      <p>Clique no botão abaixo para criar uma nova senha:</p>
      <a href="[LINK]" class="button">Redefinir Senha</a>
      <p><strong>Este link expirará em 1 hora</strong> por motivos de segurança.</p>
      <p>Se você não solicitou a redefinição, ignore este email.</p>
    </div>
    <div class="footer">
      <p>Atenciosamente,<br>Equipe [SISTEMA]</p>
    </div>
  </div>
</body>
</html>
```

---

## 8. Checklist de Implementação

### Pré-requisitos AWS

- [ ] Conta AWS com SES configurado
- [ ] SES fora do sandbox (ou domínio/email verificado para teste)
- [ ] Credenciais SMTP geradas (SES → SMTP Settings → Create SMTP credentials)
- [ ] Email de envio (From) verificado no SES

### Supabase

- [ ] Criar tabela `user_roles` com enum `app_role`
- [ ] Habilitar RLS em `user_roles`
- [ ] Criar função `has_role()` (SECURITY DEFINER)
- [ ] Configurar secrets (SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_SENDER_EMAIL, FRONTEND_URL)

### Edge Functions

- [ ] Criar `_shared/smtp-client.ts`
- [ ] Criar `send-email/index.ts`
- [ ] Criar `invite-user/index.ts`
- [ ] Criar `send-password-reset/index.ts`
- [ ] Criar `test-smtp-connection/index.ts`
- [ ] Configurar `config.toml` com `verify_jwt = false` para todas

### Frontend

- [ ] Dialog de convite de usuário com campos: email, nome, role
- [ ] Dialog de reset de senha com campo de email
- [ ] Página `/reset-password` para receber o link de recovery
- [ ] Botão de teste de conexão SMTP (admin only)

### Testes

- [ ] Testar conexão SMTP via test-smtp-connection
- [ ] Enviar convite de teste
- [ ] Testar reset de senha
- [ ] Verificar rate limiting (4+ requests em 5min)
- [ ] Verificar que não-admins recebem 403

---

## 📝 Notas Importantes

1. **AWS SES Sandbox**: Em modo sandbox, você só pode enviar para emails verificados. Solicite saída do sandbox para produção.

2. **Credenciais SMTP ≠ IAM**: As credenciais SMTP do SES são geradas separadamente e são diferentes das access keys do IAM.

3. **Porta 587**: Use sempre porta 587 com STARTTLS. Porta 465 (SSL direto) não é suportada por este SMTPClient.

4. **Rate Limiting**: O rate limiting em memória é por instância da Edge Function. Em cenários de alta disponibilidade, considere rate limiting via banco de dados.

5. **Sync de Roles**: Mantenha `profiles.role` e `user_roles.role` sincronizados com um trigger de banco de dados para evitar inconsistências.

---

*Documento gerado a partir do projeto SASI/PagaFogo — implementação real e testada em produção.*
