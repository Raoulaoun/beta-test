# The Manager Test, by Beta

A free web tool at managertest.betaapp.me. A trader uploads an MT5 statement and gets a
Manager-Readiness score (0–100) for free. After leaving their name, email and phone they
get the full PDF report. The tool exists to generate leads for Beta's manager funnel.

It is a standalone product with its own repo, deployment and database. It has no
connection to the Beta platform codebase.

## Sources of truth

- `docs/spec.md`: the full build spec. Scope, scoring, flows, CRM, follow-up, privacy and
  acceptance tests all come from here.
- `docs/advice-texts.md`: every fixed text (metric advice, red flags, headline insights,
  education emails). Use it word for word. Never write new advice copy.
- `design/`: the approved screens from Claude Design. Match them exactly. If a screen or
  state is missing, stop and ask. Don't invent one.
- `samples/`: real MT5 statements for parser testing. Git-ignored. Never commit, copy,
  print or quote their contents anywhere outside the local run.

## Persistent rules

1. **Plan first.** Before each phase, show a short plan and wait for approval.
2. **One branch per phase** (`phase-1-scoring`, `phase-2-upload`, …). Never push to
   `main` without explicit OK.
3. **Rendered evidence at the end of each phase:** test output, plus screenshots of every
   screen built at mobile 390px and desktop 1440px.
4. **UI follows `design/` exactly. Copy follows `docs/` exactly.**
5. **Privacy.** An uploaded statement is processed in memory only. Never write it to disk,
   object storage, the database or logs. Never store or log the account number. Mask it
   at parse time.
6. **Compliance wording.** Never "eligible / qualified / approved / accepted". No returns
   or money amounts on share cards. No trade signals. The disclaimer from the spec appears
   on results, PDF, calculators and footer.
7. **Deterministic, versioned scoring.** `scoring_version` is saved with every result. No
   AI/LLM calls anywhere in the product.

## Phases

One at a time, in this order: plan → approval → build → evidence. Launch ships the full
product, not a thin version.

1. Scoring engine (`services/scoring`). Done.
2. Upload flow and results: full score, early score, starter read, MT4 and MT5, error states.
3. Database, accounts (email-link sign-in), lead form, funnel CRM (`/admin`), drop-off
   tracking, saved result, exit prompt.
4. Coach insights engine and its results block.
5. Dashboard: score history and goals.
6. PDF report, including the coach notes page, and report email.
7. Share cards (story 1080×1920, post 1080×1080).
8. The five calculators.
9. Emails: follow-up by band, daily digest, retest reminders, monthly check-up.
10. Hardening and launch: analytics, Turnstile, rate limits, cookie notice, privacy policy,
    production deploy on managertest.betaapp.me.

Version 2, after launch: automatic tracking through an investor (read-only) password. Don't
build it, and don't block it: results carry a `source` (`upload` now, `connected` later) and
scoring takes a parsed statement, whatever produced it.

## Data rules

- An account has many results (score history). Every result stores its evaluation date and
  scoring version.
- Insights are stored per result as segment aggregates only, never individual trades.
- Deleting an account deletes the account, its results and its insights.
- Screens for coach notes, dashboard, sign-in and settings come from Claude Design. Don't
  build them from scratch.

## Stack

- `apps/web`: Next.js (App Router, TypeScript). Landing, upload, results, lead form,
  confirmation, calculators, share cards (server-side images), admin CRM at `/admin`
  (login + 2FA).
- `services/scoring`: Python + FastAPI (pandas, numpy, openpyxl, lxml). Stateless: parse
  → metrics → pillars → red flags → band → insights. PDF via WeasyPrint from HTML templates.
- Postgres on Railway: results (anonymous until converted), leads, pipeline stages,
  notes, email log, retests.
- Email: Resend (transactional, scheduled sequences, daily digest).
- Protection: Cloudflare Turnstile on the form; 10 uploads per IP per hour.
- Analytics: Meta Pixel and GA4 events `upload_started`, `score_shown`, `lead_submitted`,
  `card_downloaded`, `calculator_used`.
- Deploy: Railway, two services plus Postgres, on managertest.betaapp.me.
