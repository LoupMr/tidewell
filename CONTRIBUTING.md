# Contributing to Tidewell

Thanks for helping. Tidewell is a small project with a narrow purpose: **one calm, read-only page that
shows everything that needs you.** The best contributions keep it that way.

## Ground rules

- **Read-only towards external accounts.** Tidewell never writes to a calendar, mailbox or repo. A PR that
  adds write scopes needs an issue and a discussion first.
- **Sync and render stay separate.** Pages read Postgres only. External APIs are called only from
  `src/lib/sync` / `src/lib/integrations`.
- **Every query is scoped to the signed-in user.** Any `prisma.*` call in a page or action must filter by
  `userId: user.id`, or touch rows that were already checked against it. Reviewers will check this first.
- **No third-party scripts, trackers or fonts loaded from CDNs.** The CSP is `'self'` only.
- Be kind. The [Code of Conduct](CODE_OF_CONDUCT.md) applies everywhere.

## Getting set up

```bash
git clone https://github.com/<you>/tidewell.git && cd tidewell
cp .env.example .env           # set AUTH_SECRET + ENCRYPTION_KEY
npm install
docker compose up -d db
npm run db:migrate
npm run dev                    # http://localhost:3020
```

You can work on Money, auth and UI without any OAuth app. For integration work, create your own dev OAuth
apps with redirect URIs on `http://localhost:3020` ([docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)).

## Workflow

1. **Find or open an issue.** For anything bigger than a small fix, say what you plan to do before writing
   code, so nobody duplicates work. Issues labelled `good first issue` are a good place to start.
2. **Fork and branch** from `main`: `feat/short-name`, `fix/short-name`, `docs/short-name`.
3. **Keep PRs focused.** One concern per PR. Small PRs get reviewed fast.
4. **Run the checks** before pushing:
   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```
5. **Open a PR** using the template. Describe what changed and how you tested it, and include screenshots for
   UI changes (light *and* dark mode).

CI runs typecheck, lint and build on every PR. It must be green before merge.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(money): add yearly recurring summary
fix(sync): refresh Microsoft token before calendarView
docs: explain Google testing-mode token expiry
```

## Database changes

- Edit `prisma/schema.prisma`, then run `npm run db:migrate -- --name what_changed`.
- Commit the generated folder in `prisma/migrations/`. **Never edit a migration that's already on `main`.**
  Add a new one instead.
- Migrations run automatically on container start (`prisma migrate deploy`), so they must be safe on
  existing data.

## Adding a new provider

1. Add it to the `Provider` enum and run a migration.
2. Add its OAuth config in `src/lib/integrations/providers.ts`.
3. Create `src/lib/integrations/<provider>.ts` exporting `identity(token)` and a `sync…(conn, token, …)` that
   writes through the helpers in `src/lib/sync/store.ts`.
4. Wire it into `src/lib/sync/index.ts` and the callback route's `identityFor` map.
5. Document app registration in `docs/INTEGRATIONS.md`.

## Style

- TypeScript strict. Server Components by default, `"use client"` only where interaction needs it.
- Tailwind utilities with the semantic tokens from `globals.css` (`bg-surface`, `text-muted`,
  `text-accent`…). Don't hard-code colours. See [docs/DESIGN.md](docs/DESIGN.md).
- Teal (`accent`) means *live or actionable*, amber (`warn`) means *needs attention*. Never use them as
  decoration.
- Numbers, times and money use the `num` utility (monospace, tabular).

## Licensing

By contributing you agree that your contributions are licensed under the project's [MIT License](LICENSE).
