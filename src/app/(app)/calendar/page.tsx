import clsx from "clsx";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getEvents, groupByDay, todayWindow } from "@/lib/queries";
import { dateOnly, formatDay } from "@/lib/format";
import { Card, Empty, PageHeader, SourcePill } from "@/components/ui";
import { EventRow } from "@/components/rows";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

const RANGES = [1, 2, 7, 14, 30];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const user = await requireUser();
  const days = RANGES.includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 7;
  const { iso, from, to } = todayWindow(user.timezone, days);
  const [events, sources] = await Promise.all([
    getEvents(user.id, from, to),
    prisma.calendarSource.findMany({
      where: { userId: user.id },
      include: { connection: { select: { label: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  const grouped = groupByDay(events, user.timezone, iso, days);
  const now = new Date();
  const muted = sources.filter((s) => s.muted).length;

  return (
    <>
      <AutoRefresh seconds={120} />
      <PageHeader eyebrow={`${sources.length - muted} calendars merged`} title="Calendar">
        <div className="flex rounded-lg border border-line bg-surface p-0.5">
          {RANGES.map((d) => (
            <Link
              key={d}
              href={`/calendar?days=${d}`}
              className={clsx("num rounded-md px-3 py-1 text-sm", d === days ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:text-ink")}
            >
              {d === 1 ? "Today" : `${d}d`}
            </Link>
          ))}
        </div>
      </PageHeader>

      {sources.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {sources.filter((s) => !s.muted).map((s) => <SourcePill key={s.id} name={s.name} color={s.color} />)}
          {muted > 0 && (
            <Link href="/settings#calendars" className="text-xs text-muted underline">
              {muted} muted
            </Link>
          )}
        </div>
      )}

      {sources.length === 0 ? (
        <Empty href="/settings" cta="Connect Outlook or Google">No calendars connected yet.</Empty>
      ) : (
        <div className="space-y-4">
          {grouped.map((g, idx) => (
            <Card key={g.day} title={idx === 0 ? "Today" : idx === 1 ? "Tomorrow" : formatDay(dateOnly(g.day), { ...user, timezone: "UTC" }, { weekday: "long" })}>
              {g.events.length ? (
                <ul className="divide-y divide-line">{g.events.map((e) => <EventRow key={`${g.day}-${e.id}`} e={e} v={user} now={now} />)}</ul>
              ) : (
                <p className="text-sm text-muted">Free.</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
