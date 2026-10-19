# Architecture

## The one rule

**Sync and render are separate.** The web pages never call Outlook, Google or GitHub. A sync job does,
on a timer, and writes into Postgres. Pages only read Postgres. So a slow or rate-limited API never blocks
what you see. At worst, the data is a few minutes old, and the status strip says so.

```
                ┌──────────────────────────── tidewell container ────────────────────────────┐
 Microsoft ◄──┐ │                                                                             │
 Graph        │ │  instrumentation.ts ─► scheduler (every 60 s)                               │
 Google  ◄────┼─┼──── syncDue(): connections whose lastSyncAt > SYNC_INTERVAL_MINUTES        │
 APIs         │ │        └─ syncConnection(): refresh token → fetch → replace cache → log     │
 GitHub  ◄────┘ │                                │                                            │
 search         │                                ▼                                            │
                │                        ┌──────────────┐        Next.js pages (RSC)          │
                │                        │  PostgreSQL  │ ◄────── read-only queries ◄── browser│
                │                        └──────────────┘        <AutoRefresh/> every 60 s    │
                └─────────────────────────────────────────────────────────────────────────────┘
```

## Data

Two kinds of tables (see `prisma/schema.prisma`):

| Kind | Tables | Lifecycle |
| --- | --- | --- |
| **System of record** | `User`, `Connection`, `Category`, `Transaction`, `Recurring` | Never truncated. Backed up. |
| **Cache** | `CalendarSource`, `CalendarEvent`, `MailMessage`, `GithubItem`, `SyncLog` | Replaced on every sync, safe to wipe. `CalendarSource.muted` is the one user preference kept across syncs. |

The cache is **fetch → replace**, never diffed. Each sync deletes a connection's events, mail and items,
then inserts the fresh set inside a transaction.

## Auth vs. connections

These are two separate things:

- **Signing in to Tidewell** uses email + password (Auth.js Credentials provider, JWT session cookie).
- **Connecting accounts** is Tidewell's own OAuth 2.0 authorization-code flow
  (`/api/connect/[provider]` → provider consent → `/api/connect/[provider]/callback`). A user can connect
  several accounts per provider (two Gmail addresses, a personal and a work Microsoft account…).

The OAuth `state` is a random value in a short-lived, httpOnly cookie scoped to `/api/connect`, compared
in constant time on callback.

Tokens are stored encrypted (`src/lib/crypto.ts`, AES-256-GCM, `v1:iv:tag:data`). `getAccessToken()`
refreshes them shortly before they expire. If a provider rejects the refresh (`invalid_grant`), the
connection is flagged `NEEDS_REAUTH` and skipped until the user reconnects.

## Providers

| Provider | Calendar | Mail | Notes |
| --- | --- | --- | --- |
| Microsoft | `GET /me/calendars`, then `/me/calendars/{id}/calendarView` per calendar with `Prefer: outlook.timezone="UTC"` (expands recurrences) | `/me/mailFolders/inbox` (unread count) + 25 latest unread | Refresh tokens rotate, and the new one is stored each time |
| Google | `calendarList`, then `events?singleEvents=true` per visible calendar | `labels/INBOX` (unread count) + 25 latest `is:unread in:inbox` | `access_type=offline&prompt=consent` so a refresh token is always issued |
| GitHub | — | — | 3 search queries: `review-requested:@me`, `assignee:@me`, `author:@me` (open, not archived) |

## Time

- Timed events are stored in UTC. All-day events are stored as UTC midnight with `isAllDay = true` and
  grouped by date, not by instant.
- Money dates are Postgres `DATE` (`@db.Date`, UTC midnight in JS) and formatted with `timeZone: "UTC"`.
- Everything is rendered server-side in the user's own timezone/locale (`User.timezone`, `User.locale`).

## Money

Amounts are **integer cents**, always positive; `type` (`INCOME` / `EXPENSE`) carries the sign.

A `Recurring` row holds `nextDate`, the next occurrence that hasn't been handled yet. *Mark paid/received*
creates a `Transaction` dated `nextDate` and moves `nextDate` forward. *Skip* only moves it forward. Monthly
items keep their original day in `anchorDay`, so a bill on the 31st lands on the 28th/29th/30th in short
months and returns to the 31st afterwards (`src/lib/recurrence.ts`).

CSV import is parsed **in the browser** (PapaParse). Only the confirmed rows go to the server action. Each
row gets `importHash = sha256(userId | date | amount | description | occurrence-index)`, and a unique index
on `(userId, importHash)` makes re-imports idempotent.

## Why the scheduler is in-process

Tidewell runs as a single container on a NAS, so a `setInterval` started from `instrumentation.ts` is the
simplest thing that works: no worker container, no cron container, no queue. `syncDue()` has a re-entrancy
guard and only picks connections that are actually due. If you ever run several replicas, set
`SYNC_DISABLED=true` on all but one, or turn it off everywhere and call `POST /api/cron/sync` from an
external scheduler with `CRON_SECRET`.
