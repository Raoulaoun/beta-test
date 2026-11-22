# Deploying to Railway

Two services in one Railway project, both built from this repo with their own Dockerfile.
The Dockerfile is chosen with the `RAILWAY_DOCKERFILE_PATH` variable: without it, Railway uses
its automatic builder (Railpack), finds no app at the repo root and fails.

| Service | What it is | Public domain | Built from |
| --- | --- | --- | --- |
| `web` | Next.js site, upload route, sign-in, admin CRM at `/admin` | Yes | `apps/web/Dockerfile` |
| `scoring` | Python scoring service (FastAPI) | **No**, private network only | `services/scoring/Dockerfile` |
| `Postgres` | Accounts, results, CRM (from Phase 3) | **No** | Railway's PostgreSQL template |

`apps/web/railway.json` and `services/scoring/railway.json` hold the same build, health-check
and watch-path settings as config-as-code. On the first deploy, setting them as the Railway
Config File didn't take effect, so the steps below set everything in the UI instead.

The browser only ever talks to `web`. `web` forwards each upload to `scoring` over Railway's
private network, and `scoring` is never reachable from the internet.

Deploy the branch you're testing: `phase-3-accounts` for Phase 3 (steps below say which
settings are new in Phase 3).

## 0. Add the database (Phase 3)

1. In the project canvas: **Create** (or **+ New**) → **Database** → **PostgreSQL**. Railway names
   it `Postgres`; keep that name, the `web` variable below refers to it.
2. Nothing else to set. Don't give it a public address: `web` reaches it over the private
   network through `${{Postgres.DATABASE_URL}}`.
3. Backups: in the Postgres service → **Backups**, turn on scheduled daily backups if your
   Railway plan offers them. A restore test is on the Phase 10 checklist either way.

## 1. Create the project and the `scoring` service

1. In Railway, click **New Project** → **Deploy from GitHub repo** → pick `Raoulaoun/beta-test`.
   If Railway asks for access to the repo, grant it, then pick it again.
2. Railway creates one service and may start a build straight away. Let it fail or cancel it;
   it isn't configured yet.
3. Open the service → **Settings**:
   - **Service name** (top of Settings): `scoring`. The name sets its private address
     (`scoring.railway.internal`), so use exactly this.
   - **Source** → **Branch**: the branch you're testing (e.g. `phase-3-accounts`).
   - **Source** → **Root Directory**: leave **empty**. Both services build from the repo root,
     because `scoring` needs `docs/advice-texts.md` at runtime.
   - **Deploy** → **Healthcheck Path**: `/health`.
   - **Source** → **Watch Paths**: `services/scoring/**` and `docs/advice-texts.md` (one per
     line), so only changes to this service trigger a rebuild.
   - **Networking**: do **not** click "Generate Domain". Leave Public Networking empty.
     Private Networking is on by default and shows `scoring.railway.internal`.
4. Open **Variables** → **New Variable**:

   | Name | Value |
   | --- | --- |
   | `RAILWAY_DOCKERFILE_PATH` | `services/scoring/Dockerfile` |
   | `PORT` | `8000` |
   | `ACCOUNT_FINGERPRINT_SECRET` | 64 random hex characters (Phase 3). Generate once with `openssl rand -hex 32` and keep it in a password manager. **Never change it**: changing it breaks the grouping of earlier results by trading account. |

5. Click **Deploy** (or **Apply changes**, then deploy).
6. In **Deployments** → the latest deployment → **Deploy Logs**, check for:
   `Uvicorn running on http://[::]:8000`. The `[::]` matters: it means the service listens on
   IPv6, which Railway's private network uses. If you see `0.0.0.0` instead, see
   Troubleshooting.

## 2. Add the `web` service

