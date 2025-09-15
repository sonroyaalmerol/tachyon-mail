export type ImapAuth =
  | { type: "password"; user: string; pass: string }
  | { type: "xoauth2"; user: string; accessToken: string }; // imapflow supports XOAUTH2 via accessToken

export type ImapConnectionConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth: ImapAuth;
  clientInfo?: { name?: string; version?: string };
};

export async function getImapConfigForUser(userId: string, accountId?: string): Promise<ImapConnectionConfig> {
  // Load from your DB by userId + accountId.
  // Example static mock:
  return {
    host: "imap.example.com",
    port: 993,
    secure: true,
    auth: { type: "password", user: "me@example.com", pass: "app-password" },
    clientInfo: { name: "YourApp", version: "1.0.0" },
  };
}
