import { ensureRedis, redis } from "./redis";
import { encryptSecret, decryptSecret } from "../crypto";

function userKey(userIdOrEmail: string) {
  return `imap:user:${userIdOrEmail}:passwordEnc`;
}

export async function setUserImapPassword(
  userIdOrEmail: string,
  plainPassword: string
) {
  await ensureRedis();
  const enc = encryptSecret(plainPassword);
  await redis.set(userKey(userIdOrEmail), enc);
  return true;
}

export async function getUserImapPassword(
  userIdOrEmail: string
): Promise<string | null> {
  await ensureRedis();
  const enc = await redis.get(userKey(userIdOrEmail));
  if (!enc) return null;
  try {
    return decryptSecret(enc);
  } catch {
    return null;
  }
}

const delFlagKey = (userKey: string) => `imap:user:${userKey}:passDelFlag`;

export async function deleteUserImapPassword(userKey: string) {
  await ensureRedis();
  const already = await redis.get(delFlagKey(userKey));
  if (!already) {
    await redis.del(`imap:user:${userKey}:passwordEnc`);
    await redis.setEx(delFlagKey(userKey), 60, "1"); // 1-minute throttle
  }
}
