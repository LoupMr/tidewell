import clsx from "clsx";
import Link from "next/link";
import { ExternalLink, Flag, GitPullRequest, CircleDot, AlertTriangle } from "lucide-react";
import type { Provider } from "@prisma/client";
import { Badge, SourcePill } from "./ui";
import { formatDateOnly, formatMoney, formatTime, relativeFromNow, type Viewer } from "@/lib/format";
import type { AgendaEvent, UpcomingItem } from "@/lib/queries";

const providerName: Record<Provider, string> = { MICROSOFT: "Outlook", GOOGLE: "Google", GITHUB: "GitHub" };

export function EventRow({ e, v, now = new Date() }: { e: AgendaEvent; v: Viewer; now?: Date }) {
  const live = !e.isAllDay && e.startAt <= now && e.endAt > now;
  const past = e.endAt <= now;
  const declined = e.responseStatus === "declined";
  return (
    <li className={clsx("flex gap-4 py-2.5", past && "opacity-55")}>
      <div className="num w-24 shrink-0 pt-0.5 text-sm text-muted">
        {e.isAllDay ? (
          <span className="text-xs uppercase tracking-wider">All day</span>
        ) : (
          <>
            <span className={clsx(live && "font-semibold text-accent")}>{formatTime(e.startAt, v)}</span>
            <span className="block text-xs">{formatTime(e.endAt, v)}</span>
          </>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {live && <Badge tone="accent">Now</Badge>}
          {e.responseStatus === "needsAction" || e.responseStatus === "notResponded" ? <Badge tone="warn">Not answered</Badge> : null}
          {e.url ? (
            <a href={e.url} target="_blank" rel="noreferrer" className={clsx("font-medium hover:underline", declined && "line-through")}>
              {e.title}
            </a>
          ) : (
            <span className={clsx("font-medium", declined && "line-through")}>{e.title}</span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
          <SourcePill name={`${e.source.name} · ${providerName[e.source.connection.provider]}`} color={e.source.color} />
          {e.location && <span className="truncate">{e.location}</span>}
        </div>
      </div>
    </li>
  );
}

export function MailRow({
  m,
  v,
}: {
  m: { id: string; fromName: string | null; fromAddress: string | null; subject: string; snippet: string | null; receivedAt: Date; isFlagged: boolean; url: string | null; connection: { label: string; provider: Provider } };
  v: Viewer;
}) {
  const Body = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-sm font-semibold">
          {m.isFlagged && <Flag className="mr-1 inline h-3.5 w-3.5 text-warn" aria-label="Flagged" />}
          {m.fromName || m.fromAddress || "Unknown sender"}
        </p>
        <span className="num shrink-0 text-xs text-muted">{relativeFromNow(m.receivedAt, v)}</span>
      </div>
      <p className="truncate text-sm">{m.subject}</p>
      {m.snippet && <p className="truncate text-xs text-muted">{m.snippet}</p>}
      <div className="mt-1">
        <SourcePill name={m.connection.label} />
      </div>
    </>
  );
  return (
    <li className="py-2.5">
      {m.url ? (
        <a href={m.url} target="_blank" rel="noreferrer" className="block rounded-lg hover:bg-surface-2 -mx-2 px-2 py-1">
          {Body}
        </a>
      ) : (
        Body
      )}
    </li>
  );
}

export function GithubRow({
  i,
  v,
}: {
  i: { id: string; kind: string; repo: string; number: number; title: string; url: string; author: string | null; isDraft: boolean; updatedAt: Date };
  v: Viewer;
}) {
  const Icon = i.kind === "ISSUE_ASSIGNED" ? CircleDot : GitPullRequest;
  return (
    <li>
      <a href={i.url} target="_blank" rel="noreferrer" className="-mx-2 flex gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {i.title} {i.isDraft && <Badge>Draft</Badge>}
          </p>
          <p className="num truncate text-xs text-muted">
            {i.repo}#{i.number}
            {i.author ? ` · ${i.author}` : ""} · {relativeFromNow(i.updatedAt, v)}
          </p>
        </div>
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
      </a>
    </li>
  );
}

export function UpcomingRow({ u, v, actions }: { u: UpcomingItem; v: Viewer; actions?: React.ReactNode }) {
  const income = u.type === "INCOME";
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="num w-16 shrink-0 text-sm text-muted">{formatDateOnly(u.date, v)}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {u.name} {u.overdue && <Badge tone="warn">Overdue</Badge>}
        </p>
        {u.category && <SourcePill name={u.category.name} color={u.category.color} />}
      </div>
      <div className={clsx("num shrink-0 text-sm font-semibold", income ? "text-ok" : "text-ink")}>
        {income ? "+" : "−"}
        {formatMoney(u.amountCents, v)}
      </div>
      {actions}
    </li>
  );
}

export function StatusStrip({
  connections,
  v,
}: {
  connections: { id: string; provider: Provider; label: string; status: string; lastSyncAt: Date | null; lastError: string | null }[];
  v: Viewer;
}) {
  if (!connections.length) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-3 border-warn/40 bg-warn-soft px-4 py-3 text-sm">
        <span className="text-warn">No accounts connected yet — calendars, inbox and GitHub will appear once you connect them.</span>
        <Link href="/settings" className="btn-ghost">Connect accounts</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {connections.map((c) => {
        const tone = c.status === "ACTIVE" ? "ok" : c.status === "NEEDS_REAUTH" ? "warn" : "danger";
        const dot = { ok: "bg-ok", warn: "bg-warn", danger: "bg-danger" }[tone];
        return (
          <Link
            key={c.id}
            href="/settings"
            title={c.lastError ?? undefined}
            className="card flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-2"
          >
            <span className={clsx("h-2 w-2 rounded-full", dot)} />
            <span className="font-semibold">{providerName[c.provider]}</span>
            <span className="max-w-[10rem] truncate text-muted">{c.label}</span>
            <span className="num text-muted">
              {c.status === "NEEDS_REAUTH" ? (
                <span className="inline-flex items-center gap-1 text-warn"><AlertTriangle className="h-3 w-3" /> reconnect</span>
              ) : c.status === "ERROR" ? (
                <span className="text-danger">sync failed</span>
              ) : c.lastSyncAt ? (
                relativeFromNow(c.lastSyncAt, v)
              ) : (
                "pending"
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
