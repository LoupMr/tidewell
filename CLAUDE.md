# CLAUDE.md — working on Tidewell

Self-hosted personal dashboard: merged calendars (Outlook + Google), inbox snapshot, GitHub triage, money
tracking. Next.js 15 App Router · TypeScript strict · Tailwind 4 · Prisma 6 + Postgres 16 · Auth.js v5
(credentials) · Docker. Deployed on a Synology NAS via SC-Nexus's docker-compose (see docs/DEPLOY_NAS.md).

## Commands
- `npm run dev` → http://localhost:3020 (Postgres from `docker compose up -d db` on :5434)
- `npm run typecheck` · `npm run lint` · `npm run build`
- `npm run db:migrate -- --name <change>` after editing `prisma/schema.prisma`
- `npm run sync` runs one sync pass from the CLI

## Non-negotiables
1. **Sync and render stay separate.** Pages/actions read Postgres only. External APIs are called only from
   `src/lib/integrations/*` via `src/lib/sync/*`.
2. **Scope every query by user.** Pages call `requireUser()` (`src/lib/session.ts`); every Prisma query
   filters by `userId: user.id`. Mutations by id use `deleteMany/updateMany({ where: { id, userId } })` or
   check ownership first.
3. **Read-only scopes** towards providers. No write endpoints.
4. **Tokens are encrypted** with `encrypt()/decrypt()` from `src/lib/crypto.ts`. Never log them.
5. Money is integer **cents**, always positive; `type` carries the sign. Dates are `@db.Date` (UTC midnight)
   → format with `formatDateOnly`.
6. Never edit an applied migration — add a new one.
7. Design tokens only (`bg-surface`, `text-muted`, `text-accent`…). Teal = live/actionable, amber = attention.
   Numbers use the `num` utility. See docs/DESIGN.md.

## Map
- `src/auth.ts` Auth.js config · `src/app/(auth)` login/register + actions
- `src/app/(app)/*` pages; `money/actions.ts`, `settings/actions.ts` server actions
- `src/app/api/connect/[provider]` OAuth start + callback
- `src/lib/integrations/{providers,oauth,microsoft,google,github}.ts`
- `src/lib/sync/{index,store,scheduler}.ts`, started from `src/instrumentation.ts`
- `src/lib/{queries,format,recurrence,env,crypto,rate-limit}.ts`
- Forms: `ActionForm` (client) + server actions returning `ActionState`.

## Before finishing a change
typecheck + lint + build pass; new migration committed if the schema changed; docs updated if config or
behaviour changed; CHANGELOG entry under "Unreleased".
