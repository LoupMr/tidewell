# Changelog

All notable changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Removed
- The admin role. Every account is independent and only ever sees its own data; who can sign up is
  controlled by the server owner through `REGISTRATION_MODE` in the env file.

## [0.1.0] — 2026-10-19

### Added
- Email/password accounts with open, invite-only or closed registration. The first account becomes admin.
- OAuth connections for Microsoft (Outlook calendars + mail), Google (Calendar + Gmail) and GitHub, with
  several accounts per provider and tokens encrypted at rest.
- In-process sync scheduler (every 5 min), sync log, status strip and reconnect flow.
- Unified calendar with source pills and per-calendar mute.
- Inbox snapshot: unread counts and the latest unread per account.
- GitHub triage: review requests, assigned issues, your open PRs.
- Money: transactions, categories, recurring bills and income, a 30-day outlook, monthly totals, spending by
  category, bank CSV import with de-duplication.
- Docker image with migrations on boot; Synology + Cloudflare Tunnel deployment guide.
