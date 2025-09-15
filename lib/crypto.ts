import crypto from "crypto";

const ENC_KEY_HEX = process.env.IMAP_SECRET_KEY ?? "2ac5ae7902b333467b29b9a0e2ab677f786595e07e28296364ccddb8c04a0b04";
if (!ENC_KEY_HEX) {
  throw new Error("IMAP_SECRET_KEY is not set");
}
const ENC_KEY = Buffer.from(ENC_KEY_HEX, "hex"); // 32 bytes
if (ENC_KEY.length !== 32) {
  throw new Error("IMAP_SECRET_KEY must be 32 bytes hex (64 hex chars)");
}
const ALG = "aes-256-gcm";

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALG, ENC_KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}
