import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { encrypt, safeEqual } from "@/lib/crypto";
import { appUrl } from "@/lib/env";
import { isProviderSlug, providerConfig, type ProviderSlug } from "@/lib/integrations/providers";
import { exchangeToken, redirectUri } from "@/lib/integrations/oauth";
import * as microsoft from "@/lib/integrations/microsoft";
import * as google from "@/lib/integrations/google";
import * as github from "@/lib/integrations/github";
import { syncConnection } from "@/lib/sync";

export const dynamic = "force-dynamic";

const identityFor: Record<ProviderSlug, (t: string) => Promise<{ externalId: string; label: string }>> = {
  microsoft: microsoft.identity,
  google: google.identity,
  github: github.identity,
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const back = (q: string) => NextResponse.redirect(`${appUrl()}/settings?${q}`);

  const userId = await currentUserId();
  if (!userId) return NextResponse.redirect(`${appUrl()}/login`);
  if (!isProviderSlug(provider)) return back("error=unknown_provider");

  const jar = await cookies();
  const expected = jar.get("tw_oauth_state")?.value ?? "";
  jar.delete({ name: "tw_oauth_state", path: "/api/connect" });

  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) return back(`error=${encodeURIComponent(sp.get("error_description") || sp.get("error")!)}`);
  const code = sp.get("code");
  const state = sp.get("state") ?? "";
  if (!code || !expected || !safeEqual(expected, `${provider}:${state}`)) return back("error=invalid_state");

  try {
    const tok = await exchangeToken(provider, {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(provider),
    });
    const who = await identityFor[provider](tok.access_token);
    const cfg = providerConfig(provider);

    const data = {
      label: who.label,
      accessToken: encrypt(tok.access_token),
      ...(tok.refresh_token ? { refreshToken: encrypt(tok.refresh_token) } : {}),
      expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : null,
      scopes: tok.scope ?? cfg.scopes.join(" "),
      status: "ACTIVE" as const,
      lastError: null,
    };
    const conn = await prisma.connection.upsert({
      where: { userId_provider_externalId: { userId, provider: cfg.enumValue, externalId: who.externalId } },
      create: { userId, provider: cfg.enumValue, externalId: who.externalId, ...data },
      update: data,
    });

    // First sync right away so the dashboard isn't empty on return.
    const r = await syncConnection(conn);
    return back(r.ok ? `connected=${provider}` : `connected=${provider}&warning=${encodeURIComponent(r.message ?? "")}`);
  } catch (err) {
    console.error(`[connect] ${provider} failed:`, err);
    return back(`error=${encodeURIComponent((err as Error).message.slice(0, 200))}`);
  }
}