1. In the project canvas: **Create** (or **+ New**) → **GitHub Repo** → `Raoulaoun/beta-test`.
2. Open the new service → **Settings**:
   - **Service name**: `web`.
   - **Source** → **Branch**: same branch as `scoring`.
   - **Source** → **Root Directory**: leave **empty**.
   - **Deploy** → **Healthcheck Path**: `/api/health`.
   - **Deploy** → **Pre-deploy Command** (Phase 3): `node dist/migrate.cjs`. It applies database
     migrations before each new version starts; if it fails, the deploy stops and the old
     version keeps running.
   - **Source** → **Watch Paths**: `apps/web/**`.
3. Open **Variables** → **New Variable** for each:

   | Name | Value | Notes |
   | --- | --- | --- |
   | `RAILWAY_DOCKERFILE_PATH` | `apps/web/Dockerfile` | Builds with the Dockerfile. |
   | `PORT` | `3000` | The port Next.js listens on. |
   | `SCORING_URL` | `http://${{scoring.RAILWAY_PRIVATE_DOMAIN}}:${{scoring.PORT}}` | Type it exactly like this. Railway fills in `scoring.railway.internal` and `8000`. Must be `http`, not `https`: the private network has no TLS. |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Phase 3. Railway's private database address (see step 0 below). |
   | `SITE_URL` | `https://web-xxxx.up.railway.app` | Phase 3. Your web address, no trailing slash; sign-in links point here. Set it after Generate Domain. |
   | `ADMIN_TOTP_KEY` | 64 random hex characters | Phase 3. Encrypts admin authenticator secrets. Generate with `openssl rand -hex 32`. **Never change it**: existing admins could no longer sign in. |
   | `BREVO_API_KEY` | Brevo → SMTP & API → API Keys → Generate a new API key | Optional on test deploys. Without it, no email is sent (sign-in links and reports included). Required on the live site. |
   | `MAIL_FROM` | e.g. `hello@betaapp.me` (address only) | With `BREVO_API_KEY`. Must be on a domain authenticated in Brevo (see "Email: Brevo" below). |
   | `MAIL_FROM_NAME` | e.g. `The Manager Test by Beta` | Optional; the sender name in the inbox. Defaults to `The Manager Test by Beta`. |
   | `TURNSTILE_SECRET_KEY` | from Cloudflare → Turnstile → your widget | Phase 3, optional on test deploys (the form check is skipped without it). Required on the live site: without it the live form refuses leads. |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | from the same Turnstile widget | The public half. Read at build time; change it, and Railway rebuilds. |

   Leave `SITE_ENV` unset for this test deploy. Unset means "not production": every page
   sends `X-Robots-Tag: noindex, nofollow` and a robots noindex meta tag, and `robots.txt`
   disallows everything.

4. **Settings** → **Networking** → **Public Networking** → **Generate Domain**. When asked for
   the port, enter `3000`. You get a `*.up.railway.app` address.
5. Deploy. In **Deploy Logs** you should see Next.js start with `Ready`.

## 2b. Create the first admin (Phase 3)

Admins are created from inside the running `web` service, so the password never travels
through a form:

1. Install the Railway CLI on your computer and run `railway login`, then `railway link` and pick
   this project.
2. Run:

   ```bash
   railway ssh --service web
   ```

3. In that shell, run (your email and name):

   ```bash
   node dist/admin-create.cjs you@betaapp.me "Raoul"
   ```

4. It prints a password and an authenticator setup key **once**. Add the key to your
   authenticator app (Google Authenticator, 1Password, …) and keep the password in a password
   manager. Then sign in at `https://web-xxxx.up.railway.app/admin`.

## 3. Check the deploy

Replace `https://web-xxxx.up.railway.app` with your generated domain.

1. `https://web-xxxx.up.railway.app/api/health` returns `{"ok":true}`.
2. Open the domain: the landing page loads.
3. Upload a real MT4 or MT5 statement. You should get a full score, an early score or a
   starter read. If you get **"Server error"**, `web` can't reach `scoring` or the database:
   see Troubleshooting.
4. Upload a non-statement file, e.g. a PNG: you get "We couldn't read this file."
5. Phase 3: send the lead form. The confirmation screen shows; in `/admin` the lead appears
   under Leads, and the upload under Funnel.
