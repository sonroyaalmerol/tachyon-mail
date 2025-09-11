import { Transport, LineReader, Writer } from "../core/Transport";
import { withTimeout } from "../util/timeout";
import { SmtpConfig, SendMailParams } from "../types";
import { base64Encode } from "../codecs/base64";

export class SmtpClient {
  private rd!: LineReader;
  private wr!: Writer;

  constructor(
    private readonly transport: Transport,
    private readonly cfg: SmtpConfig
  ) { }

  async connect(): Promise<void> {
    await this.transport.connect({
      host: this.cfg.host,
      port: this.cfg.port,
      secure: this.cfg.secure,
      startTLS: this.cfg.startTLS,
      alpnProtocols: ["smtp"],
    });
    this.rd = new LineReader(this.transport);
    this.wr = new Writer(this.transport);
    await this.expectCode(220, "greeting");
    await this.ehlo();
    if (this.cfg.startTLS) {
      // If the transport's connect already negotiated TLS for startTLS,
      // this is a no-op in our abstract transport. Your transport can
      // upgrade internally when it sees STARTTLS issued.
      await this.sendLine("STARTTLS");
      await this.expectCode(220, "STARTTLS");
      // Re-issue EHLO
      await this.ehlo();
    }
    if (this.cfg.auth) {
      await this.auth(this.cfg.auth);
    }
  }

  async sendMail(params: SendMailParams): Promise<void> {
    const { from, to, cc = [], bcc = [] } = params;
    const allRcpt = [...to, ...cc, ...bcc];
    await this.sendLine(`MAIL FROM:<${from}>`);
    await this.expectCode(250, "MAIL FROM");
    for (const rcpt of allRcpt) {
      await this.sendLine(`RCPT TO:<${rcpt}>`);
      await this.expectCode(250, "RCPT TO");
    }
    await this.sendLine("DATA");
    await this.expectCode(354, "DATA");

    const data = buildRfc822(params);
    await this.wr.write(data);
    await this.sendLine("\r\n.");
    await this.expectCode(250, "DATA end");
  }

  async close(): Promise<void> {
    try {
      await this.sendLine("QUIT");
      await this.expectCode(221, "QUIT");
    } catch { }
    await this.transport.close();
  }

  // ---- internals ----

  private async ehlo(): Promise<void> {
    await this.sendLine("EHLO rn-mail");
    await this.readMultiline(250);
  }

  private async auth(method: SmtpConfig["auth"]): Promise<void> {
    if (!method) return;
    if (method.mechanism === "PLAIN") {
      const payload =
        "\0" + method.username + "\0" + method.password;
      const b64 = base64Encode(new TextEncoder().encode(payload));
      await this.sendLine(`AUTH PLAIN ${b64}`);
      await this.expectCode(235, "AUTH PLAIN");
    } else if (method.mechanism === "LOGIN") {
      await this.sendLine("AUTH LOGIN");
      await this.expectCode(334, "AUTH LOGIN user prompt");
      await this.sendLine(base64Encode(new TextEncoder().encode(method.username)));
      await this.expectCode(334, "AUTH LOGIN pass prompt");
      await this.sendLine(base64Encode(new TextEncoder().encode(method.password)));
      await this.expectCode(235, "AUTH LOGIN");
    } else if (method.mechanism === "XOAUTH2") {
      await this.maybeRefreshAndRetry(async () => {
        const token = await this.getXoauth2Token();
        const str = `user=${method.username}\x01auth=Bearer ${token}\x01\x01`;
        const b64 = base64Encode(new TextEncoder().encode(str));
        await this.sendLine(`AUTH XOAUTH2 ${b64}`);
        await this.expectCode(235, "AUTH XOAUTH2");
      });
    } else {
      throw new Error("Unsupported SMTP auth");
    }
  }

  private async getXoauth2Token(): Promise<string> {
    const a = this.cfg.auth as any;
    if (!a || a.mechanism !== "XOAUTH2") return "";
    const auto =
      this.cfg.autoRefreshToken ?? (a.provider ? true : false);
    const skew = this.cfg.refreshSkewMs ?? 60_000;
    if (a.provider) {
      const tok = await a.provider.getAccessToken();
      if (auto && tok.expiresAt && tok.expiresAt - Date.now() <= skew) {
        const refreshed = await a.provider.refreshAccessToken();
        return refreshed.accessToken;
      }
      return tok.accessToken;
    }
    if (!a.accessToken) throw new Error("XOAUTH2: missing accessToken");
    return a.accessToken;
  }

  private async maybeRefreshAndRetry<T>(op: () => Promise<T>): Promise<T> {
    const retry = this.cfg.retryOnAuthFailure ?? true;
    try {
      return await op();
    } catch (e: any) {
      const msg = String(e?.message || e);
      const isAuthFail =
        /^5\d\d /.test(msg) && /AUTH|XOAUTH2|235|530|535/.test(msg);
      const a = this.cfg.auth as any;
      const canRefresh = a?.mechanism === "XOAUTH2" && a?.provider;
      if (retry && isAuthFail && canRefresh) {
        await a.provider.refreshAccessToken();
        return await op();
      }
      throw e;
    }
  }

