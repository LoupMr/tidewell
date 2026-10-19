# Prompt for Claude Code — continue building Tidewell

Paste this into Claude Code from the repo root when you want the next chunk of work done.

---

You're working on **Tidewell**, my self-hosted personal dashboard (read `CLAUDE.md`, `README.md`,
`docs/ARCHITECTURE.md` and `docs/ROADMAP.md` first). v0.1 is in place: accounts, Outlook/Google/GitHub sync,
merged calendar, inbox snapshot, GitHub triage and the Money module with CSV import.

Do the **Phase 3 hardening** items from `docs/ROADMAP.md`, one PR-sized commit each, in this order:

1. **Tests.** Add Vitest. Unit-test `src/lib/recurrence.ts` (month-end anchoring, leap years, weekly,
   every-N, end dates), `parseAmountToCents` and the timezone helpers in `src/lib/format.ts` (DST days in
   Europe/Paris), and the date parsing/column mapping in the CSV importer (extract the pure parts into
   `src/lib/csv.ts` first). Add `npm test` and run it in `.github/workflows/ci.yml`.
2. **Email verification + password reset** over SMTP with nodemailer, configured exactly like my
   loupMr-studio project (`SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM`, `EMAIL_DEV_MODE` that logs to the console in
   dev). New `VerificationToken` / `PasswordResetToken` tables (hashed tokens, 1 h expiry), `/verify`,
   `/forgot-password`, `/reset-password`. Unverified users can sign in but see a banner. Keep it optional:
   if SMTP isn't configured, skip verification.
3. **Sync health in Settings**: for the signed-in user only, show sync failures from the last 24 h per
   connection with the provider's error message and a one-click reconnect. There is no admin role: every
   account is independent and never sees other users' data.
4. **"Needs a reply"** card on the dashboard: upcoming events where `responseStatus` is `needsAction` /
   `notResponded`, linking to the event.

Rules: keep sync and render separate, scope every query by `userId`, no new third-party browser scripts,
use the existing design tokens, add migrations instead of editing old ones, and update docs + CHANGELOG.
Run `npm run typecheck && npm run lint && npm run build` before each commit.
