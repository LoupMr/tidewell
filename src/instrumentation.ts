export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SYNC_DISABLED !== "true") {
    const { startScheduler } = await import("./lib/sync/scheduler");
    startScheduler();
  }
}
