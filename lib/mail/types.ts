export type AuthPlain = {
  mechanism: "PLAIN";
  username: string;
  password: string;
  authzid?: string;
};

export type AuthLogin = {
  mechanism: "LOGIN";
  username: string;
  password: string;
};

export type AuthTokenProvider = {
  // Return a currently valid access token (may call refresh internally).
  getAccessToken(): Promise<{
    accessToken: string;
    expiresAt?: number; // epoch ms
    refreshToken?: string;
  }>;
  // Try to refresh using a stored refresh token. Return new token.
  refreshAccessToken(): Promise<{
    accessToken: string;
    expiresAt?: number;
    refreshToken?: string;
  }>;
};

export type AuthXOAuth2 = {
  mechanism: "XOAUTH2";
  username: string;
  accessToken?: string; // optional if provider is set
  provider?: AuthTokenProvider; // plug-in for auto refresh
};

export type AuthMethod = AuthPlain | AuthLogin | AuthXOAuth2;

export type ImapConfig = {
  host: string;
  port: number;
  secure: boolean; // implicit TLS
  startTLS?: boolean; // for explicit STARTTLS if transport supports
  auth: AuthMethod;
  clientId?: { name?: string; vendor?: string; "support-url"?: string };
  // Environment tuning:
  // If true, use IDLE only when app is foreground; otherwise short-poll.
  preferIdle?: boolean;
  idleIntervalMs?: number; // fallback poll
  commandTimeoutMs?: number;
  keepaliveMs?: number; // NOOP interval if not IDLE

  // Auto-refresh options (XOAUTH2 only)
  autoRefreshToken?: boolean; // default true if provider present
  refreshSkewMs?: number; // refresh this many ms before expiry (default 60_000)
  retryOnAuthFailure?: boolean; // one retry after refresh on NO/BAD (default true)
};

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean; // implicit TLS
  startTLS?: boolean;
  auth?: AuthMethod; // SMTP auth is optional for some relays
  commandTimeoutMs?: number;

  // Auto-refresh options (XOAUTH2 only)
  autoRefreshToken?: boolean; // default true if provider present
  refreshSkewMs?: number; // refresh this many ms before expiry (default 60_000)
  retryOnAuthFailure?: boolean; // one retry after refresh on NO/BAD (default true)
};

export type MailboxInfo = {
  name: string;
  path: string; // UTF7-IMAP encoded on wire; unicode here
  attributes: string[];
  exists?: number;
  unseen?: number;
};

export type Envelope = {
  uid: number;
  flags: string[];
  date?: Date;
  subject?: string;
  from?: Address[];
  to?: Address[];
  cc?: Address[];
  bcc?: Address[];
  inReplyTo?: string;
  messageId?: string;
  size?: number;
  preview?: string;
  hasAttachments?: boolean;
};

export type Address = {
  name?: string;
  email?: string;
};

export type FetchBodySpec = {
  uid: number;
  // e.g. "1.2" for a specific MIME part, or "TEXT", "HEADER", "BODY[]"
  part?: string;
  // limit bytes to cap memory
  maxBytes?: number;
};

export type BodyResult = {
  uid: number;
  part?: string;
  bytes: Uint8Array;
  isTruncated: boolean;
  contentType?: string;
  filename?: string;
};

export type AppendOptions = {
  flags?: string[];
  date?: Date;
};

export type SendMailParams = {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    content: Uint8Array;
    inline?: boolean;
    contentId?: string;
  }>;
  headers?: Record<string, string>;
};
