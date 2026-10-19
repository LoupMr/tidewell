import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getConnectionsStatus, getEvents, getMonthTotals, getUpcoming, groupByDay, todayWindow } from "@/lib/queries";
import { formatDay, formatMoney, dateOnly } from "@/lib/format";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";
import { EventRow, GithubRow, MailRow, StatusStrip, UpcomingRow } from "@/components/rows";
import { AutoRefresh } from "@/components/auto-refresh";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireUser();
  const v = user;
  const now = new Date();
  const { iso, from, to } = todayWindow(user.timezone, 2); // today + tomorrow

  const [events, connections, upcoming, month, reviews, assigned, mail] = await Promise.all([
    getEvents(user.id, from, to),
    getConnectionsStatus(user.id),
    getUpcoming(user.id, user.timezone, 7),
    getMonthTotals(user.id, user.timezone),
    prisma.githubItem.findMany({ where: { userId: user.id, kind: "PR_REVIEW_REQUESTED" }, orderBy: { updatedAt: "desc" }, take: 5 }),
    prisma.githubItem.findMany({ where: { userId: user.id, kind: "ISSUE_ASSIGNED" }, orderBy: { updatedAt: "desc" }, take: 5 }),
    prisma.mailMessage.findMany({
      where: { userId: user.id },
      include: { connection: { select: { label: true, provider: true } } },
      orderBy: { receivedAt: "desc" },
      take: 6,
    }),
  ]);
  const [today, tomorrow] = groupByDay(events, user.timezone, iso, 2);
  const unread = connections.reduce((s, c) => s + (c.mailUnreadCount ?? 0), 0);
  const remaining = today.events.filter((e) => e.endAt > now).length;
  const dueSoon = upcoming.filter((u) => u.type === "EXPENSE").reduce((s, u) => s + u.amountCents, 0);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: user.timezone, hour: "numeric", hourCycle: "h23" }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <AutoRefresh seconds={60} />
      <PageHeader eyebrow={formatDay(now, v, { weekday: "long", month: "long" })} title={`${greeting}, ${user.name.split(" ")[0]}`} />

      <div className="mb-6">
        <StatusStrip connections={connections} v={v} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Events left today" value={remaining} tone={remaining ? "accent" : undefined} />
        <Stat label="Unread mail" value={unread} />
        <Stat label="Reviews waiting" value={reviews.length} tone={reviews.length ? "warn" : undefined} />
        <Stat label="Bills next 7 days" value={formatMoney(dueSoon, v)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="min-w-0 space-y-6 lg:col-span-3">
          <Card title="Today" action={<Link href="/calendar" className="text-sm font-semibold text-accent hover:underline">Full calendar</Link>}>
            {today.events.length ? (
              <ul className="divide-y divide-line">{today.events.map((e) => <EventRow key={e.id} e={e} v={v} now={now} />)}</ul>
            ) : (
              <Empty>{connections.length ? "Nothing on the calendar today." : "Connect a calendar to see your day."}</Empty>
            )}
          </Card>
          {tomorrow.events.length > 0 && (
            <Card title={`Tomorrow · ${formatDay(dateOnly(tomorrow.day), { ...v, timezone: "UTC" })}`}>
              <ul className="divide-y divide-line">{tomorrow.events.map((e) => <EventRow key={e.id} e={e} v={v} now={now} />)}</ul>
            </Card>
          )}
          <Card title="Latest unread" action={<Link href="/inbox" className="text-sm font-semibold text-accent hover:underline">Inbox</Link>}>
            {mail.length ? <ul className="divide-y divide-line">{mail.map((m) => <MailRow key={m.id} m={m} v={v} />)}</ul> : <Empty>Inbox zero, or no mail account connected.</Empty>}
          </Card>
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card title="Money this month" action={<Link href="/money" className="text-sm font-semibold text-accent hover:underline">Money</Link>}>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div><p className="eyebrow">In</p><p className="num text-sm font-semibold text-ok">{formatMoney(month.income, v)}</p></div>
              <div><p className="eyebrow">Out</p><p className="num text-sm font-semibold">{formatMoney(month.expense, v)}</p></div>
              <div><p className="eyebrow">Net</p><p className={`num text-sm font-semibold ${month.net < 0 ? "text-danger" : "text-ok"}`}>{formatMoney(month.net, v, { signed: true })}</p></div>
            </div>
            <p className="eyebrow mb-1">Coming up · 7 days</p>
            {upcoming.length ? (
              <ul className="divide-y divide-line">{upcoming.slice(0, 6).map((u) => <UpcomingRow key={`${u.recurringId}-${u.date.toISOString()}`} u={u} v={v} />)}</ul>
            ) : (
              <Empty href="/money" cta="Add a recurring bill or income">Nothing due this week.</Empty>
            )}
          </Card>
          <Card title="Waiting on your review">
            {reviews.length ? <ul>{reviews.map((i) => <GithubRow key={i.id} i={i} v={v} />)}</ul> : <Empty>No review requests.</Empty>}
          </Card>
          <Card title="Assigned to you" action={<Link href="/github" className="text-sm font-semibold text-accent hover:underline">GitHub</Link>}>
            {assigned.length ? <ul>{assigned.map((i) => <GithubRow key={i.id} i={i} v={v} />)}</ul> : <Empty>No open issues assigned.</Empty>}
          </Card>
        </div>
      </div>
    </>
  );
}
