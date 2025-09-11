import { Transport, LineReader, Writer } from "../core/Transport";
import { withTimeout } from "../util/timeout";
import { encodeUtf7Imap, decodeUtf7Imap } from "../codecs/utf7imap";
import { ascii } from "../codecs/mime";
import {
  ImapConfig,
  MailboxInfo,
  Envelope,
  FetchBodySpec,
  BodyResult,
  AppendOptions,
} from "../types";

type Capabilities = {
  auth: string[];
  idle: boolean;
  literalPlus: boolean;
  uidplus: boolean;
};

export class ImapClient {
  private tagCounter = 0;
  private rd!: LineReader;
  private wr!: Writer;
  private caps: Capabilities = {
    auth: [],
    idle: false,
    literalPlus: false,
    uidplus: false,
  };
  private selectedMailbox?: string;
  private closed = false;

  constructor(
    private readonly transport: Transport,
    private readonly cfg: ImapConfig
  ) { }

  async connect(): Promise<void> {
    await this.transport.connect({
      host: this.cfg.host,
      port: this.cfg.port,
      secure: this.cfg.secure,
      startTLS: this.cfg.startTLS,
      alpnProtocols: ["imap"],
    });
    this.rd = new LineReader(this.transport);
    this.wr = new Writer(this.transport);

    // Greet
    const greet = await this.readLineSafe("greeting");
    if (!greet.includes("OK")) {
      throw new Error("IMAP greeting failed: " + greet);
    }
    await this.capability();
    await this.authenticate();
    if (this.cfg.clientId) {
      // RFC 2971 ID
      const kv = Object.entries(this.cfg.clientId)
        .map(([k, v]) => `"${k}" "${v}"`)
        .join(" ");
      await this.simple(`ID (${kv})`);
      // ignore result
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    try {
      await this.simple("LOGOUT");
    } catch { }
    await this.transport.close();
  }

  isConnected(): boolean {
    return this.transport.isConnected();
  }

  async listMailboxes(): Promise<MailboxInfo[]> {
    const tag = this.nextTag();
    await this.sendLine(`${tag} LIST "" "*"`);
    const boxes: MailboxInfo[] = [];
    for (; ;) {
      const line = await this.readLineSafe("LIST");
      if (line.startsWith(tag)) {
        if (!line.includes("OK")) throw new Error("LIST failed: " + line);
        break;
      }
      if (line.includes(" LIST ")) {
        // * LIST (\HasNoChildren) "/" "INBOX"
        const m = /\* LIST \(([^)]*)\) "([^"]+)" "([^"]+)"/.exec(line);
        if (m) {
          const attrs = m[1].split(" ").filter(Boolean);
          const delim = m[2];
          const raw = m[3];
          const name = decodeUtf7Imap(raw);
          boxes.push({
            name,
            path: name.split(delim).join("/"),
            attributes: attrs,
          });
        }
      }
    }
    return boxes;
  }

  async selectMailbox(name: string): Promise<{ exists: number; unseen?: number }> {
    const mailboxEnc = encodeUtf7Imap(name);
    const tag = this.nextTag();
    await this.sendLine(`${tag} SELECT "${mailboxEnc}"`);
    let exists = 0;
    let unseen: number | undefined;
    for (; ;) {
      const line = await this.readLineSafe("SELECT");
      if (line.startsWith("* ") && line.includes("EXISTS")) {
        exists = parseInt(line.split(" ")[1], 10);
      } else if (line.startsWith("* OK") && line.includes("[UNSEEN ")) {
        const m = /\[UNSEEN (\d+)\]/.exec(line);
        if (m) unseen = parseInt(m[1], 10);
      } else if (line.startsWith(tag)) {
        if (!line.includes("OK")) throw new Error("SELECT failed: " + line);
        this.selectedMailbox = name;
        break;
      }
    }
    return { exists, unseen };
  }