6. Noindex check, from a terminal:

   ```bash
   curl -sI https://web-xxxx.up.railway.app/ | grep -i x-robots
   ```

   It prints `X-Robots-Tag: noindex, nofollow`.
7. `scoring` and `Postgres` must not be public: their **Settings** → **Networking** show no
   public domain.

## Every environment variable

| Service | Variable | Value | Where it comes from |
| --- | --- | --- | --- |
| `scoring` | `RAILWAY_DOCKERFILE_PATH` | `services/scoring/Dockerfile` | Set by you. Makes Railway build with the Dockerfile. |
| `scoring` | `PORT` | `8000` | Set by you. Fixed, so `web` can address it on the private network. |
| `web` | `RAILWAY_DOCKERFILE_PATH` | `apps/web/Dockerfile` | Set by you. Makes Railway build with the Dockerfile. |
| `web` | `PORT` | `3000` | Set by you. Must match the port given to Generate Domain. |
| `web` | `SCORING_URL` | `http://${{scoring.RAILWAY_PRIVATE_DOMAIN}}:${{scoring.PORT}}` | Railway reference variables, resolved by Railway. |
| `web` | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Railway reference variable. |
| `web` | `SITE_URL` | your web address | Set by you after Generate Domain. |
| `web` | `ADMIN_TOTP_KEY` | 64 hex characters | Generated once by you (`openssl rand -hex 32`). Never change. |
| `web` | `BREVO_API_KEY`, `MAIL_FROM`, `MAIL_FROM_NAME` | from Brevo | Optional on test deploys; required live. |
| `web` | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | from Cloudflare Turnstile | Optional on test deploys; required live. |
| `scoring` | `ACCOUNT_FINGERPRINT_SECRET` | 64 hex characters | Generated once by you. Never change. Lives only on `scoring`, never in the database. |
| `web` | `SITE_ENV` | unset, or `production` | Unset on every test/staging deploy. Set to `production` **only** on the live site at launch; it makes the site indexable. Changing it triggers a rebuild, which is needed (it is read at build time). |

Do **not** set these on Railway:

| Variable | Why |
| --- | --- |
| `DESIGN_PREVIEW` | Turns on the dev-only design preview (sample data via URL parameters). Development only. |
| `ADVICE_TEXTS_PATH` | Already set inside the `scoring` image to the copy of `docs/advice-texts.md` it ships with. |
| `DEV_OUTBOX` | Exposes test emails at a dev-only address. Local testing only (and refused on the live site anyway). |

The confirmation-screen links (webinar, Managers Room, Beta page) are not variables: set them
in `/admin` → **Settings**. They apply at once, with no deploy.

Secrets (`ADMIN_TOTP_KEY`, `ACCOUNT_FINGERPRINT_SECRET`, `BREVO_API_KEY`,
`TURNSTILE_SECRET_KEY`): add them with Railway's **Sealed** option on the variable, so their
values can't be read back in the dashboard.

## Email: Brevo

The web app sends every email (sign-in links, the report with its PDF, the deletion
confirmation, and the Phase 9 sequences) through Brevo's transactional API.

1. **Authenticate the domain.** Brevo → Senders, Domains & Dedicated IPs → **Domains** →
   Add a domain → `betaapp.me`. Brevo shows DNS records (a Brevo code TXT record, DKIM
   records and a DMARC record). Add them where `betaapp.me`'s DNS is hosted, then click
   **Verify** in Brevo. Until the domain shows "Authenticated", emails may be refused or land
   in spam.
2. **Add the sender.** Senders → Add a sender → name `The Manager Test by Beta`, email
   `hello@betaapp.me` (or the address you prefer on that domain).
3. **Create the API key.** SMTP & API → API Keys → Generate a new API key → name it
   `manager-test`. Copy it once; Brevo won't show it again.
4. **Authorised IPs.** Security → Authorised IPs: if IP blocking is on, Brevo refuses calls
   from Railway (its outgoing IPs change). Turn it off for API keys, or the emails fail with 401.
