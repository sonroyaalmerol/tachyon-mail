type RefreshResult = { accessToken: string; expiresAt?: number };

export async function refreshGoogle(refreshToken: string): Promise<RefreshResult> {
  const body = new URLSearchParams({
    client_id: process.env.GMAIL_CLIENT_ID!,
    client_secret: process.env.GMAIL_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) throw new Error("Google refresh failed");
  const j = await resp.json();
  return { accessToken: j.access_token, expiresAt: j.expires_in ? Math.floor(Date.now() / 1000) + j.expires_in : undefined };
}

export async function refreshMicrosoft(refreshToken: string): Promise<RefreshResult> {
  const tenant = process.env.OUTLOOK_TENANT || "common";
  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: process.env.OUTLOOK_CLIENT_ID!,
    client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: "https://outlook.office.com/.default offline_access",
  });
  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) throw new Error("Microsoft refresh failed");
  const j = await resp.json();
  return { accessToken: j.access_token, expiresAt: j.expires_in ? Math.floor(Date.now() / 1000) + j.expires_in : undefined };
}

export async function refreshAuthentik(refreshToken: string): Promise<RefreshResult> {
  const tokenUrl = process.env.AUTHENTIK_OAUTH_TOKEN!;
  const body = new URLSearchParams({
    client_id: process.env.AUTHENTIK_OAUTH_CLIENT_ID!,
    client_secret: process.env.AUTHENTIK_OAUTH_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) throw new Error("Authentik OAuth refresh failed");
  const j = await resp.json();
  return { accessToken: j.access_token, expiresAt: j.expires_in ? Math.floor(Date.now() / 1000) + j.expires_in : undefined };
}
