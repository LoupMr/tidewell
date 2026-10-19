import type { Connection } from "@prisma/client";
import { prisma } from "@/lib/db";
import { syncDaysAhead, syncIntervalMinutes } from "@/lib/env";
import { getAccessToken, ReauthRequired } from "@/lib/integrations/oauth";
import { syncMicrosoft } from "@/lib/integrations/microsoft";
import { syncGoogle } from "@/lib/integrations/google";
import { syncGithub } from "@/lib/integrations/github";

/** Sync one connection end-to-end and record the outcome. Never throws. */
export async function syncConnection(conn: Connection): Promise<{ ok: boolean; message?: string }> {
  const started = Date.now();
  // Window: from 24h ago (catches "earlier today" in any timezone) to N days ahead.
  const start = new Date(started - 24 * 3600 * 1000);
  const end = new Date(started + syncDaysAhead() * 24 * 3600 * 1000);
  try {
    const token = await getAccessToken(conn);
    if (conn.provider === "MICROSOFT") await syncMicrosoft(conn, token, start, end);
    else if (conn.provider === "GOOGLE") await syncGoogle(conn, token, start, end);
    else await syncGithub(conn, token);

    await prisma.connection.update({
      where: { id: conn.id },
      data: { status: "ACTIVE", lastSyncAt: new Date(), lastError: null },
    });
    await log(conn, true, null, Date.now() - started);
    return { ok: true };
  } catch (err) {
    const reauth = err instanceof ReauthRequired;
    const message = (err as Error).message?.slice(0, 500) || "Unknown error";
    console.error(`[sync] ${conn.provider} ${conn.label} failed:`, message);
    await prisma.connection
      .update({
        where: { id: conn.id },
        data: { status: reauth ? "NEEDS_REAUTH" : "ERROR", lastError: message, lastSyncAt: new Date() },
      })
      .catch(() => {});
    await log(conn, false, message, Date.now() - started);
    return { ok: false, message };
  }
}

async function log(conn: Connection, ok: boolean, message: string | null, durationMs: number) {
  await prisma.syncLog
    .create({ data: { userId: conn.userId, connectionId: conn.id, provider: conn.provider, ok, message, durationMs } })
    .catch(() => {});
}

let running = false;

/** Sync every connection that's due. Safe to call often; overlapping runs are skipped. */
export async function syncDue(): Promise<{ synced: number; failed: number; skipped?: boolean }> {
  if (running) return { synced: 0, failed: 0, skipped: true };
  running = true;
  try {
    const dueBefore = new Date(Date.now() - (syncIntervalMinutes() * 60 - 20) * 1000);
    const due = await prisma.connection.findMany({
      where: {
        status: { not: "NEEDS_REAUTH" },
        OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: dueBefore } }],
      },
      orderBy: { lastSyncAt: { sort: "asc", nulls: "first" } },
      take: 200,
    });
    let synced = 0;
    let failed = 0;
    for (const conn of due) {
      const r = await syncConnection(conn);
      if (r.ok) synced++;
      else failed++;
    }
    // Keep the log table small: 14 days is plenty to spot a pattern.
    await prisma.syncLog.deleteMany({ where: { ranAt: { lt: new Date(Date.now() - 14 * 86400000) } } }).catch(() => {});
    return { synced, failed };
  } finally {
    running = false;
  }
}

/** "Sync now" for one user — ignores the interval. */
export async function syncUser(userId: string) {
  const conns = await prisma.connection.findMany({ where: { userId } });
  const results = [];
  for (const c of conns) results.push(await syncConnection(c));
  return results;
}
