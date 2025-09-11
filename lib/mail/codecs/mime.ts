import { decodeQuotedPrintable } from "./qp";
import { base64DecodeToBytes } from "./base64";

export type ParsedHeader = {
  name: string;
  value: string;
};

export type ParsedPart = {
  headers: ParsedHeader[];
  contentType?: string;
  charset?: string;
  filename?: string;
  contentId?: string;
  contentTransferEncoding?: string;
  size?: number;
  children?: ParsedPart[];
  content?: Uint8Array; // only if requested/assembled
  isAttachment?: boolean;
};

export function parseHeaders(raw: string): ParsedHeader[] {
  const lines = raw.replace(/\r\n[ \t]+/g, " ").split(/\r\n/);
  const headers: ParsedHeader[] = [];
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const name = line.substring(0, idx).trim();
    const value = line.substring(idx + 1).trim();
    headers.push({ name, value });
  }
  return headers;
}

export function headerValue(headers: ParsedHeader[], key: string): string | undefined {
  const h = headers.find((h) => h.name.toLowerCase() === key.toLowerCase());
  return h?.value;
}

export function parseContentType(value?: string): {
  type?: string;
  params: Record<string, string>;
} {
  const params: Record<string, string> = {};
  if (!value) return { params };
  const [type, ...rest] = value.split(";").map((s) => s.trim());
  for (const p of rest) {
    const eq = p.indexOf("=");
    if (eq > 0) {
      const k = p.substring(0, eq).trim().toLowerCase();
      let v = p.substring(eq + 1).trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      params[k] = v;
    }
  }
  return { type: type?.toLowerCase(), params };
}

export function decodeBody(
  bytes: Uint8Array,
  encoding?: string
): Uint8Array {
  const e = (encoding || "").toLowerCase();
  if (e === "base64") return base64DecodeToBytes(ascii(bytes));
  if (e === "quoted-printable") return decodeQuotedPrintable(ascii(bytes));
  return bytes;
}

export function ascii(bytes: Uint8Array): string {
  return new TextDecoder("ascii", { fatal: false }).decode(bytes);
}

// very light address parser (common cases)
export function parseAddresses(value?: string): { name?: string; email?: string }[] {
  if (!value) return [];
  const parts = value.split(",");
  const out: { name?: string; email?: string }[] = [];
  for (let p of parts) {
    p = p.trim();
    const m = p.match(/^(?:"?([^"]*)"?\s)?<?([^<>]+@[^<>]+)>?$/);
    if (m) out.push({ name: m[1]?.trim() || undefined, email: m[2] });
    else out.push({ email: p });
  }
  return out;
}

// Simple MIME tree builder for multipart boundaries.
// This expects entire MIME content if you want a full tree; for streaming,
// fetch part-by-part via IMAP BODYSTRUCTURE and fetch specific parts as needed.
export function buildMimeTree(
  rawHeaders: string,
  bodyBytes: Uint8Array
): ParsedPart {
  const headers = parseHeaders(rawHeaders);
  const ct = parseContentType(headerValue(headers, "Content-Type"));
  const enc = (headerValue(headers, "Content-Transfer-Encoding") || "").toLowerCase();
  const disp = headerValue(headers, "Content-Disposition") || "";
  const filename =
    /filename\*?="?([^\";]+)"?/.exec(disp)?.[1] ||
    /name="?([^\";]+)"?/.exec(headerValue(headers, "Content-Type") || "")?.[1];

  const root: ParsedPart = {
    headers,
    contentType: ct.type,
    charset: ct.params.charset?.toLowerCase(),
    filename,
    contentTransferEncoding: enc,
  };

  if (ct.type?.startsWith("multipart/")) {
    const boundary = ct.params.boundary;
    if (!boundary) return root;
    const delim = `--${boundary}`;
    const end = `--${boundary}--`;
    const text = ascii(bodyBytes);
    const lines = text.split("\r\n");
    let i = 0;
    const children: ParsedPart[] = [];
    let partLines: string[] = [];
    let inPart = false;
    while (i < lines.length) {
      const line = lines[i++];
      if (line === delim) {
        if (inPart && partLines.length) {
          children.push(parsePartFromText(partLines.join("\r\n")));
          partLines = [];
        }
        inPart = true;
      } else if (line === end) {
        if (inPart && partLines.length) {
          children.push(parsePartFromText(partLines.join("\r\n")));
        }
        break;
      } else if (inPart) {
        partLines.push(line);
      }
    }
    root.children = children;
    root.isAttachment = false;
  } else {
    // Single part
    root.content = decodeBody(bodyBytes, enc);
    root.isAttachment = /attachment/i.test(disp) || !!root.filename;
  }

  return root;
}

function parsePartFromText(text: string): ParsedPart {
  const split = text.indexOf("\r\n\r\n");
  const rawHeaders = split >= 0 ? text.substring(0, split) : text;
  const bodyText = split >= 0 ? text.substring(split + 4) : "";
  return buildMimeTree(rawHeaders, new TextEncoder().encode(bodyText));
}
