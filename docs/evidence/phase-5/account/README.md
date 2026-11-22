# Account screens (design/account) and the PDF report

## Against the design
`vs-design.md`: every state at 390 and 1440, the app's design preview (`?preview=1`, the
design's sample data) against `design/screenshots/account/`. Same page heights; under 2.5%
of pixels differ, from approved text changes ("IC Markets · Live" instead of masked digits,
approved coach lines). Two intended differences: no "+N since your last upload" on the
first full score, and no second sentence on "Goal reached". `vs-design/` keeps four of the
side-by-sides (design | app | difference).

## With real data (`real/`)
From `apps/web/tests/e2e/account_flow.js` (26 checks, `account_flow.txt`): lead → report
email with the PDF → sign in → dashboard → second upload (goal reached) → change goal →
PDF download → settings → delete.

## PDF report
`../../phase-6/sample-report.pdf` and `../../phase-6/pdf-pages/`: the report the dashboard
downloaded in that run (7 pages: cover, every metric, coach notes, red flags, plan, what
managers are judged on, next step). Rendered by the scoring service with WeasyPrint in about
1.5 seconds; nothing is stored.

## Tests
- Scoring: 190 pass (8 new for the PDF).
- Web: unit 13, database 48 pass.
- Browser: account journey 26, sign-in 12, results button and banner 23, form modal 24,
  lead flow 18, upload: all pass.
