import { ImapFlow } from "imapflow";

export type ResolvedConnection = {
  host: string;
  port: number;
  secure: boolean;
  auth:
  | { user: string; pass: string }
  | { user: string; accessToken: string }; // XOAUTH2
  clientInfo?: { name?: string; version?: string };
  logger?: boolean;
};

export function buildClient(input: ResolvedConnection) {
  const client = new ImapFlow({
    host: input.host,
    port: input.port,
    secure: input.secure,
    auth: input.auth as any, // imapflow accepts either pass or accessToken
    clientInfo: input.clientInfo,
    logger: input.logger ? console : undefined,
  });
  return client;
}

export async function withClient<T>(
  conn: ResolvedConnection,
  fn: (client: ImapFlow) => Promise<T>
): Promise<T> {
  const client = buildClient(conn);
  try {
    await client.connect();
    return await fn(client);
  } finally {
    try {
      await client.logout();
    } catch { }
  }
}
