# Phase 2 evidence: upload, results and error states

Built from `apps/web` (Next.js 16.4.5, production build) against the live scoring service.

## Design match

Each built screen rendered with the design's URL parameters and sample data (dev-only preview),
compared pixel by pixel with `design/screenshots`. Images in `design-vs-built/` show
design | built | differing pixels in red.

| Screen | Design size | Built size | Pixels differing |
|---|---|---|---|
| 01-landing-mobile | 390×4578 | 390×4578 | 0.00% |
| 02-landing-mobile-export-tab | 390×4544 | 390×4544 | 0.00% |
| 03-landing-desktop | 1440×2378 | 1440×2378 | 0.00% |
| 04-analyzing-mobile | 390×1102 | 390×1102 | 0.01% |
| 05-analyzing-desktop | 1440×1084 | 1440×1084 | 0.00% |
| 06-error-mt4-mobile | 390×1116 | 390×1116 | 0.00% |
| 07-error-mt4-desktop | 1440×1020 | 1440×1020 | 0.00% |
| 08-error-empty-mobile | 390×1089 | 390×1089 | 0.00% |
| 09-error-not-statement-mobile | 390×1089 | 390×1089 | 0.00% |
| 10-error-too-large-mobile | 390×1062 | 390×1062 | 0.00% |
| 11-results-mobile | 390×2754 | 390×2754 | 0.00% |
| 12-results-desktop | 1440×1724 | 1440×1724 | 0.00% |
| 13-results-warn-mobile | 390×2798 | 390×2798 | 0.00% |
| 14-results-warn-desktop | 1440×1747 | 1440×1747 | 0.00% |
| 15-form-errors-mobile | 390×2884 | 390×2884 | 0.00% |
| 18-not-enough-history-mobile | 390×2142 | 390×2142 | 0.00% |
| 19-not-enough-history-desktop | 1440×1536 | 1440×1536 | 0.00% |

## Real uploads (browser → /api/score → scoring service)

Synthetic MT5 statements uploaded through the page at 390 and 1440. Screenshots in `uploads/`.
Every run also checks that the disclaimer is on the page and that the account number is not.

```
ok   disciplined.xlsx @390 4501ms | 98 Professional Grade | no flags | Your worst drawdown was only 6.3%. That's manager-level control.
ok   disciplined.xlsx @1440 4467ms | 98 Professional Grade | no flags | Your worst drawdown was only 6.3%. That's manager-level control.
ok   disciplined.html @390 4433ms | 98 Professional Grade | no flags | Your worst drawdown was only 6.3%. That's manager-level control.
ok   disciplined.html @1440 4441ms | 98 Professional Grade | no flags | Your worst drawdown was only 6.3%. That's manager-level control.
ok   demo.xlsx @390 4499ms | 91 Professional Grade | no flags | Your worst drawdown was only 6.3%. That's manager-level control.
ok   demo.xlsx @1440 4429ms | 91 Professional Grade | no flags | Your worst drawdown was only 6.3%. That's manager-level control.
ok   martingale.xlsx @390 4420ms | 40 Building | 2 red flags found. Your score is capped at 40. | Your account dropped 43.3% at its worst. That's the number investors look at first.
ok   martingale.xlsx @1440 4440ms | 40 Building | 2 red flags found. Your score is capped at 40. | Your account dropped 43.3% at its worst. That's the number investors look at first.
ok   blown.xlsx @390 4444ms | 30 Developing | blown_account | Your account dropped 58.4% at its worst. That's the number investors look at first.
ok   blown.xlsx @1440 4440ms | 30 Developing | blown_account | Your account dropped 58.4% at its worst. That's the number investors look at first.
ok   losses-held-open.xlsx @390 4460ms | 87 Professional Grade | losses_held_open | Your worst drawdown was only 0.0%. That's manager-level control.
ok   losses-held-open.xlsx @1440 4496ms | 87 Professional Grade | losses_held_open | Your worst drawdown was only 0.0%. That's manager-level control.
ok   short-history.xlsx @390 4426ms | —  |  | Not enough history yet. Come back on 1 December 2026 for your score.
ok   short-history.xlsx @1440 4422ms | —  |  | Not enough history yet. Come back on 1 December 2026 for your score.
ok   statement.htm @390 676ms | error:mt4 |  | 
ok   statement.htm @1440 654ms | error:mt4 |  | 
ok   ReportHistory-MT4.htm @390 655ms | error:mt4 |  | 
ok   ReportHistory-MT4.htm @1440 660ms | error:mt4 |  | 
ok   notes.xlsx @390 646ms | error:notstatement |  | 
ok   notes.xlsx @1440 670ms | error:notstatement |  | 
ok   photo.png @390 629ms | error:notstatement |  | 
ok   photo.png @1440 656ms | error:notstatement |  | 
ok   empty.xlsx @390 665ms | error:empty |  | 
ok   empty.xlsx @1440 682ms | error:empty |  | 
ok   empty-report.xlsx @390 676ms | error:empty |  | 
ok   empty-report.xlsx @1440 714ms | error:empty |  | 
ok   big.xlsx @390 609ms | error:toolarge |  | 
ok   big.xlsx @1440 647ms | error:toolarge |  | 
all passed
```

The ~4.5 s on scored uploads is the design's step animation (3 × 1 s + 0.7 s); scoring itself
takes about 0.5 s. Errors show as soon as they are known.

## Other tests

- Scoring service: 81 passed in 14.66s
- Web unit tests (view logic): # pass 5 # fail 0 
- Privacy: no account number and no statement content in the web or scoring logs after all runs.
- `npm audit`: 0 vulnerabilities.

## Built without a design (decided in chat)

- Red-flag panel with 2+ flags: summary line above the rows; capping rows use the design's red
  panel (its sub-line shown once, under the first capping row); non-capping rows (no stop losses,
  losses held open) use the amber warning palette from the design tokens.
- "Demo account" chip.
