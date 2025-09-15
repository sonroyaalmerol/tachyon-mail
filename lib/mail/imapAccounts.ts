import type { Session } from "next-auth";
import { getUserImapPassword } from "./imapPasswordStore";

export type ImapConnectionConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth:
  | { type: "xoauth2"; user: string; accessToken: string }
  | { type: "password"; user: string; pass: string };
  clientInfo?: { name?: string; version?: string };
  logger?: boolean;
};

function boolEnv(name: string, def: boolean) {
  const v = process.env[name];
  return v == null ? def : ["1", "true", "yes", "on"].includes(v.toLowerCase());
}
function intEnv(name: string, def: number) {
  const v = process.env[name];
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : def;
}

function baseFor(provider?: string) {
  switch (provider) {
    case "google":
      return {
        host: process.env.GMAIL_IMAP_HOST || "imap.gmail.com",
        port: intEnv("GMAIL_IMAP_PORT", 993),
        secure: boolEnv("GMAIL_IMAP_SECURE", true),
      };
    case "azure-ad":
      return {
        host: process.env.OUTLOOK_IMAP_HOST || "outlook.office365.com",
        port: intEnv("OUTLOOK_IMAP_PORT", 993),
        secure: boolEnv("OUTLOOK_IMAP_SECURE", true),
      };
    case "authentik":
      return {
        host: process.env.AUTHENTIK_IMAP_HOST || process.env.IMAP_HOST || "imap.example.com",
        port: intEnv("AUTHENTIK_IMAP_PORT", intEnv("IMAP_PORT", 993)),
        secure: boolEnv("AUTHENTIK_IMAP_SECURE", boolEnv("IMAP_SECURE", true)),
      };
    case "credentials":
    default:
      return {
        host: process.env.IMAP_HOST || "imap.example.com",
        port: intEnv("IMAP_PORT", 993),
        secure: boolEnv("IMAP_SECURE", true),
      };
  }
}

export async function getImapConfigForUser(session: Session): Promise<ImapConnectionConfig> {
  const email = session.user?.email;
  if (!email) throw new Error("No user email in session");

  const userIdOrEmail =
    (session as any).user?.id || email;

  const imapMeta = (session as any).imap as
    | { provider?: string; accessToken?: string }
    | undefined;

  const provider = imapMeta?.provider;
  const base = baseFor(provider);

  if (provider === "google" || provider === "azure-ad" || provider === "authentik") {
    const accessToken = imapMeta?.accessToken;
    if (!accessToken) throw new Error("Missing OAuth access token");
    return {
      ...base,
      auth: { type: "xoauth2", user: email, accessToken },
      clientInfo: { name: "TachyonMail", version: "1.0.0" },
    };
  }

  // Otherwise use per-user stored password from Redis
  const userKey = (session as any).user?.id || email;
  const pass = await getUserImapPassword(userIdOrEmail);

  if (!pass) {
    throw new Error("No IMAP password stored for user");
  }

  return {
    ...base,
    auth: { type: "password", user: userKey, pass },
    clientInfo: { name: "TachyonMail", version: "1.0.0" },
  };
}
