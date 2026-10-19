import clsx from "clsx";
import { RefreshCw, Eye, EyeOff } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ALL_PROVIDERS, isConfigured, isProviderSlug, providerConfig, slugFor } from "@/lib/integrations/providers";
import { relativeFromNow } from "@/lib/format";
import { syncIntervalMinutes } from "@/lib/env";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, PageHeader, SourcePill } from "@/components/ui";
import { changePassword, deleteAccount, disconnect, syncNow, toggleCalendar, updateProfile } from "./actions";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

const revokeUrl = {
  microsoft: "https://myaccount.microsoft.com/",
  google: "https://myaccount.google.com/connections",
  github: "https://github.com/settings/applications",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; warning?: string; welcome?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const [connections, sources, logs] = await Promise.all([
    prisma.connection.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.calendarSource.findMany({
      where: { userId: user.id },
      include: { connection: { select: { label: true, provider: true } }, _count: { select: { events: true } } },
      orderBy: [{ connectionId: "asc" }, { name: "asc" }],
    }),
    prisma.syncLog.findMany({ where: { userId: user.id }, orderBy: { ranAt: "desc" }, take: 10 }),
  ]);

  return (
    <>
      <PageHeader eyebrow="Accounts & preferences" title="Settings">
        {connections.length > 0 && (
          <form action={syncNow}>
            <button className="btn-ghost"><RefreshCw className="h-4 w-4" /> Sync now</button>
          </form>
        )}
      </PageHeader>

      {sp.welcome && (
        <div className="card mb-6 border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent">
          Welcome to Tidewell. Connect your accounts below — everything is read-only.
        </div>
      )}
      {sp.connected && (
        <div className="card mb-6 border-ok/40 bg-ok-soft px-4 py-3 text-sm text-ok">
          Connected {isProviderSlug(sp.connected) ? providerConfig(sp.connected).name : "account"}.{sp.warning ? ` First sync had a problem: ${sp.warning}` : ""}
        </div>
      )}
      {sp.error && (
        <div className="card mb-6 border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          {sp.error === "provider_not_configured"
            ? "That provider isn't configured on this instance yet — whoever runs this server needs to add its OAuth keys (see docs/INTEGRATIONS.md)."
            : `Couldn't connect: ${sp.error}`}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Connected accounts" className="lg:col-span-2">
          <p className="-mt-2 mb-4 text-sm text-muted">
            Synced automatically every {syncIntervalMinutes()} minutes. You can connect several accounts per provider.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {ALL_PROVIDERS.map((slug) => {
              const cfg = providerConfig(slug);
              const mine = connections.filter((c) => slugFor(c.provider) === slug);
              const configured = isConfigured(slug);
              return (
                <div key={slug} className="rounded-lg border border-line p-4">
                  <p className="font-semibold">{cfg.name}</p>
                  <p className="mb-3 text-xs text-muted">{cfg.description}</p>
                  <ul className="mb-3 space-y-2">
                    {mine.map((c) => (
                      <li key={c.id} className="rounded-md bg-surface-2 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{c.label}</span>
                          <Badge tone={c.status === "ACTIVE" ? "ok" : c.status === "NEEDS_REAUTH" ? "warn" : "danger"}>
                            {c.status === "ACTIVE" ? "Connected" : c.status === "NEEDS_REAUTH" ? "Reconnect" : "Error"}
                          </Badge>
                        </div>
                        <p className="num mt-1 text-xs text-muted">
                          {c.lastSyncAt ? `synced ${relativeFromNow(c.lastSyncAt, user)}` : "not synced yet"}
                        </p>
                        {c.lastError && <p className="mt-1 break-words text-xs text-danger">{c.lastError}</p>}
                        <div className="mt-2 flex gap-3 text-xs">
                          {c.status !== "ACTIVE" && configured && (
                            <a className="font-semibold text-accent hover:underline" href={`/api/connect/${slug}`}>Reconnect</a>
                          )}
                          <form action={disconnect.bind(null, c.id)}>
                            <button className="text-muted hover:text-danger">Disconnect</button>
                          </form>
                          <a className="text-muted hover:underline" href={revokeUrl[slug]} target="_blank" rel="noreferrer">Revoke at provider</a>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {configured ? (
                    <a href={`/api/connect/${slug}`} className="btn-primary w-full">
                      {mine.length ? "Connect another" : "Connect"}
                    </a>
                  ) : (
                    <p className="rounded-md border border-dashed border-warn/50 bg-warn-soft px-3 py-2 text-xs text-warn">
                      Not configured on this instance (missing OAuth client id/secret).
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Calendars in the merged view" className="lg:col-span-2">
          <div id="calendars" />
          {sources.length ? (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sources.map((s) => (
                <li key={s.id} className={clsx("flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2", s.muted && "opacity-50")}>
                  <div className="min-w-0">
                    <SourcePill name={s.name} color={s.color} />
                    <p className="mt-1 truncate text-xs text-muted">{s.connection.label} · <span className="num">{s._count.events}</span> events</p>
                  </div>
                  <form action={toggleCalendar.bind(null, s.id)}>
                    <button className="btn-ghost px-2 py-1" title={s.muted ? "Show in merged view" : "Hide from merged view"}>
                      {s.muted ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Calendars appear here after you connect Outlook or Google.</p>
          )}
        </Card>

        <Card title="Profile">
          <ActionForm action={updateProfile} className="grid grid-cols-2 gap-3" resetOnSuccess={false}>
            <div className="col-span-2">
              <label className="label">Name</label>
              <input name="name" className="input" defaultValue={user.name} required />
            </div>
            <div className="col-span-2">
              <label className="label">Timezone</label>
              <input name="timezone" className="input" defaultValue={user.timezone} placeholder="Europe/Paris" required />
            </div>
            <div>
              <label className="label">Locale</label>
              <input name="locale" className="input" defaultValue={user.locale} placeholder="fr-FR" required />
            </div>
            <div>
              <label className="label">Currency</label>
              <input name="currency" className="input uppercase" defaultValue={user.currency} maxLength={3} required />
            </div>
            <button className="btn-primary col-span-2">Save</button>
          </ActionForm>
        </Card>

        <Card title="Password">
          <ActionForm action={changePassword} className="space-y-3">
            <input name="current" type="password" className="input" placeholder="Current password" autoComplete="current-password" required />
            <input name="next" type="password" className="input" placeholder="New password (10+ characters)" autoComplete="new-password" minLength={10} required />
            <button className="btn-primary">Change password</button>
          </ActionForm>
        </Card>

        <Card title="Recent syncs">
          {logs.length ? (
            <ul className="space-y-1.5 text-sm">
              {logs.map((l) => (
                <li key={l.id} className="flex items-start gap-2">
                  <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", l.ok ? "bg-ok" : "bg-danger")} />
                  <span className="num w-24 shrink-0 text-xs text-muted">{relativeFromNow(l.ranAt, user)}</span>
                  <span className="text-xs">{l.provider.toLowerCase()} · <span className="num">{l.durationMs}ms</span>{l.message ? ` — ${l.message}` : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No syncs yet.</p>
          )}
        </Card>

        <Card title="Danger zone">
          <p className="mb-3 text-sm text-muted">Deletes your account, connections and all finance data on this server. This can&apos;t be undone.</p>
          <ActionForm action={deleteAccount} className="space-y-3">
            <input name="confirm" className="input" placeholder={`Type ${user.email} to confirm`} required />
            <button className="btn-danger">Delete my account</button>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
