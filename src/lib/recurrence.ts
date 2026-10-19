import type { Frequency } from "@prisma/client";

// Pure date math on UTC-midnight dates (the @db.Date convention).

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

export function advance(date: Date, frequency: Frequency, interval: number, anchorDay: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  if (frequency === "WEEKLY") return new Date(date.getTime() + 7 * interval * 86400000);
  const months = frequency === "MONTHLY" ? interval : 12 * interval;
  const total = m + months;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const day = Math.min(anchorDay, daysInMonth(ny, nm));
  return new Date(Date.UTC(ny, nm, day));
}

export type Occurrence = { recurringId: string; date: Date };

/** All occurrences of a recurring item between `from` and `to` (inclusive). */
export function occurrencesBetween(
  r: { id: string; nextDate: Date; endDate: Date | null; frequency: Frequency; interval: number; anchorDay: number },
  from: Date,
  to: Date,
  max = 60,
): Occurrence[] {
  const out: Occurrence[] = [];
  let d = r.nextDate;
  let guard = 0;
  while (d <= to && guard++ < 1000 && out.length < max) {
    if (r.endDate && d > r.endDate) break;
    if (d >= from) out.push({ recurringId: r.id, date: d });
    d = advance(d, r.frequency, r.interval, r.anchorDay);
  }
  return out;
}

/** Approximate monthly equivalent, for "fixed costs per month" summaries. */
export function monthlyEquivalentCents(amountCents: number, frequency: Frequency, interval: number): number {
  if (frequency === "WEEKLY") return Math.round((amountCents * 52) / 12 / interval);
  if (frequency === "MONTHLY") return Math.round(amountCents / interval);
  return Math.round(amountCents / 12 / interval);
}