  async fetchEnvelopesByUid(
    uids: number[],
    opts?: { maxPreviewBytes?: number }
  ): Promise<Envelope[]> {
    this.ensureSelected()
    if (uids.length === 0) return [];
    const maxPreviewBytes = opts?.maxPreviewBytes ?? 512;
    // Batch into ranges to keep commands short
    const ranges = compressUidList(uids);
    const wants = `UID FLAGS RFC822.SIZE BODY.PEEK[HEADER.FIELDS (DATE SUBJECT FROM TO CC BCC IN-REPLY-TO MESSAGE-ID)] BODY.PEEK[TEXT]<0.${maxPreviewBytes}> BODYSTRUCTURE`;
    const tag = this.nextTag();
    await this.sendLine(`${tag} UID FETCH ${ranges} (${wants})`);

    const results = new Map<number, Envelope>();
    for (; ;) {
      const line = await this.readLineSafe("FETCH");
      if (line.startsWith(tag)) {
        if (!line.includes("OK")) throw new Error("FETCH failed: " + line);
        break;
      }
      if (!line.startsWith("* ")) continue;
      if (!line.includes(" FETCH (")) continue;

      // Collect until closing ')'
      const payload = await this.collectParenthesized(line);
      const uid = numberField(payload, "UID");
      if (!uid) continue;
      const flags = flagsField(payload, "FLAGS") || [];
      const size = numberField(payload, "RFC822.SIZE") || undefined;

      const hdr = stringSection(payload, "BODY[HEADER.FIELDS");
      const preview = stringSection(payload, "BODY[TEXT]");

      const env: Envelope = {
        uid,
        flags,
        size,
        date: headerDate(hdr),
        subject: headerSingle(hdr, "Subject"),
        from: headerAddrs(hdr, "From"),
        to: headerAddrs(hdr, "To"),
        cc: headerAddrs(hdr, "Cc"),
        bcc: headerAddrs(hdr, "Bcc"),
        inReplyTo: headerSingle(hdr, "In-Reply-To"),
        messageId: headerSingle(hdr, "Message-ID"),
        preview: preview
          ? ascii(new TextEncoder().encode(preview)).slice(0, maxPreviewBytes)
          : undefined,
        hasAttachments: /multipart\/mixed|application\/|attachment/i.test(
          payload
        ),
      };
      results.set(uid, env);
    }
    return Array.from(results.values());
  }

  async fetchBody(spec: FetchBodySpec): Promise<BodyResult> {
    this.ensureSelected()
    const part = spec.part ?? "BODY[]";
    const max = spec.maxBytes ?? 0;
    const maxSuffix = max > 0 ? `<0.${max}>` : "";
    const tag = this.nextTag();
    await this.sendLine(
      `${tag} UID FETCH ${spec.uid} (BODY.PEEK[${part}]${maxSuffix})`
    );

    let content: Uint8Array | undefined;
    let contentType: string | undefined;
    let filename: string | undefined;
    let truncated = false;

    for (; ;) {
      const line = await this.readLineSafe("FETCH BODY");
      if (line.startsWith(tag)) {
        if (!line.includes("OK")) throw new Error("FETCH body failed: " + line);
        break;
      }
      if (line.startsWith("* ") && line.includes(" FETCH (")) {
        // Expect a literal: {bytes}
        const m = /\{(\d+)\}$/.exec(line.trim());
        if (m) {
          const size = parseInt(m[1], 10);
          const bytes = await this.readLiteral(size);
          content = bytes;
          truncated = max > 0 && size > max;
        }
      }
      if (/BODY\[(.*)\]/.test(line) && /Content-Type:/i.test(line)) {
        contentType =
          /Content-Type:\s*([^\r\n]+)/i.exec(line)?.[1]?.trim() || undefined;
        const fn =
          /name="?([^\";]+)"?/i.exec(line)?.[1] ||
          /filename="?([^\";]+)"?/i.exec(line)?.[1];
        filename = fn || undefined;
      }
    }

    if (!content) content = new Uint8Array(0);
    return {
      uid: spec.uid,
      part: spec.part,
      bytes: content,
      isTruncated: truncated,
      contentType,
      filename,
    };
  }

  async search(criteria: string): Promise<number[]> {
    this.ensureSelected();
    return await this.maybeRefreshAndRetry(async () => {
      const tag = this.nextTag();
      await this.sendLine(`${tag} UID SEARCH ${criteria}`);
      const out: number[] = [];
      for (; ;) {
        const line = await this.readLineSafe("SEARCH");
        if (line.startsWith(tag)) {
          if (!line.includes("OK")) throw new Error("SEARCH failed: " + line);
          break;
        }
        if (line.startsWith("* SEARCH ")) {
          const parts = line.slice(9).trim().split(" ");
          for (const p of parts) {
            const n = parseInt(p, 10);
            if (!isNaN(n)) out.push(n);
          }
        }
      }
      return out;
    });
  }

