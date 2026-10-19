# Security Policy

Tidewell stores OAuth tokens for people's mail, calendars and GitHub, plus their finance data. Security
reports are taken seriously.

## Reporting a vulnerability

**Please don't open a public issue.** Instead:

- use GitHub's **"Report a vulnerability"** button (Security tab → Advisories) on this repository. It opens
  a private conversation with the maintainer.

Include steps to reproduce, the impact, and the affected version or commit. You'll get an acknowledgement
within 72 hours and a fix or mitigation plan as soon as possible. Credit is given in the release notes unless
you'd rather stay anonymous.

## Supported versions

Only the latest release on `main` gets security fixes.

## How Tidewell protects data

- OAuth access/refresh tokens are encrypted at rest with AES-256-GCM (`ENCRYPTION_KEY`).
- Connected accounts use **read-only** scopes.
- Passwords are hashed with bcrypt (cost 12). Login and registration are rate-limited.
- Every database query is scoped to the signed-in user.
- Strict security headers in production: a `'self'`-only CSP, HSTS, `X-Frame-Options: DENY`.
- External APIs are called only server-side. The browser never sees a provider token.

## For self-hosters

- Serve Tidewell over HTTPS only, and set `AUTH_URL` to the https URL.
- Generate `AUTH_SECRET` and `ENCRYPTION_KEY` with `openssl rand -base64 32`, keep them out of git, and back
  them up somewhere safe. Without `ENCRYPTION_KEY`, stored tokens can't be decrypted.
- On a private instance, set `REGISTRATION_MODE=invite` or `closed` once your accounts exist.
- Keep the Postgres port off the public internet. The reference compose file doesn't publish it.
