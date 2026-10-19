import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { currentUserId } from "@/lib/session";
import { randomToken } from "@/lib/crypto";
import { appUrl } from "@/lib/env";
import { isConfigured, isProviderSlug, providerConfig } from "@/lib/integrations/providers";
import { redirectUri } from "@/lib/integrations/oauth";

export const dynamic = "force-dynamic";

// GET /api/connect/:provider → redirect to the provider's consent screen.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const userId = await currentUserId();
  if (!userId) return NextResponse.redirect(`${appUrl()}/login`);
  if (!isProviderSlug(provider) || !isConfigured(provider)) {
    return NextResponse.redirect(`${appUrl()}/settings?error=provider_not_configured`);
  }

  const cfg = providerConfig(provider);
  const state = randomToken(24);
  (await cookies()).set("tw_oauth_state", `${provider}:${state}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/connect",
    maxAge: 600,
  });

  const url = new URL(cfg.authUrl);
  url.search = new URLSearchParams({
    client_id: cfg.clientId!,
    redirect_uri: redirectUri(provider),
    response_type: "code",
    scope: cfg.scopes.join(" "),
    state,
    ...(cfg.extraAuthParams ?? {}),
  }).toString();
  return NextResponse.redirect(url.toString());
}
