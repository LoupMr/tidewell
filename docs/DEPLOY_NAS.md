# Deploy Tidewell on the Synology NAS (behind the existing Cloudflare Tunnel)

Target URL: **https://tidewell.lothmar.com**

Tidewell is deployed exactly like **LoupMr Studio**: two containers, wired into **SC-Nexus's**
`docker-compose.yml`, on the same `shared` Docker network as `sc-nexus`, `oimatewtf`, `studio` and the
`cloudflared` tunnel.

| Container | What it is | Reached at |
| --- | --- | --- |
| `tidewell` | Next.js app (standalone server + built-in sync scheduler) | `http://tidewell:3000` (LAN: `http://<nas-ip>:3003`) |
| `tidewell-db` | Postgres 16 (named volume `tidewell-db-data`) | `tidewell-db:5432` (internal only) |

Both repos sit side by side so the build context `../Tidewell` resolves:

```
/volume2/web/
├── SC-Nexus/          ← docker-compose.yml + tidewell.env live here
├── loupMr-studio/
├── Oimatewtf_WebSite/
└── Tidewell/          ← this repo
```

---

## Step 1 — Put the repo on the NAS

Clone (or upload) this repo next to SC-Nexus, as `Tidewell/`. The `tidewell` and `tidewell-db` services are
already in `SC-Nexus/docker-compose.yml`. If not, paste them from `deploy/sc-nexus-services.yml`.

## Step 2 — Create the env file

Copy `Tidewell/deploy/tidewell.env.example` to **`SC-Nexus/tidewell.env`** and replace every `CHANGE-ME`:

- `POSTGRES_PASSWORD`: a strong password. Use the **same** one inside `DATABASE_URL`, whose host must be
  `tidewell-db`.
- `AUTH_SECRET` and `ENCRYPTION_KEY`: two **different** values from `openssl rand -base64 32`.
  **Back up `ENCRYPTION_KEY`.** Without it, stored tokens can't be decrypted (users would have to reconnect).
- `AUTH_URL=https://tidewell.lothmar.com`
- OAuth ids/secrets: see [INTEGRATIONS.md](INTEGRATIONS.md). You can leave them blank on the first
  deploy and add them later. Money works without them.

> `tidewell.env` holds secrets. It's listed in SC-Nexus's `.gitignore`, so never `git add -f` it.

## Step 3 — Build & start (from the SC-Nexus folder)

Synology ships the standalone `docker-compose` (with a hyphen), and Docker needs `sudo`.

```bash
cd /volume2/web/SC-Nexus
sudo docker-compose up -d --build tidewell-db tidewell
sudo docker-compose logs -f tidewell     # "→ Applying database migrations…" then "[sync] scheduler started"
```

Or use **Container Manager → Project → sc-nexus → Build** and start the two new containers.

No host `chown` is needed: the database uses a named volume, and the app keeps no files on disk.

## Step 4 — Point the tunnel at it (Cloudflare dashboard)

1. **Cloudflare Zero Trust → Networks → Tunnels →** open the existing tunnel (`shared-tunnel`).
2. **Public Hostname → Add a public hostname**
   - Subdomain: `tidewell` · Domain: `lothmar.com` · Path: *(blank)*
   - Service type: `HTTP` · URL: `tidewell:3000`
3. Save. Cloudflare creates the DNS record.

Open **https://tidewell.lothmar.com** and create your account. Every account is independent: there's no admin, and nobody can see anyone else's data. Always use
the https URL: the session cookie is `Secure` and won't stick over `http://<nas-ip>:3003`.

## Step 5 — Decide who can sign up

`REGISTRATION_MODE` in `tidewell.env`:

- `open`: anyone with the link can create an account (each user only ever sees their own data).
- `invite`: only emails in `REGISTRATION_ALLOWLIST=a@x.com,b@y.com`.
- `closed`: no new accounts.

Apply changes with `sudo docker-compose up -d tidewell`.

---

## Updating after code changes

```bash
cd /volume2/web/Tidewell && git pull
cd ../SC-Nexus && sudo docker-compose up -d --build tidewell    # DB untouched; new migrations apply on start
```

## Backups

`SC-Nexus/backup.sh` includes a Tidewell step (Postgres dump → `tidewell-db-<stamp>.sql.gz`). Manually:

```bash
docker exec tidewell-db pg_dump -U tidewell tidewell | gzip > tidewell-db.sql.gz
# restore into an empty DB:
gunzip -c tidewell-db.sql.gz | docker exec -i tidewell-db psql -U tidewell tidewell
```

Calendar, mail and GitHub data are a cache. Only users, connections and finance data actually need backing up.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `prisma generate failed` during build | NAS DNS flake. The Dockerfile retries 5×; just rebuild. |
| Login loops back to /login | Use the https tunnel URL; check `AUTH_URL` matches it exactly. |
| "Not configured on this instance" | OAuth id/secret missing in `tidewell.env`, or the container wasn't restarted. |
| `redirect_uri_mismatch` / `AADSTS50011` | The redirect URI in the provider console must be exactly `https://tidewell.lothmar.com/api/connect/<provider>/callback`. |
| Connection shows **Reconnect** | The provider revoked the token (password change, expired Google testing token, expired MS client secret). Click Reconnect. |
| Events look an hour off | Set your timezone in **Settings → Profile**. |
