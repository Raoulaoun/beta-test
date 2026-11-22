# Design brief: the phone report ("phone read")

For Claude Design. Same product and design system as the approved screens in `design/`
(flow, account, PDF report): colours, Inter / Inter Tight, pill buttons, 24px cards, the
390px phone and 1440px desktop frames. Every screen at both widths.

## Why

Many traders only have their phone. The MetaTrader phone app exports one thing: the
**overview report as a PDF** (Summary, Profit & Loss, Long & Short, Symbols, Risks). It has
totals but **no list of trades**, so we can't compute the Manager-Readiness score: no stop-loss
use, no risk per trade, and above all no red-flag check (martingale, grid, losses held open).
A trader can look excellent in these totals right up until the account blows.

So a PDF gets a **phone read**: what we can already see, what we can't check, and a clear,
motivating path to the full history from a computer. Two goals, in this order:

1. **Keep the phone trader**: they still get value and still reach the lead form.
2. **Get the Excel file**: make the full score feel worth the 2 minutes on a computer.

No 0–100 score and no band on a phone read (approved). No money amounts.

## What we can read from the PDF (to show)

Use these as sample values: 5 trades over 8 days, win rate 80%, profit factor 2.72,
max consecutive losses 1, deposit load 10.85%, best trade vs worst trade (as a ratio, not
money). Each reading gets a verdict line in the existing metric-advice style (a "Good" or
"Watch" chip, as the PDF report's metrics page does).

## What we can't check (to show as locked)

- Your Manager-Readiness score (0–100) and band
- Red-flag check: martingale, grid trading, losses held open
- Stop-loss use and risk per trade
- Coach notes: your best sessions, your costly habits

## Screens and states needed

### 1. Upload box (landing)
The formats line gains the phone report. Suggested: "MT5: XLSX or HTML report · MT4: HTML
statement · Phone: MetaTrader PDF report · up to 10 MB". The export guide gains a fourth tab
"On your phone" (two steps), and the desktop tab stays first and marked as the best option.

### 2. Results: phone read
Replaces the score card for a PDF upload. Please design:
- **The phone-read card** (where the score dial is): a title, one line explaining it's a
  read from the phone report, chips (Live/Demo, trades, period).
- **"What we can see"**: the readings above, each with value + verdict.
- **"Unlocked with your full history"**: the locked list above, visibly locked (but not
  hostile), with the main call to action: **get the full score from a computer**.
- **The 4 desktop steps** inline, with the real screenshots (we have them):
  1. Open the Toolbox (Ctrl+T) and go to the History tab.
  2. Right-click the list and choose All History.
  3. Right-click again: Report → Open XML (MS Office Excel 2007).
  4. Upload the file here.
- **"Send me these steps by email"**: an option for someone on their phone now. It can
  share the lead form's email field or be its own small field: your call. This is likely
  our strongest bridge from phone to computer.
- **The lead form** stays, as on every results screen ("Get your full report and
  improvement plan"): for a phone read, the PDF report is a short version (what we see,
  what's locked, the steps).
- States: phone read at both widths; under 5 trades ("not enough trades yet", as the
  starter read); a PDF that isn't a MetaTrader report (error screen, existing style).

### 3. Dashboard
A phone read in the history list: shown as "Phone read" with no score, outside the score
chart, with "Upload your full history" as its action.

### 4. Report email (phone read)
The existing report email with the phone-read wording and the 4 steps, so they have them
when they sit at their computer.

## Copy

Please write every new line, button and message, motivating but plain. It goes into
`docs/advice-texts.md` once approved and is used word for word. Rules: short, no "eligible /
qualified / approved / accepted", no money amounts, no trade signals. Starting points
to improve on:

- Title: "Your phone read"
- Line: "Your phone report shows your totals, not your trades. Here's what we can already see."
- Locked: "Your full score needs your full history"
- Push: "2 minutes on a computer unlocks your score, your red-flag check and your coach notes."
- Email option: "Send me the steps"

## Accessibility

Locked items readable as text (not only an icon), 44px targets, the steps as an ordered list.
