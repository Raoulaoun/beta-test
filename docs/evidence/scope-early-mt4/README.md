# Evidence: early score, starter read, nudge, MT4 statements

Scoring 1.2.0. Branch `scope-early-mt4` (from `phase-2-upload`).

## Tests

- Scoring service: 123 passed in 17.24s
- Web unit tests: # pass 9 # fail 0 

## Browser uploads (production build, live scoring service)

```
ok   disciplined.xlsx @390 4523ms | 98 Professional Grade | no flags | Your worst drawdown was only 6.3%. That's manager-level control.
ok   disciplined.xlsx @1440 4469ms | 98 Professional Grade | no flags | Your worst drawdown was only 6.3%. That's manager-level control.
ok   disciplined.html @390 4448ms | 98 Professional Grade | no flags | Your worst drawdown was only 6.3%. That's manager-level control.
ok   disciplined.html @1440 4453ms | 98 Professional Grade | no flags | Your worst drawdown was only 6.3%. That's manager-level control.
ok   demo.xlsx @390 4495ms | 91 Professional Grade | no flags | Your worst drawdown was only 6.3%. That's manager-level control.
ok   demo.xlsx @1440 4501ms | 91 Professional Grade | no flags | Your worst drawdown was only 6.3%. That's manager-level control.
ok   martingale.xlsx @390 4429ms | 40 Building | 2 red flags found. Your score is capped at 40. | Your account dropped 43.3% at its worst. That's the number investors look at first.
ok   martingale.xlsx @1440 4459ms | 40 Building | 2 red flags found. Your score is capped at 40. | Your account dropped 43.3% at its worst. That's the number investors look at first.
ok   blown.xlsx @390 4433ms | 30 Developing | blown_account | Your account dropped 58.4% at its worst. That's the number investors look at first.
ok   blown.xlsx @1440 4453ms | 30 Developing | blown_account | Your account dropped 58.4% at its worst. That's the number investors look at first.
ok   losses-held-open.xlsx @390 4452ms | 71 Emerging Manager | losses_held_open | You made 0.6 times your max drawdown. Investors want at least 2.
ok   losses-held-open.xlsx @1440 4486ms | 71 Emerging Manager | losses_held_open | You made 0.6 times your max drawdown. Investors want at least 2.
ok   short-history.xlsx @390 4476ms | 69 Emerging Manager | no flags | One month makes up 79% of your total profit.
ok   short-history.xlsx @1440 4454ms | 69 Emerging Manager | no flags | One month makes up 79% of your total profit.
ok   early-nudge.xlsx @390 4473ms | 69 Emerging Manager | no flags | One month makes up 65% of your total profit. | nudge
ok   early-nudge.xlsx @1440 4449ms | 69 Emerging Manager | no flags | One month makes up 65% of your total profit. | nudge
ok   starter.xlsx @390 4410ms | —  |  | Your starter read | nudge
ok   starter.xlsx @1440 4449ms | —  |  | Your starter read | nudge
ok   mt4-statement.htm @390 4448ms | 98 Professional Grade | no flags | Your worst drawdown was only 6.3%. That's manager-level control.
ok   mt4-statement.htm @1440 4432ms | 98 Professional Grade | no flags | Your worst drawdown was only 6.3%. That's manager-level control.
ok   mt4-detailed.htm @390 4487ms | 40 Building | 2 red flags found. Your score is capped at 40. | Your account dropped 43.3% at its worst. That's the number investors look at first.
ok   mt4-detailed.htm @1440 4428ms | 40 Building | 2 red flags found. Your score is capped at 40. | Your account dropped 43.3% at its worst. That's the number investors look at first.
ok   mt4-no-trades.htm @390 630ms | error:empty |  | 
ok   mt4-no-trades.htm @1440 682ms | error:empty |  | 
ok   notes.xlsx @390 626ms | error:notstatement |  | 
ok   notes.xlsx @1440 660ms | error:notstatement |  | 
ok   photo.png @390 626ms | error:notstatement |  | 
ok   photo.png @1440 657ms | error:notstatement |  | 
ok   empty.xlsx @390 665ms | error:empty |  | 
ok   empty.xlsx @1440 676ms | error:empty |  | 
ok   empty-report.xlsx @390 647ms | error:empty |  | 
ok   empty-report.xlsx @1440 697ms | error:empty |  | 
ok   big.xlsx @390 668ms | error:toolarge |  | 
ok   big.xlsx @1440 660ms | error:toolarge |  | 
all passed
```

## Real samples

Evaluation date: 2026-11-17

| File | Platform | Account | Broker | Type | Size | Period | Months | Trades | Outcome | Score | Band | Risk | Disc. | Cons. | Risk-adj. | Depth | Red flags | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ReportHistory-A.xlsx | MT5 | •••933 | Credit Financier Invest (International) Ltd. | demo | under $1k | 2 weeks | 0.1 | 16 | early | 10 | Developing | 0 | 50 | 0 | 0 | 0 | blown_account, no_stops | losses_held_open |
| ReportHistory-B.xlsx | MT5 | •••709 | Royal ETP LLC | demo | under $1k | 2 weeks | 0.1 | 10 | early | 10 | Developing | 0 | 50 | 0 | 0 | 1 | grid, blown_account, no_stops | — |

**MT4 parser: unverified on real files.** Every MT4 result here comes from synthetic Statement
and Detailed Statement files written to the documented MT4 layout. `samples/` has no MT4 file
yet; this note stays until real ones have been run.

## New screens next to their neighbours (`review/`)

Built from existing design pieces (approved): score card + progress bars, amber caution banner
for the nudge, white pillar-card style for starter metrics, existing tab style for MT4.

- `results-mobile.png`: full result (design sample) | early score with nudge | starter read with nudge
- `results-desktop.png`: full | early | early with nudge | starter with nudge (top 1500 px)
- `landing-tabs-desktop.png`, `landing-tabs-mobile.png`: On desktop tab | MT4 tab
- `errors-mobile.png`: not a report | empty | server error, with the new copy
