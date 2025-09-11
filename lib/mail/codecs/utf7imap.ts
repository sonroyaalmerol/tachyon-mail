// UTF-7 IMAP folder name codec
// Reference: RFC 3501, RFC 2060, modified UTF-7
import { base64DecodeToBytes, base64Encode } from "./base64";

export function encodeUtf7Imap(input: string): string {
  let out = "";
  let buf = "";
  for (const ch of input) {
    if (isPrintable(ch)) {
      if (buf) {
        out += "&" + b64utf16(buf) + "-";
        buf = "";
      }
      out += ch === "&" ? "&-" : ch;
    } else {
      buf += ch;
    }
  }
  if (buf) out += "&" + b64utf16(buf) + "-";
  return out;
}

export function decodeUtf7Imap(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "&") {
      const end = input.indexOf("-", i + 1);
      if (end === -1) {
        out += "&";
        continue;
      }
      const b64 = input.substring(i + 1, end);
      if (b64 === "") {
        out += "&";
      } else {
        const bytes = base64DecodeToBytes(b64.replace(/,/g, "/"));
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
        let s = "";
        for (let j = 0; j + 1 < view.byteLength; j += 2) {
          s += String.fromCharCode(view.getUint16(j, false));
        }
        out += s;
      }
      i = end;
    } else {
      out += ch;
    }
  }
  return out;
}

function b64utf16(s: string): string {
  const buf = new Uint8Array(s.length * 2);
  const view = new DataView(buf.buffer);
  for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), false);
  return base64Encode(buf).replace(/\//g, ",");
}

function isPrintable(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code >= 0x20 && code <= 0x7e;
}
