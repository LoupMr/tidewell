import clsx from "clsx";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, SkipForward, Trash2, Upload, Pause, Play } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getMonthTotals, getUpcoming } from "@/lib/queries";
import { formatDateOnly, formatMoney, todayISO } from "@/lib/format";
import { monthlyEquivalentCents } from "@/lib/recurrence";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Empty, PageHeader, SourcePill, Stat } from "@/components/ui";
import { UpcomingRow } from "@/components/rows";
import {
  addCategory,
  addRecurring,
  addTransaction,
  deleteCategory,
  deleteRecurring,
  deleteTransaction,
  markRecurringDone,
  skipRecurring,
  toggleRecurring,
} from "./actions";

export const metadata = { title: "Money" };
export const dynamic = "force-dynamic";

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

const FREQ_LABEL = { WEEKLY: "week", MONTHLY: "month", YEARLY: "year" } as const;

export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const v = user;
  const req = (await searchParams).month;
  const today = todayISO(user.timezone);
  const ym = req && /^\d{4}-\d{2}$/.test(req) ? req : today.slice(0, 7);

  const [month, upcoming, transactions, recurrings, categories, byCategory] = await Promise.all([
    getMonthTotals(user.id, user.timezone, `${ym}-01`),
    getUpcoming(user.id, user.timezone, 30),
    prisma.transaction.findMany({
      where: { userId: user.id, date: { gte: new Date(`${ym}-01T00:00:00Z`), lt: new Date(`${shiftMonth(ym, 1)}-01T00:00:00Z`) } },
      include: { category: { select: { name: true, color: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.recurring.findMany({
      where: { userId: user.id },
      include: { category: { select: { name: true, color: true } } },
      orderBy: [{ active: "desc" }, { nextDate: "asc" }],
    }),
    prisma.category.findMany({ where: { userId: user.id }, orderBy: [{ type: "asc" }, { name: "asc" }] }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId: user.id, type: "EXPENSE", date: { gte: new Date(`${ym}-01T00:00:00Z`), lt: new Date(`${shiftMonth(ym, 1)}-01T00:00:00Z`) } },
      _sum: { amountCents: true },
    }),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const breakdown = byCategory
    .map((r) => ({ cat: r.categoryId ? catMap.get(r.categoryId) : undefined, cents: r._sum.amountCents ?? 0 }))
    .sort((a, b) => b.cents - a.cents);
  const maxCat = Math.max(1, ...breakdown.map((b) => b.cents));

  const up = upcoming.filter((u) => u.type === "EXPENSE").reduce((s, u) => s + u.amountCents, 0);
  const incoming = upcoming.filter((u) => u.type === "INCOME").reduce((s, u) => s + u.amountCents, 0);
  const fixed = recurrings
    .filter((r) => r.active && r.type === "EXPENSE")
    .reduce((s, r) => s + monthlyEquivalentCents(r.amountCents, r.frequency, r.interval), 0);
  const monthLabel = new Intl.DateTimeFormat(user.locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`));

  const CategorySelect = ({ name = "categoryId" }: { name?: string }) => (
    <select name={name} className="input" defaultValue="">
      <option value="">No category</option>
      <optgroup label="Expense">
        {categories.filter((c) => c.type === "EXPENSE").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </optgroup>
      <optgroup label="Income">
        {categories.filter((c) => c.type === "INCOME").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </optgroup>
    </select>
  );

  return (
    <>
      <PageHeader eyebrow="Money in & out" title="Money">
        <Link href="/money/import" className="btn-ghost"><Upload className="h-4 w-4" /> Import CSV</Link>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bills next 30 days" value={formatMoney(up, v)} />
        <Stat label="Incoming next 30 days" value={formatMoney(incoming, v)} tone="ok" />
        <Stat label="Fixed costs / month" value={formatMoney(fixed, v)} />
        <Stat label={`Net · ${monthLabel}`} value={formatMoney(month.net, v, { signed: true })} tone={month.net < 0 ? "danger" : "ok"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="min-w-0 space-y-6 lg:col-span-3">
          <Card title="Coming up · next 30 days">
            {upcoming.length ? (
              <ul className="divide-y divide-line">
                {upcoming.map((u) => (
                  <UpcomingRow
                    key={`${u.recurringId}-${u.date.toISOString()}`}
                    u={u}
                    v={v}
                    actions={
                      u.isNext ? (
                        <div className="flex shrink-0 gap-1">
                          <form action={markRecurringDone.bind(null, u.recurringId)}>
                            <button className="btn-ghost px-2 py-1" title={u.type === "INCOME" ? "Mark received" : "Mark paid"}>
                              <Check className="h-4 w-4 text-accent" />
                            </button>
                          </form>
                          <form action={skipRecurring.bind(null, u.recurringId)}>
                            <button className="btn-ghost px-2 py-1" title="Skip this one"><SkipForward className="h-4 w-4" /></button>
                          </form>
                        </div>
                      ) : (
                        <span className="w-[4.5rem]" />
                      )
                    }
                  />
                ))}
              </ul>
            ) : (
              <Empty>Add recurring bills and income below to see what&apos;s coming.</Empty>
            )}
          </Card>

          <Card
            title={monthLabel}
            action={
              <div className="flex gap-1">
                <Link className="btn-ghost px-2 py-1" href={`/money?month=${shiftMonth(ym, -1)}`} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Link>
                <Link className="btn-ghost px-2 py-1" href={`/money?month=${shiftMonth(ym, 1)}`} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Link>
              </div>
            }
          >
            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              <div><p className="eyebrow">In</p><p className="num font-semibold text-ok">{formatMoney(month.income, v)}</p></div>
              <div><p className="eyebrow">Out</p><p className="num font-semibold">{formatMoney(month.expense, v)}</p></div>
              <div><p className="eyebrow">Net</p><p className={clsx("num font-semibold", month.net < 0 ? "text-danger" : "text-ok")}>{formatMoney(month.net, v, { signed: true })}</p></div>
            </div>
            {transactions.length ? (
              <ul className="divide-y divide-line">
                {transactions.map((t) => (
                  <li key={t.id} className="group flex items-center gap-3 py-2">
                    <span className="num w-14 shrink-0 text-sm text-muted">{formatDateOnly(t.date, v)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{t.description}</p>
                      {t.category && <SourcePill name={t.category.name} color={t.category.color} />}
                    </div>
                    <span className={clsx("num shrink-0 text-sm font-semibold", t.type === "INCOME" ? "text-ok" : "")}>
                      {t.type === "INCOME" ? "+" : "−"}{formatMoney(t.amountCents, v)}
                    </span>
                    <form action={deleteTransaction.bind(null, t.id)}>
                      <button className="rounded p-1 text-muted opacity-60 hover:text-danger group-hover:opacity-100" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No transactions this month.</Empty>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card title="Add transaction">
            <ActionForm action={addTransaction} className="grid grid-cols-2 gap-3">
              <select name="type" className="input col-span-2" defaultValue="EXPENSE">
                <option value="EXPENSE">Expense (money out)</option>
                <option value="INCOME">Income (money in)</option>
              </select>
              <input name="description" className="input col-span-2" placeholder="Description" required maxLength={200} />
              <input name="amount" className="input num" placeholder="0.00" inputMode="decimal" required />
              <input name="date" type="date" className="input num" defaultValue={today} required />
              <div className="col-span-2"><CategorySelect /></div>
              <button className="btn-primary col-span-2">Add</button>
            </ActionForm>
          </Card>

          <Card title="Spending by category">
            {breakdown.length ? (
              <ul className="space-y-2">
                {breakdown.map((b) => (
                  <li key={b.cat?.id ?? "none"}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{b.cat?.name ?? "Uncategorised"}</span>
                      <span className="num text-muted">{formatMoney(b.cents, v)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-2">
                      <div className="h-1.5 rounded-full" style={{ width: `${(b.cents / maxCat) * 100}%`, background: b.cat?.color ?? "var(--muted)" }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No spending recorded this month.</Empty>
            )}
          </Card>

          <Card title="Recurring bills & income">
            {recurrings.length > 0 && (
              <ul className="mb-4 divide-y divide-line">
                {recurrings.map((r) => (
                  <li key={r.id} className={clsx("flex items-center gap-2 py-2", !r.active && "opacity-50")}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {r.name} {!r.active && <Badge>Paused</Badge>}
                      </p>
                      <p className="num text-xs text-muted">
                        every {r.interval > 1 ? `${r.interval} ` : ""}{FREQ_LABEL[r.frequency]}{r.interval > 1 ? "s" : ""} · next {formatDateOnly(r.nextDate, v)}
                      </p>
                    </div>
                    <span className={clsx("num text-sm font-semibold", r.type === "INCOME" && "text-ok")}>
                      {r.type === "INCOME" ? "+" : "−"}{formatMoney(r.amountCents, v)}
                    </span>
                    <form action={toggleRecurring.bind(null, r.id)}>
                      <button className="rounded p-1 text-muted hover:text-ink" title={r.active ? "Pause" : "Resume"}>
                        {r.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </button>
                    </form>
                    <form action={deleteRecurring.bind(null, r.id)}>
                      <button className="rounded p-1 text-muted hover:text-danger" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={addRecurring} className="grid grid-cols-2 gap-3">
              <select name="type" className="input col-span-2" defaultValue="EXPENSE">
                <option value="EXPENSE">Bill / subscription</option>
                <option value="INCOME">Income (salary, client…)</option>
              </select>
              <input name="name" className="input col-span-2" placeholder="Name (e.g. Rent, Netflix, Salary)" required maxLength={120} />
              <input name="amount" className="input num" placeholder="0.00" inputMode="decimal" required />
              <div className="flex gap-2">
                <input name="interval" type="number" min={1} max={52} defaultValue={1} className="input num w-16" aria-label="Every N" />
                <select name="frequency" className="input" defaultValue="MONTHLY">
                  <option value="WEEKLY">week(s)</option>
                  <option value="MONTHLY">month(s)</option>
                  <option value="YEARLY">year(s)</option>
                </select>
              </div>
              <div>
                <label className="label">Next date</label>
                <input name="nextDate" type="date" className="input num" defaultValue={today} required />
              </div>
              <div>
                <label className="label">Ends (optional)</label>
                <input name="endDate" type="date" className="input num" />
              </div>
              <div className="col-span-2"><CategorySelect /></div>
              <button className="btn-primary col-span-2">Add recurring</button>
            </ActionForm>
          </Card>

          <Card title="Categories">
            <div className="mb-4 flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <form key={c.id} action={deleteCategory.bind(null, c.id)} className="group inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-0.5 pl-2 pr-1 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
                  {c.name}
                  <span className="text-[10px] text-muted">{c.type === "INCOME" ? "in" : "out"}</span>
                  <button className="rounded-full px-1 text-muted hover:text-danger" title={`Delete ${c.name}`}>×</button>
                </form>
              ))}
            </div>
            <ActionForm action={addCategory} className="flex gap-2">
              <input name="name" className="input" placeholder="New category" required maxLength={40} />
              <select name="type" className="input w-28" defaultValue="EXPENSE">
                <option value="EXPENSE">Out</option>
                <option value="INCOME">In</option>
              </select>
              <input name="color" type="color" defaultValue="#64748b" className="h-9 w-10 shrink-0 rounded border border-line bg-surface" aria-label="Colour" />
              <button className="btn-ghost">Add</button>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