  async storeFlags(uids: number[], mode: "+FLAGS" | "-FLAGS" | "FLAGS", flags: string[]): Promise<void> {
    this.ensureSelected()
    if (uids.length === 0) return;
    const tag = this.nextTag();
    const ranges = compressUidList(uids);
    const list = "(" + flags.join(" ") + ")";
    await this.sendLine(`${tag} UID STORE ${ranges} ${mode} ${list}`);
    for (; ;) {
      const line = await this.readLineSafe("STORE");
      if (line.startsWith(tag)) {
        if (!line.includes("OK")) throw new Error("STORE failed: " + line);
        break;
      }
    }
  }

  async append(mailbox: string, messageBytes: Uint8Array, opts?: AppendOptions): Promise<void> {
    this.ensureSelected()
    const name = encodeUtf7Imap(mailbox);
    const flags = opts?.flags?.length ? " (" + opts.flags.join(" ") + ")" : "";
    const date = opts?.date ? ` "${formatInternalDate(opts.date)}"` : "";
    const tag = this.nextTag();
    const literal = `{${messageBytes.byteLength}}`;
    await this.sendLine(`${tag} APPEND "${name}"${flags}${date} ${literal}`);
    // wait for continuation +
    const cont = await this.readLineSafe("APPEND cont");
    if (!cont.startsWith("+")) throw new Error("APPEND rejected: " + cont);
    await this.wr.write(messageBytes);
    await this.sendLine(""); // CRLF
    for (; ;) {
      const line = await this.readLineSafe("APPEND");
      if (line.startsWith(tag)) {
        if (!line.includes("OK")) throw new Error("APPEND failed: " + line);
        break;
      }
    }
  }

  // IDLE for push updates (new mail, expunge). Use sparingly in web contexts.
  async idle(onEvent: (ev: { exists?: number; expungeUid?: number }) => void, ms = 300000): Promise<void> {
    this.ensureSelected()
    if (!this.caps.idle) return;
    const tag = this.nextTag();
    await this.sendLine(`${tag} IDLE`);
    const cont = await this.readLineSafe("IDLE cont");
    if (!cont.startsWith("+")) return;
    const deadline = Date.now() + ms;
    while (Date.now() < deadline && !this.closed) {
      const line = await this.readLineSafe("IDLE event");
      if (line == null) break;
      if (line.startsWith("* ") && line.includes(" EXISTS")) {
        const n = parseInt(line.split(" ")[1], 10);
        onEvent({ exists: n });
      } else if (line.startsWith("* ") && line.includes(" EXPUNGE")) {
        const n = parseInt(line.split(" ")[1], 10);
        onEvent({ expungeUid: n });
      } else if (line.startsWith(tag)) {
        break;
      }
    }
    // terminate
    await this.sendLine("DONE");
    // drain completion
    for (; ;) {
      const line = await this.readLineSafe("IDLE end");
      if (line.startsWith(tag)) break;
    }
  }

  getSelectedMailbox(): string | undefined {
    return this.selectedMailbox;
  }

  private ensureSelected(): void {
    if (!this.selectedMailbox) throw new Error("No mailbox selected");
  }


  // ----- internals -----

  private async capability(): Promise<void> {
    const tag = this.nextTag();
    await this.sendLine(`${tag} CAPABILITY`);
    const auth: string[] = [];
    let idle = false;
    let literalPlus = false;
    let uidplus = false;
    for (; ;) {
      const line = await this.readLineSafe("CAPA");
      if (line.startsWith("* CAPABILITY ")) {
        const caps = line.slice(13).trim().split(" ");
        for (const c of caps) {
          if (c.startsWith("AUTH=")) auth.push(c.slice(5));
          if (c === "IDLE") idle = true;
          if (c === "LITERAL+") literalPlus = true;
          if (c === "UIDPLUS") uidplus = true;
        }
      } else if (line.startsWith(tag)) {
        if (!line.includes("OK")) throw new Error("CAPABILITY failed: " + line);
        break;
      }
    }
    this.caps = { auth, idle, literalPlus, uidplus };
  }

