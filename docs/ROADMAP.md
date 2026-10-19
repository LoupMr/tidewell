# Roadmap

Each phase ships something you can open and use. Don't start the next phase until the current one works
properly: the gates are real.

## Phase 1 — Foundation ✅ (v0.1)
- Accounts, Docker deploy on the NAS, Postgres, migrations on boot.
- Money: transactions, recurring bills/income, 30-day outlook, CSV import.
- **Gate:** you've used the Money page for a full month, and CSV import handles your bank's export.

## Phase 2 — Calendars & inbox ✅ (v0.1)
- Outlook + Google calendars merged with source pills, mute per calendar.
- Unread snapshot for Outlook + Gmail.
- **Gate:** every calendar you have merges correctly, including shared/delegated ones, recurring events and
  all-day events across DST changes.

## Phase 3 — GitHub & polish ✅ (v0.1) → hardening
- GitHub triage lists.
- [ ] Email verification + password reset over SMTP (Brevo, same as Studio).
- [ ] Admin page: list users, disable an account, view sync health per instance.
- [ ] Tests: unit tests for `recurrence.ts`, `format.ts` amount parsing, CSV mapping; a sync test with
      recorded API fixtures.
- **Gate:** a second person has used the instance for a week without help.

## Phase 4 — Stretch
- [ ] "Needs a reply" view: calendar invites you haven't answered (`responseStatus = needsAction`).
- [ ] Quick actions: snooze a PR, mark an issue as "today".
- [ ] Budgets per category with a monthly progress bar.
- [ ] Bank auto-sync via an open-banking provider (EU PSD2), as an optional integration.
- [ ] Daily digest email (opt-in).
- [ ] iCal (ICS URL) subscriptions as a calendar source, for anything that isn't Outlook or Google.
- [ ] PWA install + offline read of the last snapshot.
- [ ] i18n (French first), reusing the `next-intl` setup from Studio.

Want to pick something up? Comment on (or open) the matching issue first. See [CONTRIBUTING.md](../CONTRIBUTING.md).
