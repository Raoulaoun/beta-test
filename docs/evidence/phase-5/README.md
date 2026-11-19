# Phase 5: dashboard data (screens wait for Claude Design), plus results-screen changes

## Built
- Scoring 1.3.2: Profitable months and Best month are "not enough data yet" under 3 months
  (left out of Consistency, its other metrics reweighted; never the headline or a top fix).
- Thousand separators in trade counts ("9,711 trades").
- "Get my full report" under the score card; on phones also a sticky bottom bar (shown only
  while the button and the inline form are off screen). Both open the form modal
  (`form_opened`, source `results_button`).
- Signed-out banner on a known device (signed in to, or created, an account before). The
  link goes to the account's email; this result is held and joins the history on sign-in.
  The browser never holds the email (httpOnly cookie, token hash only).
- API, signed in only: `GET /api/dashboard` (history per trading account, default most
  recent, early marked, starter off the chart, full coach findings, since your last result,
  goal), `GET/POST /api/goal`, `GET/PATCH /api/settings`; `DELETE /api/account` also clears
  known devices.
- Migration 0003: known devices, email-choice columns (retest reminders backfilled from the
  existing reminder date), goal "reached by" result.

## Screenshots
- `cta-desktop-1440.png`, `cta-phone-390.png`, `cta-phone-390-sticky.png`
- `banner-1440.png`, `banner-1440-sent.png`, `banner-390.png`, `banner-390-sent.png`
  ("Sign-in link sent. Check your email." is placeholder copy, on the launch checklist)

## Tests
- Scoring: 182 pass. Web DB: 44 pass (13 new for history, since-last, goals, settings,
  known device, deletion). Unit: 10 pass.
- Browser: `results_cta.js` 23 checks (see `results_cta.txt`); modal 24, lead flow 18,
  sign-in 12 and upload re-run, all pass.
