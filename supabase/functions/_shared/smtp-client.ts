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

  async sendEmail(message: EmailMessage): Promise<void> {
    console.log('📧 Starting email send process');
    console.log(`From: ${this.config.from}`);
    console.log(`To: ${message.to}`);
    console.log(`Subject: ${message.subject}`);

    if (!this.config.from || !this.config.from.includes('@')) {
      throw new Error(`Invalid sender email: ${this.config.from}`);
    }

    let conn: Deno.Conn | null = null;
    let tlsConn: Deno.TlsConn | null = null;

    try {
      conn = await Deno.connect({
        hostname: this.config.host,
        port: this.config.port,
      });
      console.log('✓ TCP connection established');

      await this.readResponse(conn);
      await this.sendCommand(conn, `EHLO ${this.config.host}\r\n`);
      await this.readResponse(conn);
      console.log('✓ Initial EHLO sent');

      await this.sendCommand(conn, 'STARTTLS\r\n');
      await this.readResponse(conn);
      console.log('✓ STARTTLS initiated');

      tlsConn = await Deno.startTls(conn, {
        hostname: this.config.host,
      });
      console.log('✓ TLS connection upgraded');

      await this.sendCommand(tlsConn, `EHLO ${this.config.host}\r\n`);
      await this.readResponse(tlsConn);
      console.log('✓ EHLO after TLS sent');

      await this.sendCommand(tlsConn, 'AUTH LOGIN\r\n');
      await this.readResponse(tlsConn);

      const usernameB64 = btoa(this.config.username);
      await this.sendCommand(tlsConn, `${usernameB64}\r\n`);
      await this.readResponse(tlsConn);

      const passwordB64 = btoa(this.config.password);
      await this.sendCommand(tlsConn, `${passwordB64}\r\n`);
      await this.readResponse(tlsConn);
      console.log('✓ AUTH LOGIN successful');

      await this.sendCommand(tlsConn, `MAIL FROM:<${this.config.from}>\r\n`);
      await this.readResponse(tlsConn);

      await this.sendCommand(tlsConn, `RCPT TO:<${message.to}>\r\n`);
      await this.readResponse(tlsConn);

      await this.sendCommand(tlsConn, 'DATA\r\n');
      await this.readResponse(tlsConn);

      const emailContent = this.buildMIMEMessage(message);
      await this.sendCommand(tlsConn, emailContent);
      await this.readResponse(tlsConn);
      console.log('✓ Email sent successfully');

      try {
        await this.sendCommand(tlsConn, 'QUIT\r\n');
        await this.readResponse(tlsConn);
      } catch (_) {}

      try { if (tlsConn) tlsConn.close(); } catch (_) {}
    } catch (error) {
      console.error('❌ Error during email send:', error);
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
    if (n === null) throw new Error('Connection closed');
    const response = decoder.decode(buffer.subarray(0, n));
    console.log('← SMTP:', response.trim());

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

    mime += `--${boundary}\r\n`;
    mime += `Content-Type: text/plain; charset=UTF-8\r\n`;
    mime += `Content-Transfer-Encoding: 7bit\r\n`;
    mime += `\r\n`;
    mime += `${message.body}\r\n`;
    mime += `\r\n`;

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
}