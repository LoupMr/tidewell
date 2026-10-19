import type { Provider } from "@prisma/client";

// OAuth 2.0 settings for each provider. Each instance owner registers their
// own OAuth apps (see docs/INTEGRATIONS.md) and puts the ids/secrets in env.

export type ProviderSlug = "microsoft" | "google" | "github";

export type ProviderConfig = {
  slug: ProviderSlug;
  enumValue: Provider;
  name: string;
  description: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  extraAuthParams?: Record<string, string>;
  clientId?: string;
  clientSecret?: string;
};

const msTenant = () => process.env.MICROSOFT_TENANT_ID || "common";

export function providerConfig(slug: ProviderSlug): ProviderConfig {
  switch (slug) {
    case "microsoft":
      return {
        slug,
        enumValue: "MICROSOFT",
        name: "Microsoft / Outlook",
        description: "Every Outlook calendar (own, shared, delegated, subscribed) + unread inbox",
        authUrl: `https://login.microsoftonline.com/${msTenant()}/oauth2/v2.0/authorize`,
        tokenUrl: `https://login.microsoftonline.com/${msTenant()}/oauth2/v2.0/token`,
        scopes: ["openid", "email", "offline_access", "User.Read", "Calendars.Read", "Calendars.Read.Shared", "Mail.Read"],
        extraAuthParams: { prompt: "select_account" },
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      };
    case "google":
      return {
        slug,
        enumValue: "GOOGLE",
        name: "Google / Gmail",
        description: "Every Google calendar you can see + unread Gmail inbox",
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scopes: [
          "openid",
          "email",
          "https://www.googleapis.com/auth/calendar.readonly",
          "https://www.googleapis.com/auth/gmail.readonly",
        ],
        // offline + consent → Google always returns a refresh token.
        extraAuthParams: { access_type: "offline", prompt: "consent select_account", include_granted_scopes: "true" },
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      };
    case "github":
      return {
        slug,
        enumValue: "GITHUB",
        name: "GitHub",
        description: "Issues assigned to you, PRs waiting on your review, your open PRs",
        authUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        // `repo` is needed to see issues in private repos; Tidewell only reads.
        scopes: ["read:user", "repo"],
        extraAuthParams: { allow_signup: "false" },
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      };
  }
}

export const ALL_PROVIDERS: ProviderSlug[] = ["microsoft", "google", "github"];

export function isProviderSlug(s: string): s is ProviderSlug {
  return (ALL_PROVIDERS as string[]).includes(s);
}

export function slugFor(p: Provider): ProviderSlug {
  return p === "MICROSOFT" ? "microsoft" : p === "GOOGLE" ? "google" : "github";
}

export function isConfigured(slug: ProviderSlug): boolean {
  const c = providerConfig(slug);
  return Boolean(c.clientId && c.clientSecret);
}
