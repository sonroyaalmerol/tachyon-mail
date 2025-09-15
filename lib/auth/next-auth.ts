import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import AzureAD from "next-auth/providers/azure-ad";
import Credentials from "next-auth/providers/credentials";
import Authentik from "next-auth/providers/authentik";
import { refreshAuthentik, refreshGoogle, refreshMicrosoft } from "../mail/oauthRefresh";
import { deleteUserImapPassword, setUserImapPassword } from "../mail/imapPasswordStore";
import { buildClient } from "@/trpc/routers/imap/client";

const enableCredentials = process.env.IMAP_AUTH_MODE === "login" || process.env.IMAP_AUTH_MODE === "plain";
const isXOAuth = process.env.IMAP_AUTH_MODE === "xoauth"

export const authOptions: NextAuthOptions = {
  providers: [
    // Google (Gmail IMAP XOAUTH2)
    ...(isXOAuth && process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET
      ? [
        Google({
          clientId: process.env.GMAIL_CLIENT_ID!,
          clientSecret: process.env.GMAIL_CLIENT_SECRET!,
          authorization: {
            params: {
              // Offline for refresh_token
              access_type: "offline",
              prompt: "consent",
              scope:
                "openid email profile https://mail.google.com/ https://www.googleapis.com/auth/userinfo.email",
            },
          },
        }),
      ]
      : []),

    // Azure AD / Microsoft 365 (Outlook IMAP XOAUTH2)
    ...(isXOAuth && process.env.OUTLOOK_CLIENT_ID && process.env.OUTLOOK_CLIENT_SECRET
      ? [
        AzureAD({
          clientId: process.env.OUTLOOK_CLIENT_ID!,
          clientSecret: process.env.OUTLOOK_CLIENT_SECRET!,
          tenantId: process.env.OUTLOOK_TENANT || "common",
          authorization: {
            params: {
              scope:
                "openid email profile offline_access https://outlook.office.com/IMAP.AccessAsUser.All",
            },
          },
        }),
      ]
      : []),

    // Authentik
    ...(isXOAuth && process.env.AUTHENTIK_OAUTH_CLIENT_ID &&
      process.env.AUTHENTIK_OAUTH_CLIENT_SECRET &&
      process.env.AUTHENTIK_OAUTH_AUTHORIZATION &&
      process.env.AUTHENTIK_OAUTH_TOKEN
      ? [
        Authentik({
          clientId: process.env.AUTHENTIK_OAUTH_CLIENT_ID!,
          clientSecret: process.env.AUTHENTIK_OAUTH_CLIENT_SECRET!,
          authorization: {
            url: process.env.AUTHENTIK_OAUTH_AUTHORIZATION!,
            params: {
              scope:
                "openid email profile offline_access",
            },
          },
          token: process.env.AUTHENTIK_OAUTH_TOKEN,
          userinfo: process.env.AUTHENTIK_OAUTH_USERINFO,
          wellKnown:
            process.env.AUTHENTIK_OAUTH_ISSUER &&
            `${process.env.AUTHENTIK_OAUTH_ISSUER}/.well-known/openid-configuration`,
        }),
      ]
      : []),

    ...(enableCredentials
      ? [
        Credentials({
          name: "Email & Password",
          credentials: {
            email: { label: "Email", type: "email" },
            password: { label: "Password", type: "password" },
          },
          async authorize(creds) {
            if (!creds?.email || !creds?.password) return null;

            // Attempt IMAP login using env defaults
            const host = process.env.IMAP_HOST!;
            const port = process.env.IMAP_PORT ? parseInt(process.env.IMAP_PORT) : 993;
            const secure = process.env.IMAP_SECURE == "true";

            const client = buildClient({
              host,
              port,
              secure,
              auth: { user: creds.email, pass: creds.password },
              clientInfo: { name: "TachyonMail", version: "1.0.0" },
            });

            try {
              await client.connect();
              await client.noop(); // not strictly necessary, but confirms
              // Success: return a user object AND stash the password temporarily
              return {
                id: creds.email,
                email: creds.email,
                // attach temp password so jwt callback can store it; do not persist
                imapPassTmp: creds.password,
              } as any;
            } catch {
              try {
                await deleteUserImapPassword(creds.email);
              } catch { }
              return null;
            } finally {
              try {
                await client.logout();
              } catch { }
            }
          },
        }),
      ]
      : []),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, user }) {
      // Store provider and initial tokens on sign-in
      if (account) {
        token.provider = account.provider;
        token.access_token = account.access_token;
        token.refresh_token = account.refresh_token;
        token.expires_at = typeof account.expires_at === "number" ? account.expires_at : undefined;
      }

      // Refresh if near expiry for OAuth providers
      const provider = token.provider as string | undefined;
      const exp = typeof token.expires_at === "number" ? token.expires_at : undefined;
      const needsRefresh = provider && exp && Math.floor(Date.now() / 1000) > exp - 60;

      if (needsRefresh && token.refresh_token) {
        try {
          const ref =
            provider === "google"
              ? await refreshGoogle(token.refresh_token as string)
              : provider === "azure-ad"
                ? await refreshMicrosoft(token.refresh_token as string)
                : provider === "authentik"
                  ? await refreshAuthentik(token.refresh_token as string)
                  : null;

          if (ref) {
            token.access_token = ref.accessToken;
            token.expires_at = ref.expiresAt;
          }
        } catch {
          // If refresh fails, keep old token (or set to undefined to force re-auth)
        }
      }

      if (account) {
        token.provider = account.provider;
        token.access_token = account.access_token;
        token.refresh_token = account.refresh_token;
        token.expires_at =
          typeof account.expires_at === "number"
            ? account.expires_at
            : undefined;
      }

      if (user?.email) token.email = user.email;
      if ((user as any)?.id) token.sub = (user as any).id;

      const imapPassTmp = (user as any)?.imapPassTmp as string | undefined;
      if (imapPassTmp && token.email) {
        try {
          const userKey = (token.sub as string) || (token.email as string);
          await setUserImapPassword(userKey, imapPassTmp);
        } finally {
          (token as any).__imap_pass_tmp = undefined;
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user = session.user || ({} as any);
      if (token.email && session.user) session.user.email = token.email as string;
      (session as any).imap = {
        provider: token.provider as string | undefined,
        accessToken: token.access_token as string | undefined,
        // refreshToken/expiry not needed if you refresh in jwt
      };
      return session;
    }
  },
};
