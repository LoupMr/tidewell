// Central place to read configuration. Keep secrets server-side only.

export function appUrl(): string {
  const url = process.env.AUTH_URL || process.env.APP_URL || "http://localhost:3020";
  return url.replace(/\/$/, "");
}

export type RegistrationMode = "open" | "invite" | "closed";

/**
 * open    — anyone can create an account (public instance)
 * invite  — only emails listed in REGISTRATION_ALLOWLIST (comma-separated)
 * closed  — nobody new, except the very first account on an empty instance
 */
export function registrationMode(): RegistrationMode {
  const v = (process.env.REGISTRATION_MODE || "open").toLowerCase();
  return v === "invite" || v === "closed" ? v : "open";
}

export function registrationAllowlist(): string[] {
  return (process.env.REGISTRATION_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function syncIntervalMinutes(): number {
  const n = Number(process.env.SYNC_INTERVAL_MINUTES || 5);
  return Number.isFinite(n) && n >= 1 ? n : 5;
}

export function syncDaysAhead(): number {
  const n = Number(process.env.SYNC_DAYS_AHEAD || 30);
  return Number.isFinite(n) && n >= 1 && n <= 365 ? n : 30;
}