  private async authenticate(): Promise<void> {
    const a = this.cfg.auth;
    if (a.mechanism === "PLAIN") {
      const tag = this.nextTag();
      const payload = "\0" + a.username + "\0" + a.password;
      const b64 = typeof btoa !== "undefined"
        ? btoa(payload)
        : Buffer.from(payload, "utf8").toString("base64");
      await this.sendLine(`${tag} AUTHENTICATE PLAIN ${b64}`);
      await this.expectOk(tag, "AUTH PLAIN");
    } else if (a.mechanism === "LOGIN") {
      const tag = this.nextTag();
      await this.sendLine(
        `${tag} LOGIN "${escapeStr(a.username)}" "${escapeStr(a.password)}"`
      );
      await this.expectOk(tag, "LOGIN");
    } else if (a.mechanism === "XOAUTH2") {
      await this.maybeRefreshAndRetry(async () => {
        const token = await this.getXoauth2Token();
        const tag = this.nextTag();
        const str = `user=${a.username}\x01auth=Bearer ${token}\x01\x01`;
        const b64 = typeof btoa !== "undefined"
          ? btoa(str)
          : Buffer.from(str, "utf8").toString("base64");
        await this.sendLine(`${tag} AUTHENTICATE XOAUTH2 ${b64}`);
        // handle servers that send "+ " intermediate
        for (; ;) {
          const line = await this.readLineSafe("XOAUTH2");
          if (line.startsWith("+ ")) {
            await this.sendLine("");
            continue;
          }
          if (line.startsWith(tag)) {
            if (!line.includes("OK"))
              throw new Error("XOAUTH2 failed: " + line);
            break;
          }
        }
      });
    } else {
      throw new Error("Unsupported auth");
    }
  }

