## What & why

<!-- What does this change, and which issue does it close? e.g. "Closes #12" -->

## How I tested it

<!-- Steps, accounts/providers used, edge cases checked. -->

## Checklist

- [ ] `npm run typecheck`, `npm run lint` and `npm run build` pass
- [ ] Every new DB query is scoped to the signed-in user
- [ ] Schema changes come with a new migration in `prisma/migrations/` (existing ones untouched)
- [ ] UI changes: screenshots in **light and dark** mode
- [ ] Docs updated (README / docs/) if behaviour or config changed
