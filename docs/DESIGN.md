# Design notes

Tidewell should feel **calm**: it's a page you glance at, not a control panel.

## Colour (tokens in `src/app/globals.css`)

| Token | Light | Dark | Meaning |
| --- | --- | --- | --- |
| `bg` / `surface` / `surface-2` | off-white #f6f5f1 / #fff / #efeee8 | deep slate #11161d / #18202a / #1f2934 | Page, cards, subtle fills |
| `ink` / `muted` | #1d2430 / #6b7280 | #e6e9ee / #93a0b0 | Text, secondary text |
| `accent` (teal) | #0f766e | #2dd4bf | **Live or actionable only**: "Now", primary buttons, active nav |
| `warn` (amber) | #b45309 | #f5b454 | Needs attention: overdue, reconnect, not answered |
| `danger` / `ok` | red / green | | Errors, money out vs. money in |

Never use `accent` or `warn` for decoration. If something is teal, it should be clickable or happening now.

## Type roles
- **Display** (`font-display`): a serif stack (Iowan / Palatino / Georgia) for page and card titles.
- **Body**: the system sans stack.
- **Numbers** (`num` utility): monospace + tabular figures for times, counts and money, so digits line up.
  No webfonts are loaded (the CSP is `'self'` only).

## Patterns
- **Merged timeline with source pills.** One chronological list, each row tagged with its calendar. This is
  what fixes "too many calendars", so keep it front and centre.
- **Triage stays split.** "Awaiting your review" (someone is blocked on you), "assigned to you" (yours to do)
  and "your PRs" (waiting on others) are different jobs. Don't merge them into one feed.
- **Status strip.** One chip per connection: green synced / amber reconnect / red failed. Never hide sync
  failures.
- **Money in vs. out.** Income is green with `+`, expenses are neutral ink with `−`. Red is only for a
  negative *net*.
- Light and dark mode both follow `prefers-color-scheme`. Check both in every UI PR.
