import { syncDue } from "./index";

// In-process scheduler, started once from src/instrumentation.ts when the
// Next.js server boots. A single NAS container needs nothing fancier: no
// separate worker, no cron container. Ticks every minute; syncDue() only
// touches connections whose last sync is older than SYNC_INTERVAL_MINUTES.

const g = globalThis as unknown as { __tidewellScheduler?: NodeJS.Timeout };

export function startScheduler() {
  if (g.__tidewellScheduler) return;
  const tick = () =>
    syncDue()
      .then((r) => {
        if (!r.skipped && (r.synced || r.failed)) console.log(`[sync] tick: ${r.synced} ok, ${r.failed} failed`);
      })
      .catch((err) => console.error("[sync] tick crashed:", err));
  // Small delay so migrations/DB are surely up before the first run.
  setTimeout(tick, 15_000);
  g.__tidewellScheduler = setInterval(tick, 60_000);
  console.log("[sync] scheduler started");
}
