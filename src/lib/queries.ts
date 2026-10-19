import { prisma } from "@/lib/db";
import { occurrencesBetween } from "@/lib/recurrence";
import { addDays, dateOnly, dayKey, isoDate, todayISO, zonedDayStart } from "@/lib/format";

// Read-side helpers shared by the pages. Pages only ever read the DB.

export type AgendaEvent = Awaited<ReturnType<typeof getEvents>>[number];

export async function getEvents(userId: string, from: Date, to: Date) {
  return prisma.calendarEvent.findMany({
    where: { userId, endAt: { gt: from }, startAt: { lt: to }, source: { muted: false } },
    include: { source: { select: { name: true, color: true, connection: { select: { provider: true, label: true } } } } },
    orderBy: [{ isAllDay: "desc" }, { startAt: "asc" }],
  });
}

/** Group events into days (YYYY-MM-DD in the viewer's timezone), from `fromISO` for `days` days. */
export function groupByDay(events: AgendaEvent[], timezone: string, fromISO: string, days: number) {
  const keys: string[] = [];
  for (let i = 0; i < days; i++) keys.push(isoDate(addDays(dateOnly(fromISO), i)));
  const map = new Map<string, AgendaEvent[]>(keys.map((k) => [k, []]));
  for (const e of events) {
    if (e.isAllDay) {
      // All-day events are date-based: show them on every day they cover.
      for (const k of keys) {
        const d = dateOnly(k);
        if (e.startAt <= d && e.endAt > d) map.get(k)!.push(e);
      }
    } else {
      let k = dayKey(e.startAt, timezone);
      if (k < keys[0]) k = keys[0]; // started earlier, still running
      map.get(k)?.push(e);
    }
  }
  return keys.map((k) => ({ day: k, events: map.get(k)! }));
}

export function todayWindow(timezone: string, days = 1) {
  const iso = todayISO(timezone);
  const from = zonedDayStart(iso, timezone);
  const to = zonedDayStart(isoDate(addDays(dateOnly(iso), days)), timezone);
  return { iso, from, to };
}

export type UpcomingItem = {
  recurringId: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  amountCents: number;
  date: Date;
  overdue: boolean;
  isNext: boolean; // only the next occurrence can be marked paid / skipped
  category: { name: string; color: string } | null;
};

/** Upcoming (and overdue) occurrences of recurring bills / income in the next `days` days. */
export async function getUpcoming(userId: string, timezone: string, days: number): Promise<UpcomingItem[]> {
  const today = dateOnly(todayISO(timezone));
  const until = addDays(today, days);
  const recurrings = await prisma.recurring.findMany({
    where: { userId, active: true, nextDate: { lte: until } },
    include: { category: { select: { name: true, color: true } } },
  });
  const out: UpcomingItem[] = [];
  for (const r of recurrings) {
    for (const o of occurrencesBetween(r, new Date(0), until, 12)) {
      out.push({
        recurringId: r.id,
        name: r.name,
        type: r.type,
        amountCents: r.amountCents,
        date: o.date,
        overdue: o.date < today,
        isNext: o.date.getTime() === r.nextDate.getTime(),
        category: r.category,
      });
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export async function getMonthTotals(userId: string, timezone: string, monthISO?: string) {
  const ym = (monthISO ?? todayISO(timezone)).slice(0, 7);
  const start = dateOnly(`${ym}-01`);
  const [y, m] = ym.split("-").map(Number);
  const end = new Date(Date.UTC(y, m, 1));
  const rows = await prisma.transaction.groupBy({
    by: ["type"],
    where: { userId, date: { gte: start, lt: end } },
    _sum: { amountCents: true },
  });
  const income = rows.find((r) => r.type === "INCOME")?._sum.amountCents ?? 0;
  const expense = rows.find((r) => r.type === "EXPENSE")?._sum.amountCents ?? 0;
  return { ym, start, end, income, expense, net: income - expense };
}

export async function getConnectionsStatus(userId: string) {
  return prisma.connection.findMany({
    where: { userId },
    orderBy: [{ provider: "asc" }, { label: "asc" }],
    select: { id: true, provider: true, label: true, status: true, lastSyncAt: true, lastError: true, mailUnreadCount: true },
  });
}