  private async getXoauth2Token(): Promise<string> {
    const a = this.cfg.auth as any;
    if (a.mechanism !== "XOAUTH2") return "";
    const auto =
      this.cfg.autoRefreshToken ?? (a.provider ? true : false);
    const skew = this.cfg.refreshSkewMs ?? 60_000;

    // If provider exists, ask it. If not, use static accessToken.
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

  private async maybeRefreshAndRetry<T>(
    op: () => Promise<T>
  ): Promise<T> {
    const retry = this.cfg.retryOnAuthFailure ?? true;
    try {
      return await op();
    } catch (e: any) {
      const msg = String(e?.message || e);
      const isAuthFail =
        /AUTHENTICATE|LOGIN|XOAUTH2|NO \[AUTH/i.test(msg) ||
        /\bAUTHENTICATIONFAILED\b/i.test(msg) ||
        /\bINVALIDCREDENTIALS\b/i.test(msg);
      const a = this.cfg.auth as any;
      const canRefresh = a?.mechanism === "XOAUTH2" && a?.provider;
      if (retry && isAuthFail && canRefresh) {
        // refresh and retry once
        await a.provider.refreshAccessToken();
        return await op();
      }
      throw e;
    }
  }

  private async simple(cmd: string): Promise<void> {
    const tag = this.nextTag();
    await this.sendLine(`${tag} ${cmd}`);
    await this.expectOk(tag, cmd);
  }

  private async expectOk(tag: string, label: string): Promise<void> {
    for (; ;) {
      const line = await this.readLineSafe(label);
      if (line.startsWith(tag)) {
        if (!line.includes("OK")) throw new Error(label + " failed: " + line);
        break;
      }
    }
  }

  private async collectParenthesized(firstLine: string): Promise<string> {
    // Collect multi-line FETCH payloads; simplistic balance count of '(' and ')'
    let s = firstLine;
    let bal = balanceParens(s);
    while (bal > 0) {
      const line = await this.readLineSafe("collect");
      s += "\r\n" + line;
      bal = balanceParens(s);
      // handle literals: {n}\r\n...bytes...
      const m = /\{(\d+)\}\r?$/.exec(line.trim());
      if (m) {
        const n = parseInt(m[1], 10);
        const lit = await this.readLiteral(n);
        // attach as placeholder token to avoid huge string copies
        s += "\r\n" + `#LITERAL(${n})#`;
        // we won't inline bytes into the string to avoid memory spikes
        // When needed, we perform separate BODY fetch for content bytes.
        // For headers previews we rely on specific fetches already.
        void lit; // discard here
      }
    }
    return s;
  }

  private async readLiteral(n: number): Promise<Uint8Array> {
    let remaining = n;
    const chunks: Uint8Array[] = [];
    while (remaining > 0) {
      const chunk = await this.transport.read();
      if (chunk == null) throw new Error("Connection closed reading literal");
      chunks.push(chunk);
      remaining -= chunk.length;
    }
    // There may be a trailing CRLF after literal; try to consume it from line reader path
    return chunks.length === 1 ? chunks[0] : concatChunks(chunks);
  }

  private nextTag(): string {
    this.tagCounter++;
    return "A" + this.tagCounter.toString().padStart(4, "0");
  }

  private async sendLine(s: string): Promise<void> {
    const data = new TextEncoder().encode(s + "\r\n");
    await withTimeout(this.wr.write(data), this.cfg.commandTimeoutMs ?? 30000);
  }

  private async readLineSafe(ctx: string): Promise<string> {
    const p = this.rd.readLine();
    return await withTimeout(p, this.cfg.commandTimeoutMs ?? 30000, ctx) ?? "";
  }
}

// ----- helpers -----

function compressUidList(uids: number[]): string {
  const arr = Array.from(new Set(uids)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = arr[0];
  let prev = arr[0];
  for (let i = 1; i < arr.length; i++) {
    const n = arr[i];
    if (n === prev + 1) {
      prev = n;
    } else {
      if (start === prev) ranges.push(String(start));
      else ranges.push(`${start}:${prev}`);
      start = prev = n;
    }
  }
  if (start != null) {
    if (start === prev) ranges.push(String(start));
    else ranges.push(`${start}:${prev}`);
  }
  return ranges.join(",");
}

function numberField(s: string, key: string): number | undefined {
  const m = new RegExp(`${key} (\\d+)`).exec(s);
  if (m) return parseInt(m[1], 10);
  return undefined;
}

function flagsField(s: string, key: string): string[] | undefined {
  const m = new RegExp(`${key} \\(([^)]*)\\)`).exec(s);
  if (!m) return undefined;
  return m[1].split(" ").filter(Boolean);
}

function stringSection(s: string, prefix: string): string | undefined {
  // Find literal or quoted section – we only handle small header/text previews
  const m1 = new RegExp(`${escapeReg(prefix)}\\] \\{(\\d+)\\}`, "i").exec(s);
  if (m1) {
    // We discarded literal bytes during collectParenthesized to save memory,
    // so we cannot recover large text here; thus previews are fetched with
    // explicit <0.N> ranges which return inline.
    return undefined;
  }
  const m2 = new RegExp(`${escapeReg(prefix)}\\] "([^"]*)"`, "i").exec(s);
  return m2?.[1];
}

function headerSingle(hdr?: string, key?: string): string | undefined {
  if (!hdr || !key) return undefined;
  const m = new RegExp(`\\r\\n${escapeReg(key)}:\\s*([^\\r\\n]+)`, "i").exec(
    "\r\n" + hdr
  );
  return m?.[1]?.trim();
}

function headerAddrs(hdr?: string, key?: string) {
  if (!hdr || !key) return undefined;
  const value = headerSingle(hdr, key);
  if (!value) return undefined;
  return value
    .split(",")
    .map((p) => p.trim())
    .map((p) => {
      const m = p.match(/^(?:"?([^"]*)"?\s)?<?([^<>]+@[^<>]+)>?$/);
      if (m) return { name: m[1]?.trim(), email: m[2] };
      return { email: p };
    });
}

function formatInternalDate(d: Date): string {
  // 17-Jul-1996 02:44:25 +0000
  const day = d.getUTCDate().toString().padStart(2, "0");
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  const y = d.getUTCFullYear();
  const time =
    d.getUTCHours().toString().padStart(2, "0") +
    ":" +
    d.getUTCMinutes().toString().padStart(2, "0") +
    ":" +
    d.getUTCSeconds().toString().padStart(2, "0");
  return `${day}-${mon}-${y} ${time} +0000`;
}

function escapeStr(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeReg(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

function concatChunks(arr: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const a of arr) len += a.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arr) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

// Parse "Date:" header value into a JS Date (best-effort, RFC 5322)
function headerDate(hdr?: string): Date | undefined {
  if (!hdr) return undefined;
  const m = /\r\nDate:\s*([^\r\n]+)\r?\n/i.exec("\r\n" + hdr);
  if (!m) return undefined;
  const raw = m[1].trim();

  // Try native Date parsing first (covers most RFC 5322 formats)
  const d1 = new Date(raw);
  if (!isNaN(d1.getTime())) return d1;

  // Fallback: strip comments and redundant whitespace, then retry
  const cleaned = raw
    .replace(/\([^)]*\)/g, "") // remove comments in parentheses
    .replace(/\s+/g, " ")
    .trim();
  const d2 = new Date(cleaned);
  if (!isNaN(d2.getTime())) return d2;

  // Final fallback: try without weekday if present
  const noWk = cleaned.replace(/^[A-Za-z]{3},\s*/, "");
  const d3 = new Date(noWk);
  if (!isNaN(d3.getTime())) return d3;

  return undefined;
}

// Return the current parenthesis balance for a string.
// Increments on '(' and decrements on ')', never below zero.
function balanceParens(s: string): number {
  let bal = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") bal++;
    else if (ch === ")") bal = Math.max(0, bal - 1);
  }
  return bal;
}
