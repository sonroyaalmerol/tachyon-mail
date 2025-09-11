export function decodeQuotedPrintable(input: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "=") {
      if (input[i + 1] === "\r" && input[i + 2] === "\n") {
        i += 2;
        continue; // soft line break
      }
      const hex = input.substr(i + 1, 2);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        out.push(parseInt(hex, 16));
        i += 2;
      } else {
        out.push(ch.charCodeAt(0));
      }
    } else {
      out.push(ch.charCodeAt(0));
    }
  }
  return new Uint8Array(out);
}

export function encodeQuotedPrintable(bytes: Uint8Array): string {
  const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");
  let out = "";
  let lineLen = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    const printable =
      (b >= 33 && b <= 60) || (b >= 62 && b <= 126) || b === 9 || b === 32;
    const token = printable && b !== 61 ? String.fromCharCode(b) : "=" + hex(b);
    if (lineLen + token.length > 72) {
      out += "=\r\n";
      lineLen = 0;
    }
    out += token;
    lineLen += token.length;
  }
  return out;
}
