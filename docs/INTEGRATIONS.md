# Setting up integrations

Each Tidewell instance uses **its own OAuth apps**. You register them once (about 10 minutes each) and put
the ids and secrets in the env file. Users of the instance then just click *Connect*.

Every redirect URI follows the same pattern:

```
${AUTH_URL}/api/connect/<provider>/callback
```

For the reference deployment that's `https://tidewell.lothmar.com/api/connect/microsoft/callback`, and
likewise for `google` and `github`. For local dev add `http://localhost:3020/api/connect/<provider>/callback`
too, or create separate dev apps.

After editing the env file, restart the container: `docker compose up -d tidewell`.

---

## Microsoft (Outlook calendars + mail)

1. Go to <https://entra.microsoft.com> (or portal.azure.com) → **Microsoft Entra ID → App registrations
   → New registration**.
2. **Name:** Tidewell. **Supported account types:** *Accounts in any organizational directory and personal
   Microsoft accounts*. That allows both work (e.g. a company tenant) and personal outlook.com accounts.
3. **Redirect URI:** platform **Web**, value `https://tidewell.lothmar.com/api/connect/microsoft/callback`.
4. After creation, copy the **Application (client) ID** → `MICROSOFT_CLIENT_ID`.
5. **Certificates & secrets → New client secret**. Copy the **Value** (not the ID) → `MICROSOFT_CLIENT_SECRET`.
   Note the expiry date and put a reminder in your calendar: when it expires, sync stops until you create a
   new one.
6. **API permissions → Add → Microsoft Graph → Delegated**: `User.Read`, `Calendars.Read`,
   `Calendars.Read.Shared`, `Mail.Read`, `offline_access`, `openid`, `email`.
7. Leave `MICROSOFT_TENANT_ID=common`, or set your tenant id to allow only your organisation.

> **Work accounts:** some organisations require an admin to approve third-party apps. If connecting shows
> *"Need admin approval"*, ask your Microsoft 365 admin to grant consent for the Tidewell app (or, if you're
> the admin, click **Grant admin consent** on the API permissions page).

## Google (Google Calendar + Gmail)

1. Go to <https://console.cloud.google.com> → create a project (e.g. *Tidewell*).
2. **APIs & Services → Library**: enable **Google Calendar API** and **Gmail API**.
3. **Google Auth Platform** (formerly *OAuth consent screen*):
   - **Branding:** app name Tidewell, your support email, authorised domain `lothmar.com`.
   - **Audience:** *External*. Add yourself (and anyone else) under **Test users** while in testing.
   - **Data access:** add `…/auth/calendar.readonly` and `…/auth/gmail.readonly`.
4. **Clients → Create client → Web application**. Authorised redirect URI:
   `https://tidewell.lothmar.com/api/connect/google/callback`.
5. Copy the client ID / secret → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

> **Testing vs. production.** `gmail.readonly` is a *restricted* scope. While the app's publishing status is
> **Testing**, Google expires refresh tokens after **7 days**, so you'd have to click *Reconnect* weekly. For
> personal / small-team use, set the status to **In production** without going through verification: users
> then see a "Google hasn't verified this app" warning (click *Advanced → Go to Tidewell*), the app is capped
> at 100 users, and tokens no longer expire weekly. A large public instance needs Google's full verification
> for restricted scopes.

## GitHub (issues & pull requests)

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. **Homepage URL:** `https://tidewell.lothmar.com`.
   **Authorization callback URL:** `https://tidewell.lothmar.com/api/connect/github/callback`.
3. Copy the **Client ID** → `GITHUB_CLIENT_ID`. **Generate a new client secret** → `GITHUB_CLIENT_SECRET`.

Tidewell asks for `read:user` and `repo`. GitHub has no read-only scope that covers issues in private repos,
but Tidewell only ever makes `GET` requests to the search API.

> **Organisation repos:** if an organisation restricts third-party OAuth apps, its private issues won't
> appear until an org owner approves Tidewell (*Organization settings → Third-party access*), or you request
> access on the authorise screen.

---

## Checking it works

Open **Settings** in Tidewell. Each configured provider shows a *Connect* button; unconfigured ones say so.
After connecting, the first sync runs right away. **Recent syncs** at the bottom of Settings shows each
attempt and any error message from the provider.
