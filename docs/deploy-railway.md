# Deploying to Railway

Two services in one Railway project, both built from this repo with their own Dockerfile:

| Service | What it is | Public domain | Config file |
| --- | --- | --- | --- |
| `web` | Next.js site and `/api/score` upload route | Yes | `/apps/web/railway.json` |
| `scoring` | Python scoring service (FastAPI) | **No**, private network only | `/services/scoring/railway.json` |

The browser only ever talks to `web`. `web` forwards each upload to `scoring` over Railway's
private network, and `scoring` is never reachable from the internet.

Postgres is not needed yet (Phase 3).

## 1. Create the project and the `scoring` service

1. In Railway, click **New Project** → **Deploy from GitHub repo** → pick `Raoulaoun/beta-test`.
   If Railway asks for access to the repo, grant it, then pick it again.
2. Railway creates one service and may start a build straight away. Let it fail or cancel it;
   it isn't configured yet.
3. Open the service → **Settings**:
   - **Service name** (top of Settings): `scoring`. The name sets its private address
     (`scoring.railway.internal`), so use exactly this.
   - **Source** → **Branch**: `phase-2-upload`.
   - **Source** → **Root Directory**: leave **empty**. Both services build from the repo root,
     because `scoring` needs `docs/advice-texts.md` at runtime.
   - **Config-as-code** → **Railway Config File**: `/services/scoring/railway.json`
     (absolute path, starting with `/`). This sets the Dockerfile, the `/health` check and the
     watch paths.
   - **Networking**: do **not** click "Generate Domain". Leave Public Networking empty.
     Private Networking is on by default and shows `scoring.railway.internal`.
4. Open **Variables** → **New Variable**:

   | Name | Value |
   | --- | --- |
   | `PORT` | `8000` |

5. Click **Deploy** (or **Apply changes**, then deploy).
6. In **Deployments** → the latest deployment → **Deploy Logs**, check for:
   `Uvicorn running on http://[::]:8000`. The `[::]` matters: it means the service listens on
   IPv6, which Railway's private network uses. If you see `0.0.0.0` instead, see
   Troubleshooting.

## 2. Add the `web` service

1. In the project canvas: **Create** (or **+ New**) → **GitHub Repo** → `Raoulaoun/beta-test`.
2. Open the new service → **Settings**:
   - **Service name**: `web`.
   - **Source** → **Branch**: `phase-2-upload`.
   - **Source** → **Root Directory**: leave **empty**.
   - **Config-as-code** → **Railway Config File**: `/apps/web/railway.json`.
3. Open **Variables** → **New Variable** for each:

   | Name | Value | Notes |
   | --- | --- | --- |
   | `PORT` | `3000` | The port Next.js listens on. |
   | `SCORING_URL` | `http://${{scoring.RAILWAY_PRIVATE_DOMAIN}}:${{scoring.PORT}}` | Type it exactly like this. Railway fills in `scoring.railway.internal` and `8000`. Must be `http`, not `https`: the private network has no TLS. |

   Leave `SITE_ENV` unset for this test deploy. Unset means "not production": every page
   sends `X-Robots-Tag: noindex, nofollow` and a robots noindex meta tag, and `robots.txt`
   disallows everything.

4. **Settings** → **Networking** → **Public Networking** → **Generate Domain**. When asked for
   the port, enter `3000`. You get a `*.up.railway.app` address.
5. Deploy. In **Deploy Logs** you should see Next.js start with `Ready`.

## 3. Check the deploy

Replace `https://web-xxxx.up.railway.app` with your generated domain.

1. `https://web-xxxx.up.railway.app/api/health` returns `{"ok":true}`.
2. Open the domain: the landing page loads.
3. Upload a real MT5 statement. You should get a score or "Not enough history". If you get
   **"Server error"**, `web` can't reach `scoring`: see Troubleshooting.
4. Upload a non-statement file, e.g. a PNG: you get "This doesn't look like an MT5 statement."
5. Noindex check, from a terminal:

   ```bash
   curl -sI https://web-xxxx.up.railway.app/ | grep -i x-robots
   ```

   It prints `X-Robots-Tag: noindex, nofollow`.
6. `scoring` must not be public: its **Settings** → **Networking** shows no public domain.

## Every environment variable

| Service | Variable | Value | Where it comes from |
| --- | --- | --- | --- |
| `scoring` | `PORT` | `8000` | Set by you. Fixed, so `web` can address it on the private network. |
| `web` | `PORT` | `3000` | Set by you. Must match the port given to Generate Domain. |
| `web` | `SCORING_URL` | `http://${{scoring.RAILWAY_PRIVATE_DOMAIN}}:${{scoring.PORT}}` | Railway reference variables, resolved by Railway. |
| `web` | `SITE_ENV` | unset, or `production` | Unset on every test/staging deploy. Set to `production` **only** on the live site at launch; it makes the site indexable. Changing it triggers a rebuild, which is needed (it is read at build time). |

Do **not** set these on Railway:

| Variable | Why |
| --- | --- |
| `DESIGN_PREVIEW` | Turns on the dev-only design preview (sample data via URL parameters). Development only. |
| `ADVICE_TEXTS_PATH` | Already set inside the `scoring` image to the copy of `docs/advice-texts.md` it ships with. |

No secrets are needed in Phase 2.

## How redeploys work

- Each service redeploys on pushes to `phase-2-upload` that touch its own files (the
  config's watch paths):
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
| Every upload shows "Server error" | `web` can't reach `scoring` | Check `SCORING_URL` on `web` is exactly the value above, `scoring` is named `scoring`, and `scoring`'s deploy log says `http://[::]:8000`. |
| `scoring` log shows `http://0.0.0.0:8000` | IPv6 not available in that container | Rare on Railway. The service then only listens on IPv4. If the private network needs IPv6 there, ask Railway support to enable it for the environment. |
| `scoring` deploy fails its health check with `advice_texts_unreadable` | The image can't read `docs/advice-texts.md` | Check Root Directory is empty (repo root) and the config file is `/services/scoring/railway.json`. |
| Build can't find `apps/web/package.json` or `services/scoring/requirements.txt` | Root Directory was set to the service folder | Clear Root Directory. Builds run from the repo root. |
| Pages are indexable on a test deploy | `SITE_ENV` is `production` there | Remove it and redeploy. |
