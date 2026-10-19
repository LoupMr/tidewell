# Tidewell

**Everything that needs you, on one calm page.**

Tidewell is a self-hosted personal dashboard. It merges every calendar you have (Outlook work, shared and
delegated calendars, Google calendars) into a single timeline. Next to that it shows unread mail from each
inbox, the GitHub issues and pull requests waiting on you, and your money: what you spent, the bills coming
up and the income on its way.

It is **read-only** towards your accounts: it never sends mail, edits events or touches your repos. It runs
on your own server, so your OAuth tokens (encrypted at rest) and your finance data stay there.

> Status: **v0.1, early but usable.** See [docs/ROADMAP.md](docs/ROADMAP.md) for what's next.

---

## Features

| Area | What you get |
| --- | --- |
| **Unified calendar** | Every Outlook calendar (`/me/calendars` → `calendarView` per calendar) and every visible Google calendar, merged chronologically. Each event carries a **source pill** naming its calendar. Mute any calendar from the merged view. Views for today, 2, 7, 14 or 30 days. |
| **Inbox snapshot** | Unread count per account, plus the latest 25 unread messages from each Outlook / Gmail inbox, with flagged/starred mail pulled out. Click through to the real message. |
| **GitHub triage** | Three lists across every repo you can see: *awaiting your review*, *assigned to you*, *your open PRs*. |
| **Money** | Manual transactions, **recurring bills & income** (weekly / monthly / yearly, every N), a 30-day *coming up* list with "mark paid / received" and "skip", spending by category, month-by-month history, and **bank CSV import** that handles French/European formats (`;`, `1 234,56`, `DD/MM/YYYY`, Windows-1252) and never imports duplicates. |
| **Live** | A built-in scheduler syncs every connected account every 5 minutes. Pages re-read the database every minute. A slow API never blocks the page. |
| **Accounts** | Email + password sign-up (open, invite-only or closed), several connected accounts per provider, per-user data isolation, self-service account deletion. |
| **Status strip** | Every connection shows *connected / reconnect / sync failed*, so a silent failure never goes unnoticed. |

## How it works

```
 Outlook (Graph) ─┐
 Google APIs ─────┼──► sync job (in-process, every 5 min) ──► Postgres ──► Next.js pages (read-only)
 GitHub search ───┘         tokens refreshed + encrypted         cache + finance       auto-refresh
```

Only the sync job ever calls the external APIs. The web pages only read Postgres. More detail in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

**Stack:** Next.js 15 (App Router, TypeScript) · Tailwind CSS 4 · Prisma 6 + PostgreSQL 16 · Auth.js v5
(credentials) · Docker.

## Quick start (local development)

Requirements: Node.js 20+ and Docker.

```bash
git clone https://github.com/LoupMr/tidewell.git
cd tidewell
cp .env.example .env            # fill AUTH_SECRET + ENCRYPTION_KEY (openssl rand -base64 32)
npm install
docker compose up -d db         # Postgres on localhost:5434
npm run db:migrate              # apply migrations
npm run dev                     # http://localhost:3020
```

Create an account at `/register`. The first account becomes the instance admin. Calendars, mail and GitHub
need OAuth apps: follow [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) (about 10 minutes per provider). The
Money section works right away without any of them.

### Full container run

```bash
docker compose up --build       # app on http://localhost:3003
```

The app container runs `prisma migrate deploy` on start, then serves.

## Self-hosting

- **Synology NAS behind a Cloudflare Tunnel** (the reference deployment): [docs/DEPLOY_NAS.md](docs/DEPLOY_NAS.md)
- **Anywhere else with Docker:** use the standalone `docker-compose.yml`. Put it behind HTTPS (the session
  cookie is `Secure` in production) and set `AUTH_URL` to the public URL.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✔ | Postgres connection string |
| `AUTH_SECRET` | ✔ | Signs session cookies (`openssl rand -base64 32`) |
| `AUTH_URL` | ✔ | Public base URL. OAuth redirect URIs are `${AUTH_URL}/api/connect/<provider>/callback` |
| `ENCRYPTION_KEY` | ✔ | 32-byte base64 key used to encrypt OAuth tokens at rest |
| `REGISTRATION_MODE` | | `open` (default), `invite` or `closed` |
| `REGISTRATION_ALLOWLIST` | | Comma-separated emails allowed in `invite` mode |
| `SYNC_INTERVAL_MINUTES` | | Minutes between syncs per account (default 5) |
| `SYNC_DAYS_AHEAD` | | How far ahead calendars are synced (default 30) |
| `SYNC_DISABLED` | | `true` turns off the built-in scheduler |
| `CRON_SECRET` | | Enables `POST /api/cron/sync` for an external scheduler |
| `MICROSOFT_CLIENT_ID/SECRET/TENANT_ID` | | Outlook calendars + mail |
| `GOOGLE_CLIENT_ID/SECRET` | | Google Calendar + Gmail |
| `GITHUB_CLIENT_ID/SECRET` | | GitHub triage |

A provider with no client id/secret is shown as "not configured" and hidden from the connect buttons.

## Project layout

```
prisma/                 schema + migrations
src/auth.ts             Auth.js (credentials, JWT sessions)
src/app/(auth)/         login, register
src/app/(app)/          dashboard, calendar, inbox, github, money, settings
src/app/api/connect/    OAuth connect + callback per provider
src/lib/integrations/   provider configs, token refresh, Graph / Google / GitHub clients
src/lib/sync/           sync orchestration, cache writers, in-process scheduler
src/lib/recurrence.ts   recurring bills/income date math
docs/                   architecture, integrations, deployment, roadmap, design
deploy/                 NAS env template + compose services
```

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, and follow the
[Code of Conduct](CODE_OF_CONDUCT.md). Please report security issues privately as described in
[SECURITY.md](SECURITY.md), not in public issues.

## License

[MIT](LICENSE) © LoupMr
