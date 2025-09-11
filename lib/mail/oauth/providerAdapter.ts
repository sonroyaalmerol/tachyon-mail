import {
  getAccessTokenWithPkce,
  refreshAccessToken as refreshFn,
  type XOAuth2Result,
  type PkceAuthParams,
  type RefreshParams,
} from "./xoauth2";
import type { AuthTokenProvider } from "../types";

export type TokenStore = {
  get(): Promise<XOAuth2Result | null>;
  set(token: XOAuth2Result): Promise<void>;
  clear?(): Promise<void>;
};

// A simple in-memory store (use SecureStore/Keychain in production).
export class MemoryTokenStore implements TokenStore {
  private token: XOAuth2Result | null = null;
  async get(): Promise<XOAuth2Result | null> {
    return this.token;
  }
  async set(t: XOAuth2Result): Promise<void> {
    this.token = t;
  }
  async clear(): Promise<void> {
    this.token = null;
  }
}

/**
 * Create a provider using PKCE login on demand + refresh.
 * - If store has a token, returns it (and refreshes if near expiry if you ask).
 * - If store is empty, calls pkceLogin() to get an initial token and stores it.
 */
export function createPkceProvider(args: {
  store: TokenStore;
  pkceParams: PkceAuthParams; // includes openAuthPage to complete login
  refreshParams: Omit<RefreshParams, "refreshToken"> & { requireClientSecret?: boolean };
  refreshSkewMs?: number; // default 60s
  autoLoginIfMissing?: boolean; // default true
}): AuthTokenProvider {
  const skew = args.refreshSkewMs ?? 60_000;
  const autoLogin = args.autoLoginIfMissing ?? true;

  return {
    async getAccessToken() {
      let tok = await args.store.get();

      if (!tok) {
        if (!autoLogin) {
          throw new Error("No token available and autoLoginIfMissing=false");
        }
        tok = await getAccessTokenWithPkce(args.pkceParams);
        await args.store.set(tok);
      }

      // Proactive refresh if near expiry and we have refresh_token
      if (
        tok.expiresAt &&
        tok.expiresAt - Date.now() <= skew &&
        tok.refreshToken
      ) {
        tok = await refreshFn({
          tokenEndpoint: args.refreshParams.tokenEndpoint,
          clientId: args.refreshParams.clientId,
          clientSecret: args.refreshParams.requireClientSecret
            ? args.refreshParams.clientSecret
            : undefined,
          refreshToken: tok.refreshToken,
          extraTokenParams: args.refreshParams.extraTokenParams,
        });
        await args.store.set(tok);
      }

      return {
        accessToken: tok.accessToken,
        expiresAt: tok.expiresAt,
        refreshToken: tok.refreshToken,
      };
    },

    async refreshAccessToken() {
      const current = await args.store.get();
      if (!current?.refreshToken) {
        // If no refresh token, fall back to login (if allowed)
        if (!autoLogin) throw new Error("No refresh token available");
        const tok = await getAccessTokenWithPkce(args.pkceParams);
        await args.store.set(tok);
        return {
          accessToken: tok.accessToken,
          expiresAt: tok.expiresAt,
          refreshToken: tok.refreshToken,
        };
      }

      const tok = await refreshFn({
        tokenEndpoint: args.refreshParams.tokenEndpoint,
        clientId: args.refreshParams.clientId,
        clientSecret: args.refreshParams.requireClientSecret
          ? args.refreshParams.clientSecret
          : undefined,
        refreshToken: current.refreshToken,
        extraTokenParams: args.refreshParams.extraTokenParams,
      });
      await args.store.set(tok);
      return {
        accessToken: tok.accessToken,
        expiresAt: tok.expiresAt,
        refreshToken: tok.refreshToken,
      };
    },
  };
}

/**
 * Convenience providers for common vendors.
 * You still supply store and openAuthPage; URLs/scopes are prefilled.
 */

// Google (Gmail IMAP/SMTP)
export function createGoogleMailProvider(args: {
  store: TokenStore;
  clientId: string;
  redirectUri: string;
  openAuthPage: (authUrl: string) => Promise<string>;
  scopes?: string[]; // default ["https://mail.google.com/"]
  extraAuthParams?: Record<string, string>; // access_type=offline, prompt=consent...
}): AuthTokenProvider {
  return createPkceProvider({
    store: args.store,
    pkceParams: {
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      clientId: args.clientId,
      redirectUri: args.redirectUri,
      scopes: args.scopes ?? ["https://mail.google.com/"],
      extraAuthParams: {
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        ...(args.extraAuthParams || {}),
      },
      openAuthPage: args.openAuthPage,
    },
    refreshParams: {
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      clientId: args.clientId,
    },
    refreshSkewMs: 60_000,
    autoLoginIfMissing: true,
  });
}

// Microsoft 365 (IMAP/SMTP)
export function createMicrosoftMailProvider(args: {
  store: TokenStore;
  clientId: string;
  redirectUri: string;
  openAuthPage: (authUrl: string) => Promise<string>;
  tenant?: string; // "common", "organizations", or a tenant ID; default "common"
  scopes?: string[]; // default ["offline_access","IMAP.AccessAsUser.All","SMTP.Send"]
  extraAuthParams?: Record<string, string>;
}): AuthTokenProvider {
  const tenant = args.tenant ?? "common";
  return createPkceProvider({
    store: args.store,
    pkceParams: {
      authorizationEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
      tokenEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      clientId: args.clientId,
      redirectUri: args.redirectUri,
      scopes:
        args.scopes ??
        ["offline_access", "IMAP.AccessAsUser.All", "SMTP.Send"],
      extraAuthParams: {
        // Add prompt=consent on first run if you need guaranteed refresh_token
        ...(args.extraAuthParams || {}),
      },
      openAuthPage: args.openAuthPage,
    },
    refreshParams: {
      tokenEndpoint: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      clientId: args.clientId,
    },
    refreshSkewMs: 60_000,
    autoLoginIfMissing: true,
  });
}
