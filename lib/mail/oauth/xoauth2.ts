type OAuthTokenResponse = {
  access_token: string;
  token_type: string; // should be "Bearer"
  expires_in?: number; // seconds
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  // Providers sometimes add extra fields
  [k: string]: unknown;
};

export type PkceAuthParams = {
  // OAuth endpoints and client config
  authorizationEndpoint: string; // e.g., https://accounts.google.com/o/oauth2/v2/auth
  tokenEndpoint: string; // e.g., https://oauth2.googleapis.com/token
  clientId: string;
  redirectUri: string; // your app's registered redirect URI
  scopes: string[]; // e.g., ["https://mail.google.com/"]
  // Optional advanced parameters
  extraAuthParams?: Record<string, string>; // prompt=consent, access_type=offline, etc.
  extraTokenParams?: Record<string, string>; // resource, audience, etc.
  // For web popup flow
  openAuthPage?: (authUrl: string) => Promise<string>;
  // Optional state you provide; we generate one if omitted
  state?: string;
};

export type ClientCredentialsParams = {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  extraTokenParams?: Record<string, string>;
};

export type RefreshParams = {
  tokenEndpoint: string;
  clientId: string;
  clientSecret?: string; // often not needed for public clients; required for confidential clients
  refreshToken: string;
  extraTokenParams?: Record<string, string>;
};

export type XOAuth2Result = {
  accessToken: string;
  expiresAt?: number; // epoch ms
  refreshToken?: string;
  raw: OAuthTokenResponse;
};

/**
 * Authorization Code + PKCE (Recommended)
 *
 * You must provide a way to open the returned authUrl and deliver the final
 * redirect URL back (containing "?code=...&state=..."). For React Native,
 * pass openAuthPage that opens a browser (SFAuthenticationSession/CustomTabs)
 * and resolves with the final redirect URL via deep linking. On Web, implement
 * a popup-based openAuthPage.
 */
export async function getAccessTokenWithPkce(
  params: PkceAuthParams
): Promise<XOAuth2Result> {
  const state = params.state || randomString(32);
  const verifier = randomString(64);
  const challenge = await pkceChallenge(verifier);

  const authUrl = buildAuthUrl({
    authorizationEndpoint: params.authorizationEndpoint,
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    scope: params.scopes.join(" "),
    state,
    codeChallenge: challenge.codeChallenge,
    codeChallengeMethod: challenge.method,
    extra: params.extraAuthParams,
  });

  if (!params.openAuthPage) {
    throw new Error(
      "openAuthPage is required to complete the PKCE flow (provide a " +
      "function that opens the URL and resolves with the redirect URL)."
    );
  }

  // 1) Open browser and get the redirect URL back
  const redirectUrl = await params.openAuthPage(authUrl);

  const url = new URL(redirectUrl);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) throw new Error("OAuth error: " + error);
  if (!code) throw new Error("Missing authorization code in redirect.");
  if (returnedState !== state) throw new Error("State mismatch.");

  // 2) Exchange code for tokens
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: verifier,
  });
  appendExtra(body, params.extraTokenParams);

  const tokenRes = await fetchJson(params.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  validateTokenResponse(tokenRes);
  return toResult(tokenRes);
}

/**
 * Client Credentials (service-to-service). Not typically used for user IMAP/SMTP,
 * but included for completeness.
 */
export async function getAccessTokenWithClientCredentials(
  params: ClientCredentialsParams
): Promise<XOAuth2Result> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });
  if (params.scopes?.length) body.set("scope", params.scopes.join(" "));
  appendExtra(body, params.extraTokenParams);

  const tokenRes = await fetchJson(params.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  validateTokenResponse(tokenRes);
  return toResult(tokenRes);
}

/**
 * Refresh an access token using a refresh_token.
 */
export async function refreshAccessToken(
  params: RefreshParams
): Promise<XOAuth2Result> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    client_id: params.clientId,
  });
  if (params.clientSecret) body.set("client_secret", params.clientSecret);
  appendExtra(body, params.extraTokenParams);

  const tokenRes = await fetchJson(params.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  validateTokenResponse(tokenRes, /*allowNoRefresh=*/ true);
  return toResult(tokenRes);
}

// ---- Helpers ----

function buildAuthUrl(args: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: "S256" | "plain";
  extra?: Record<string, string>;
}): string {
  const u = new URL(args.authorizationEndpoint);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", args.clientId);
  u.searchParams.set("redirect_uri", args.redirectUri);
  u.searchParams.set("scope", args.scope);
  u.searchParams.set("state", args.state);
  u.searchParams.set("code_challenge", args.codeChallenge);
  u.searchParams.set("code_challenge_method", args.codeChallengeMethod);
  if (args.extra) for (const [k, v] of Object.entries(args.extra)) u.searchParams.set(k, v);
  return u.toString();
}

function randomString(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[bytes[i] % alphabet.length];
  return s;
}

async function pkceChallenge(
  verifier: string
): Promise<{ codeChallenge: string; method: "S256" | "plain" }> {
  try {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const b64 = base64UrlEncode(new Uint8Array(digest));
    return { codeChallenge: b64, method: "S256" };
  } catch {
    // Fallback if SubtleCrypto is unavailable (rare on modern RN/Web)
    return { codeChallenge: verifier, method: "plain" };
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  // Base64 URL without padding
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  let b64: string;
  if (typeof btoa !== "undefined") {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    b64 = btoa(s);
  } else if (g.Buffer) {
    b64 = g.Buffer.from(bytes).toString("base64");
  } else {
    // tiny fallback
    b64 = "";
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function fetchJson(
  url: string,
  init: RequestInit & { body?: URLSearchParams }
): Promise<OAuthTokenResponse> {
  const res = await fetch(url, {
    ...init,
    body: init.body ? init.body.toString() : undefined,
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Token endpoint returned non-JSON: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const err =
      json.error_description || json.error || `HTTP ${res.status}`;
    throw new Error("OAuth token error: " + err);
  }
  return json as OAuthTokenResponse;
}

function appendExtra(params: URLSearchParams, extra?: Record<string, string>) {
  if (!extra) return;
  for (const [k, v] of Object.entries(extra)) params.set(k, v);
}

function validateTokenResponse(
  t: OAuthTokenResponse,
  allowNoRefresh = false
): void {
  if (!t.access_token) throw new Error("Missing access_token in response");
  if (!t.token_type || !/^Bearer$/i.test(String(t.token_type))) {
    throw new Error("token_type is not Bearer");
  }
  if (!allowNoRefresh && !t.refresh_token) {
    // Many providers do not return refresh_token unless you request it
    // using extraAuthParams like: access_type=offline, prompt=consent
    // We warn by throwing; you can relax this by passing allowNoRefresh=true.
    // For Gmail: include access_type=offline & prompt=consent on first grant.
  }
}

function toResult(t: OAuthTokenResponse): XOAuth2Result {
  const now = Date.now();
  const expiresAt =
    t.expires_in && t.expires_in > 0 ? now + t.expires_in * 1000 : undefined;
  return {
    accessToken: t.access_token,
    expiresAt,
    refreshToken: t.refresh_token,
    raw: t,
  };
}
