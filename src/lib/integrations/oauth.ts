import type { Connection } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { appUrl } from "@/lib/env";
import { providerConfig, slugFor, type ProviderSlug } from "./providers";

export class ReauthRequired extends Error {
  constructor(message = "The provider rejected the stored token — reconnect this account.") {
    super(message);
    this.name = "ReauthRequired";
  }
}

export function redirectUri(slug: ProviderSlug): string {
  return `${appUrl()}/api/connect/${slug}/callback`;
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeToken(slug: ProviderSlug, params: Record<string, string>): Promise<TokenResponse> {
  const cfg = providerConfig(slug);
  const body = new URLSearchParams({
    client_id: cfg.clientId ?? "",
    client_secret: cfg.clientSecret ?? "",
    ...params,
  });
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || json.error || !json.access_token) {
    const msg = json.error_description || json.error || `HTTP ${res.status}`;
    if (json.error === "invalid_grant" || json.error === "bad_refresh_token") throw new ReauthRequired(msg);
    throw new Error(`Token exchange failed: ${msg}`);
  }
  return json;
}

/** A valid access token for a connection, refreshing (and persisting) it if needed. */
export async function getAccessToken(conn: Connection): Promise<string> {
  const notExpired = !conn.expiresAt || conn.expiresAt.getTime() > Date.now() + 90_000;
  if (notExpired) return decrypt(conn.accessToken);
  if (!conn.refreshToken) throw new ReauthRequired("Access token expired and no refresh token is stored.");

  const slug = slugFor(conn.provider);
  const params: Record<string, string> = { grant_type: "refresh_token", refresh_token: decrypt(conn.refreshToken) };
  if (slug === "microsoft") params.scope = providerConfig(slug).scopes.join(" ");
  const tok = await exchangeToken(slug, params);

  await prisma.connection.update({
    where: { id: conn.id },
    data: {
      accessToken: encrypt(tok.access_token),
      // Microsoft rotates refresh tokens; Google usually doesn't send a new one.
      ...(tok.refresh_token ? { refreshToken: encrypt(tok.refresh_token) } : {}),
      expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : null,
    },
  });
  return tok.access_token;
}

/** fetch() JSON with a bearer token; 401 → ReauthRequired. */
export async function apiGet<T>(url: string, token: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...headers },
    cache: "no-store",
  });
  if (res.status === 401) throw new ReauthRequired();
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${new URL(url).host} responded ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}
