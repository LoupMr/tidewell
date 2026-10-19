import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { syncDue } from "@/lib/sync";

export const dynamic = "force-dynamic";

// Optional external trigger (Synology Task Scheduler, GitHub Actions, …).
// The built-in scheduler already runs every minute, so you only need this if
// you set SYNC_DISABLED=true and drive syncing yourself.
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/sync
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await syncDue());
}