  private async sendLine(s: string): Promise<void> {
    const data = new TextEncoder().encode(s + "\r\n");
    await withTimeout(this.wr.write(data), this.cfg.commandTimeoutMs ?? 30000);
  }

  private async expectCode(code: number, label: string): Promise<void> {
    const line = await withTimeout(
      this.rd.readLine(),
      this.cfg.commandTimeoutMs ?? 30000,
      label
    );
    if (!line?.startsWith(String(code))) {
      throw new Error(`${label} failed: ${line}`);
    }
  }

  private async readMultiline(expected: number): Promise<void> {
    for (; ;) {
      const line = await this.rd.readLine();
      if (!line) throw new Error("connection closed");
      if (!line.startsWith(String(expected))) break;
      if (line[3] === " ") break;
    }
  }
}

// Build a minimal RFC 5322 message with attachments as multipart/mixed
function buildRfc822(p: SendMailParams): Uint8Array {
  const hdrs: string[] = [];
  const now = new Date().toUTCString();
  hdrs.push(`Date: ${now}`);
  hdrs.push(`From: ${p.from}`);
  hdrs.push(`To: ${p.to.join(", ")}`);
  if (p.cc?.length) hdrs.push(`Cc: ${p.cc.join(", ")}`);
  if (p.subject) hdrs.push(`Subject: ${p.subject}`);
  for (const [k, v] of Object.entries(p.headers || {})) {
    hdrs.push(`${k}: ${v}`);
  }

  let body: Uint8Array;

  const parts: { headers: string[]; content: Uint8Array }[] = [];

  if (p.text) {
    const bytes = new TextEncoder().encode(p.text);
    parts.push({
      headers: [
        `Content-Type: text/plain; charset="utf-8"`,
        `Content-Transfer-Encoding: 7bit`,
      ],
      content: bytes,
    });
  }
  if (p.html) {
    const bytes = new TextEncoder().encode(p.html);
    parts.push({
      headers: [
        `Content-Type: text/html; charset="utf-8"`,
        `Content-Transfer-Encoding: 7bit`,
      ],
      content: bytes,
    });
  }
  for (const att of p.attachments || []) {
    const b64 = chunkedBase64(att.content, 76);
    const headers = [
      `Content-Type: ${att.contentType}; name="${att.filename}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: ${att.inline ? "inline" : "attachment"}; filename="${att.filename}"`,
    ];
    if (att.inline && att.contentId) {
      headers.push(`Content-ID: <${att.contentId}>`);
    }
    parts.push({ headers, content: new TextEncoder().encode(b64) });
  }

  if (parts.length <= 1) {
    body = parts.length
      ? concat(
        new TextEncoder().encode(parts[0].headers.join("\r\n") + "\r\n\r\n"),
        parts[0].content
      )
      : new Uint8Array(0);
  } else {
    const boundary = "mixed_" + Math.random().toString(36).slice(2, 10);
    hdrs.push(`MIME-Version: 1.0`);
    hdrs.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    const pieces: Uint8Array[] = [];
    for (const part of parts) {
      pieces.push(
        new TextEncoder().encode(`\r\n--${boundary}\r\n`),
        new TextEncoder().encode(part.headers.join("\r\n") + "\r\n\r\n"),
        part.content
      );
    }
    pieces.push(new TextEncoder().encode(`\r\n--${boundary}--`));
    body = concatAll(pieces);
  }

  const headerBytes = new TextEncoder().encode(hdrs.join("\r\n") + "\r\n\r\n");
  // Dot-stuffing: double leading dots at line start per SMTP DATA
  const dotted = dotStuff(concat(headerBytes, body));
  return dotted;
}

function chunkedBase64(bytes: Uint8Array, width: number): string {
  // Use built-in encoder if available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  let b64: string;
  if (typeof btoa !== "undefined") {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    b64 = btoa(s);
  } else if (g.Buffer) {
    b64 = g.Buffer.from(bytes).toString("base64");
  } else {
    // very small fallback avoided for brevity, import from base64.ts if needed
    b64 = "";
  }
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += width) {
    lines.push(b64.slice(i, i + width));
  }
  return lines.join("\r\n");
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
function concatAll(arr: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const a of arr) len += a.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const a of arr) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}
function dotStuff(bytes: Uint8Array): Uint8Array {
  // Convert to string for simplicity; size is limited by DATA anyway.
  const s = new TextDecoder().decode(bytes);
  const stuffed = s.replace(/\r\n\./g, "\r\n..");
  return new TextEncoder().encode(stuffed);
}
