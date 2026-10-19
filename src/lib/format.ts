// Display helpers. Everything is rendered server-side in the user's own
// timezone/locale, so the page never flashes a different time.

export type Viewer = { timezone: string; locale: string; currency: string };

export function formatMoney(cents: number, v: Viewer, opts: { signed?: boolean } = {}): string {
  const s = new Intl.NumberFormat(v.locale, {
    style: "currency",
    currency: v.currency,
    signDisplay: opts.signed ? "exceptZero" : "auto",
  }).format(cents / 100);
  return s;
}

export function formatTime(d: Date, v: Viewer): string {
  return new Intl.DateTimeFormat(v.locale, { timeZone: v.timezone, hour: "2-digit", minute: "2-digit" }).format(d);
}

export function formatDay(d: Date, v: Viewer, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(v.locale, {
    timeZone: v.timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    ...opts,
  }).format(d);
}

/** For @db.Date columns (stored as UTC midnight) — format without shifting zones. */
export function formatDateOnly(d: Date, v: Viewer, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(v.locale, { timeZone: "UTC", day: "numeric", month: "short", ...opts }).format(d);
}

export function relativeFromNow(d: Date, v: Viewer): string {
  const diff = (d.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(v.locale, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

/** YYYY-MM-DD of "now" in a timezone. */
export function todayISO(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

/** YYYY-MM-DD key of an instant in a timezone (for grouping events by day). */
export function dayKey(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(d);
}

/** Parse YYYY-MM-DD as a UTC-midnight Date (for @db.Date columns). */
export function dateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Midnight at the start of `iso` day in `timezone`, as an absolute instant. */
export function zonedDayStart(iso: string, timezone: string): Date {
  const guess = new Date(`${iso}T00:00:00.000Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  const offset = asIfUtc - guess.getTime();
  return new Date(guess.getTime() - offset);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

/** "12,50" / "-1 234.56" / "1.234,56" → cents. Returns null when unparsable. */
export function parseAmountToCents(input: string): number | null {
  let s = input.trim().replace(/[\s  €$£]/g, "");
  if (!s) return null;
  const neg = /^-|^\(.*\)$|-$/.test(s);
  s = s.replace(/[()+-]/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastDot === -1 && /^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, ""); // "1,234" → thousands
  else if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  return neg ? -cents : cents;
}
