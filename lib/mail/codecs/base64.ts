export function base64Encode(bytes: Uint8Array): string {
  if (typeof btoa !== "undefined") {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  // Node / RN polyfill
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  if (g.Buffer) return g.Buffer.from(bytes).toString("base64");
  // Fallback
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const a = bytes[i++];
    const b = i < bytes.length ? bytes[i++] : 0;
    const c = i < bytes.length ? bytes[i++] : 0;
    const triplet = (a << 16) | (b << 8) | c;
    out +=
      alphabet[(triplet >> 18) & 63] +
      alphabet[(triplet >> 12) & 63] +
      (i - 1 <= bytes.length ? alphabet[(triplet >> 6) & 63] : "=") +
      (i <= bytes.length ? alphabet[triplet & 63] : "=");
  }
  return out;
}

export function base64DecodeToBytes(s: string): Uint8Array {
  if (typeof atob !== "undefined") {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // Node / RN
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  if (g.Buffer) return new Uint8Array(g.Buffer.from(s, "base64"));
  // Fallback
  const clean = s.replace(/[^A-Za-z0-9+/=]/g, "");
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const out: number[] = [];
  let i = 0;
  while (i < clean.length) {
    const a = alphabet.indexOf(clean[i++]);
    const b = alphabet.indexOf(clean[i++]);
    const c = alphabet.indexOf(clean[i++]);
    const d = alphabet.indexOf(clean[i++]);
    const triplet = (a << 18) | (b << 12) | ((c & 63) << 6) | (d & 63);
    if (c === 64) {
      out.push((triplet >> 16) & 255);
    } else if (d === 64) {
      out.push((triplet >> 16) & 255, (triplet >> 8) & 255);
    } else {
      out.push(
        (triplet >> 16) & 255,
        (triplet >> 8) & 255,
        triplet & 255
      );
    }
  }
  return new Uint8Array(out);
}