5. **Railway.** On `web` → Variables: `BREVO_API_KEY` (sealed), `MAIL_FROM` =
   `hello@betaapp.me`, optionally `MAIL_FROM_NAME`. Railway redeploys `web`.
6. **Test.** Upload a statement, send the lead form with your own email: the report arrives
   with the PDF attached. Then sign in from `/signin`. Brevo → Transactional → Logs shows each
   email (tagged `report`, `sign_in`, `account_deleted`).

## How redeploys work

- Each service redeploys on pushes to `phase-2-upload` that touch its own files (the Watch
  Paths set above; without them, every push rebuilds both):
  - `web`: `apps/web/**`
  - `scoring`: `services/scoring/**` and `docs/advice-texts.md`
- A push that only changes, say, `design/` or `docs/evidence/` rebuilds nothing.
- Health checks gate every deploy: `web` on `/api/health`, `scoring` on `/health`. A new
  version only takes traffic once its check passes. `scoring`'s check fails on purpose if it
  can't read the advice texts, so a broken build never goes live.

## Upload size limit

10 MB, enforced at three points:

1. The browser refuses larger files before uploading ("This file is over 10 MB.").
2. `web`'s `/api/score` stops reading at 10 MB and answers `413 file_too_large`, with or
   without a declared length.
3. `scoring` does the same.

Tested locally, through both production images on a private Docker network: a
10,485,760-byte statement scores, and 10,485,761 bytes is refused. Railway's own edge hasn't
been tested yet. After deploying, upload a statement close to 10 MB once to confirm it gets
through.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Build log lists supported languages ("Php, Golang, Java…"), then `railpack process exited with an error` | Railway used Railpack instead of the Dockerfile | Add `RAILWAY_DOCKERFILE_PATH` on that service (values above) and redeploy. |
| Every upload shows "Server error" | `web` can't reach `scoring` | Check `SCORING_URL` on `web` is exactly the value above, `scoring` is named `scoring`, and `scoring`'s deploy log says `http://[::]:8000`. |
| `scoring` log shows `http://0.0.0.0:8000` | IPv6 not available in that container | Rare on Railway. The service then only listens on IPv4. If the private network needs IPv6 there, ask Railway support to enable it for the environment. |
| `scoring` deploy fails its health check with `advice_texts_unreadable` | The image can't read `docs/advice-texts.md` | Check Root Directory is empty (repo root) and `RAILWAY_DOCKERFILE_PATH` is `services/scoring/Dockerfile`. |
| Build can't find `apps/web/package.json` or `services/scoring/requirements.txt` | Root Directory was set to the service folder | Clear Root Directory. Builds run from the repo root. |
| Pages are indexable on a test deploy | `SITE_ENV` is `production` there | Remove it and redeploy. |
| Uploads score but every page shows "Server error" after scoring | `web` can't reach the database | Check `DATABASE_URL` is `${{Postgres.DATABASE_URL}}` and the pre-deploy command ran (`migrations applied` in the deploy log). |
| Deploy stops at the pre-deploy step | A migration failed | Read the pre-deploy log; the previous version is still serving. |
| `/admin` sign-in says the code didn't work | Phone clock drift, or `ADMIN_TOTP_KEY` changed since the admin was created | Check the phone's time is automatic. If the key changed, create the admin again. |
| `/health` on `scoring` shows `"fingerprint": false` | `ACCOUNT_FINGERPRINT_SECRET` not set | Add it to `scoring` and redeploy. Results scored without it can't be grouped later. |
| Sign-in emails never arrive on a test deploy | No `BREVO_API_KEY` | Expected on test deploys; add the key and an authenticated `MAIL_FROM` to test email. |
| Emails fail with "email provider error 401" | Wrong or revoked `BREVO_API_KEY`, or Brevo blocks the request's IP | Generate a new key; in Brevo → Security → Authorised IPs, turn IP blocking off for the API (Railway's outgoing IPs change). |
| Emails fail with "email provider error 400" | `MAIL_FROM` is not a sender Brevo accepts | Use an address on the authenticated domain (Senders, Domains & Dedicated IPs → Domains). |
