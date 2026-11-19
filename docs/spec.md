# The Manager Test — Build Spec

Nov 16, 2026 · @raoul

## Overview

The Manager Test is a free, Beta-branded web tool. A trader uploads their MT5 statement and gets a Manager-Readiness score out of 100 in under 60 seconds. The full report is sent in exchange for name, email and phone, so every user becomes a qualified manager lead.

**Name and headline**

- Name: The Manager Test, by Beta
- Headline: Are you ready to manage other people's money? Upload your MT5 statement and find out in 60 seconds. Free.

**Why it exists**

- Feeds Beta's manager funnel with leads that come with real trading data, not just curiosity.
- Shows the gap between trading for yourself and managing for others, which is Beta's core message.
- Runs on its own: no market data, no AI costs, no accounts to manage.

**Design constraints**

- Free to use, with no paid tier in v1.
- Easy to build with Claude Code, using existing scoring logic from the league rating engine.
- Little ongoing management: deterministic scoring, automatic follow-up, no content to update.
- Separate from the Beta platform: own repo, own deployment, Beta branding.

**What we measure**

| Metric | What it tells us |
| --- | --- |
| Uploads per week | Is traffic reaching the tool |
| Upload to lead rate | Is the full report worth leaving details for |
| Share of leads scoring 60+ | Lead quality |
| Shares of the score card | Organic reach |
| Webinar signups and manager applications from tool leads | Does it feed the funnel |
| Scored but no form (drop-off rate) | How many leads we lose, and the size of the retargeting pool |

Targets for each metric are an open item.

## Scope

Version 1 is the Manager Test plus five open calculators. Everything that costs money to run or needs ongoing care is out.

| Area | In v1 | Out of v1 (later, maybe) |
| --- | --- | --- |
| Input | MT5 statement export, XLSX and HTML (ReportHistory), with a step-by-step export tutorial | MT4 statements, Myfxbook links, broker API connections |
| Output | Results screen, PDF report by email, share cards | Progress tracking across retests, public leaderboard |
| Calculators | Position size, risk of ruin, drawdown recovery, compounding, risk/reward | Anything needing live prices |
| Leads | Required name, email and phone; drop-off tracking; dedicated funnel CRM; automatic follow-up | User accounts and logins |
| Language | English | Arabic |
| Money | Free | Paid tier |
| Never | Live market data, AI agents, trade signals, live trading |  |

**Calculators**

They're fully open, with no sign-up. Their job is traffic, search ranking and trust. Each page ends with a soft prompt: "Want to know if your trading is manager-ready? Take the Manager Test."

- Position size: balance, risk %, stop distance and instrument give the lot size.
- Risk of ruin: win rate, reward/risk and risk per trade give the probability of a set drawdown.
- Drawdown recovery: a loss % gives the gain needed to get back (for example, 30% down needs +43%).
- Compounding: monthly return and months give the growth curve, with a drawdown warning.
- Risk/reward: entry, stop and target give the ratio and the breakeven win rate.

Pip values for the position-size calculator use standard contract sizes. Users type the price for non-USD pairs, so no data feed is needed.

## User flow

The trader goes from landing to score in under a minute. Lead capture sits between the free score and the full report.

1. **Land.** Traffic arrives from an ad, Instagram, a webinar or an introducer link. UTM tags and any introducer ref code are kept for the whole session.
2. **Learn how to export.** A step-by-step tutorial sits right above the upload box, with two tabs. Desktop: History tab → right-click → Report → Open XML (or HTML), with annotated screenshots and a 20-second clip. Mobile: how to request the report from the MT5 app and upload the file once it arrives.
3. **Upload.** Drag and drop, 10 MB max. The file is checked: is it an MT5 report, does it have trades. Errors are plain and friendly ("This looks like an MT4 file, we only support MT5 for now").
4. **See the free score.** Overall score, band, five pillar bars, one headline insight and the names of any red flags. The view is logged anonymously, so people who leave without the form are counted.
5. **Unlock the full report.** Form: name, email, phone (required) and one qualifier question. Submit triggers the PDF by email.
6. **Share.** Download a story or post card with score and band. No money amounts.
7. **Next step.** The confirmation screen offers the webinar, the Beta Managers Room and a link to learn about Beta.
8. **Follow-up.** Automatic emails by band start, plus a human WhatsApp message for top bands.

If the statement is too short (under 3 months or 30 trades), step 4 shows "Not enough history yet" with the date they can come back. Step 5 still captures the lead, and a reminder is sent on that date.

## Scoring engine

The score is on a fixed scale: the same statement always gets the same score, whoever else has uploaded. It reuses the metric calculations of the league rating engine (trader-elo-rater) and drops the group normalization and Glicko-2 layers. Returns weigh least. Risk control and discipline weigh most.

### Parsing the statement

- Read the header (account, broker name, server, currency) and the Positions and Deals sections.
- Rebuild each closed position with open/close time, symbol, direction, volume, open/close price, S/L, profit, commission and swap.
- Separate deposits and withdrawals from trading P&L. Returns are always computed on trading P&L only.
- Build a closed-balance equity curve. The report has no floating equity, so drawdown is measured on closed trades, and the report says so.
- Detect demo accounts from the server or broker name containing "Demo".
- Mask the account number. It is never stored.

**Minimum history:** at least 3 months between first and last trade and at least 30 closed trades. Below that: no score, "Not enough history yet", and a come-back date.

### The five pillars

Each metric scores 0 to 100 by linear interpolation between its zero-point and its full-marks point. A pillar's score is the weighted average of its metrics. All thresholds are a first draft for the CIO to review.

| Pillar (weight) | Metric (share of pillar) | Full marks at | Zero at |
| --- | --- | --- | --- |
| Risk control (25%) | Max drawdown, peak to trough (40%) | ≤ 10% | ≥ 40% |
| Risk control | Worst day, % of balance (20%) | ≤ 3% | ≥ 15% |
| Risk control | Average loss, % of balance at the time (20%) | ≤ 1% | ≥ 5% |
| Risk control | Trades with a stop loss (20%) | ≥ 90% | ≤ 30% |
| Discipline (20%) | Revenge sizing: avg volume within 4h after a loss ÷ normal volume (30%) | ≤ 1.1× | ≥ 2.0× |
| Discipline | Adding to losers: positions added same symbol and direction while one is in loss (30%) | 0% | ≥ 20% |
| Discipline | Hold asymmetry: avg time in losers ÷ winners (20%) | ≤ 1.0× | ≥ 3.0× |
| Discipline | Overtrading: days with over 3× the median daily trade count (20%) | ≤ 5% | ≥ 25% |
| Consistency (20%) | Profitable months (40%) | ≥ 75% | ≤ 35% |
| Consistency | Profit from the top 5 trades, % of net profit (40%) | ≤ 30% | ≥ 100% |
| Consistency | Best month, % of total profit (20%) | ≤ 25% | ≥ 70% |
| Risk-adjusted return (20%) | Annualized return ÷ max drawdown (40%) | ≥ 2.0 | ≤ 0 |
| Risk-adjusted return | Sortino, daily, annualized (30%) | ≥ 2.0 | ≤ 0 |
| Risk-adjusted return | Profit factor (30%) | ≥ 1.8 | ≤ 1.0 |
| Track record depth (15%) | Months of history (50%) | ≥ 24 | 3 |
| Track record depth | Closed trades (30%) | ≥ 300 | 30 |
| Track record depth | Days since last trade (20%) | ≤ 30 | ≥ 180 |

A demo account has its depth pillar multiplied by 0.5 and is labeled "Demo" everywhere.

### Red flags (caps on the final score)

| Red flag | How it is detected | Effect |
| --- | --- | --- |
| Martingale | After a loss, the next position on the same symbol is ≥ 1.8× the volume, in chains of 3 or more, covering ≥ 5% of positions | Score capped at 40 |
| Grid | 3 or more same-direction positions open at once on one symbol at progressively worse prices, covering ≥ 5% of positions | Score capped at 40 |
| Blown or near-blown account | Max drawdown ≥ 50% | Score capped at 30 |
| No stops | Under 10% of trades with a stop loss | Flag shown, no cap (already scored in risk control) |

### Bands

| Score | Band | Meaning shown to the trader |
| --- | --- | --- |
| 80–100 | Professional Grade | Your record looks like a manager's |
| 60–79 | Emerging Manager | Close, with a few things to fix |
| 40–59 | Building | Promising, with clear gaps |
| 0–39 | Developing | Trading for yourself, not yet for others |
| No score | Not enough history | Come back on a set date |

### Insights and fixes

- **Headline insight:** rule-based. Take the metric that costs the most points (weight × gap to full marks) and fill its sentence template, for example "62% of your profit came from 4 trades." If the trader scores 80+, lead with the strongest pillar instead.
- **Top 3 fixes:** the three metrics with the largest weighted gap. Each maps to a fixed advice paragraph written once by the Beta team.
- **No AI** is used anywhere. Every sentence comes from templates, so the output is predictable and compliant.

### Versioning

The engine is deterministic and versioned. Every result stores its `scoring_version`, so thresholds can be tuned later without confusing past results.

## Results screen, report and share card

Three outputs, each with one job: the screen hooks, the PDF earns the lead, the card spreads the word.

### Results screen (free, instant)

- Score dial (0–100) and band name
- Five pillar bars with their scores
- One headline insight
- Red flag names, if any (details only in the PDF)
- Demo label, if a demo account
- Main button: "Get my full report and improvement plan", which opens the lead form

### PDF report (by email after the form)

| Page | Content |
| --- | --- |
| 1. Cover | Trader name, score, band, date, broker, masked account, scoring version |
| 2. Pillars | Each pillar with its metrics: their value, full-marks point, and where professional managers typically sit |
| 3. Red flags | Each flag found, what it means, why allocators reject it |
| 4. Your plan | Top 3 fixes with practical steps, and when to retest |
| 5. What managers are judged on | Short page on how investors assess a manager: risk first, consistency second, returns last |
| 6. Next step | Webinar, Beta Managers Room, how Beta helps traders manage money legally; disclaimer |

The PDF uses Beta's brand system. Every page carries "The Manager Test by Beta" and the disclaimer in the footer.

### Share cards

- Two sizes: story (1080×1920) and post (1080×1080)
- Shows: first name (optional, toggle), score, band, five mini pillar bars, "The Manager Test by Beta", the tool's web address
- Never shows: money amounts, return %, balance, broker, account number, coach lines (score, band and pillars only)
- A money-amount check runs as a safety net on every shareable surface
- Generated on the fly as an image. The trader downloads it; nothing is posted for them.

## Lead capture and CRM

The form asks for four things and consent. Phone is required. Each lead lands in the CRM with its full score profile, so follow-up can be sorted without opening anything.

### The form

| Field | Rule |
| --- | --- |
| Full name | Required |
| Email | Required, format-checked |
| Phone | Required. Country-code picker, Lebanon (+961) by default, validated as a real mobile format |
| Are you already managing money for others? | Required: No / Yes, friends and family / Yes, formally |
| Consent to be contacted by Beta | Required checkbox |
| Marketing updates | Optional checkbox |

Bot protection (Cloudflare Turnstile) runs invisibly on the form.

### What is stored per lead

| Field | Notes |
| --- | --- |
| Name, email, phone, country | From the form |
| Managing for others | From the form; strong qualifier |
| Source | UTM tags, landing page, ad or post |
| `introduced_by` | Introducer ref code if they came through an introducer link; ties into the introducer system |
| Score, band, five pillar scores | From the engine |
| Red flags | List |
| Months of history, closed trades | From the engine |
| Account size range | Buckets only: under $1k, $1k–10k, $10k–50k, over $50k |
| Account type | Live or demo |
| Broker name | From the statement header |
| Report sent at, scoring version | System |

The broker field has a second use. Over time it shows which brokers Beta's manager pool trades with, which strengthens broker negotiations.

### Drop-offs: scored but no form

The free score comes first, so some people will leave without their details. Every one of them is counted, and most can be won back through ads and the page itself.

**Counting them**

- Every scored upload creates an anonymous result record: scores, band, broker, size bucket, source and campaign. No personal data.
- Status starts as `scored_no_lead` and switches to `converted` when the form is sent.
- The CRM shows the funnel per campaign: visits → uploads → scored → form sent, plus the score spread of the drop-offs.

**Winning them back**

- **Retargeting:** anyone with a `score_shown` event and no `lead_submitted` joins a Meta audience. Ad: "Your full Manager Test report is waiting."
- **Saved result:** the result ID is kept in the browser for 30 days. A returning visitor sees their score and the form again, with no re-upload.
- **Exit prompt:** leaving the results page triggers one prompt: "Get your improvement plan before you go."
- **Form on the results screen itself,** next to the score, not on a separate page.

Retargeting needs a cookie notice on the site, covered in the privacy section.

### The funnel CRM

Leads go into a CRM dedicated to this funnel, built into the tool's own admin area. It uses the same database, so every lead already carries its score profile, and it costs no extra subscription.

- **Access:** admin login with two-factor, separate from the Beta platform.
- **Leads list** with filters: band, score, campaign, managing for others, broker, date, stage.
- **Pipeline stages:** New → Contacted → Webinar registered → Webinar attended → Applied → Not a fit.
- **Lead page:** score profile, red flags, notes, one-tap WhatsApp, emails sent, retests.
- **Funnel view:** visits, uploads, scores, leads and drop-offs per campaign.
- **CSV export,** so leads can move into Beta's main CRM later.

## Automatic follow-up

Emails run on their own from the moment the form is sent. A human only steps in for the top two bands, through one daily digest, so no lead goes unfollowed.

| Band | Right away | Day 2 | Day 5 | Later |
| --- | --- | --- | --- | --- |
| Professional Grade (80+) | PDF by email; lead flagged hot | Personal WhatsApp from Raoul (task in digest) | Invite to a call and to apply as a manager | Founding-manager offer if no reply by day 10 |
| Emerging Manager (60–79) | PDF by email | Personal WhatsApp (task in digest) | Webinar invite and Beta Managers Room invite | Retest reminder at 60 days |
| Building (40–59) | PDF by email | Email: the most common fix for their weakest pillar | Webinar invite and Beta Managers Room invite | Retest reminder at 60 days |
| Developing (0–39) | PDF by email | Education email 1 (risk basics) | Education email 2 (consistency) | Education email 3 at day 10; retest reminder at 90 days |
| Not enough history | Email with come-back date | — | Beta Managers Room invite | Reminder on the come-back date |

**Daily digest:** one email to Raoul each morning listing new leads scoring 60+, with name, phone, score, band, top weakness and a one-tap WhatsApp link. That's the only manual work the tool creates.

**Retest reminders** link back to the tool with the lead's ID. The new score is stored as a second result, which also tells us who is improving.

## Architecture and stack

Two small services on Railway, separate from the Beta platform: a Next.js site and a stateless Python scoring service. No market data, no AI calls, no file storage.

| Component | Choice | Role |
| --- | --- | --- |
| Web app | Next.js (App Router), Beta brand system | Landing, upload, results, form, calculators, share cards |
| Scoring service | Python, FastAPI, pandas, numpy, openpyxl, lxml | Parse statement, compute metrics, score, insights |
| PDF | HTML templates rendered to PDF in the scoring service (WeasyPrint) | Full report |
| Share cards | Server-side image generation in Next.js (Satori / OG image) | Story and post PNGs |
| Database | Postgres on Railway | Leads and results; never raw statements |
| Email | A transactional email service (Resend or Postmark) plus a scheduled job for sequences | Report delivery, follow-up, daily digest |
| CRM | Built-in funnel CRM: admin area of the same Next.js app, same database | Single source for follow-up |
| Protection | Cloudflare Turnstile, rate limit 10 uploads per IP per hour | Stop bots and abuse |
| Analytics | Meta Pixel and GA4 events: upload\_started, score\_shown, lead\_submitted, card\_downloaded, calculator\_used | Ad optimization and funnel tracking |

**How a request flows:** the browser uploads to the Next.js API route, which streams the file to the scoring service. The service parses and scores in memory and returns JSON. The file is discarded. Only the results JSON is saved, and only when the lead form is submitted.

**Separation from Beta:** separate repo, separate Railway project, no shared database or login. The only links are outbound: to betaapp.me pages, the webinar and the Managers Room.

**Domain:** managertest.betaapp.me (confirmed). The calculators live under the same address, for example managertest.betaapp.me/position-size, and the admin at /admin.

## Privacy, compliance and wording

The tool analyzes past results for education. It never advises, never promises admission to Beta, and never keeps the trader's statement.

### Privacy

- The statement is processed in memory and deleted right away. The upload page says so: "We don't store your statement."
- Stored: computed metrics, broker name, account size bucket. Never the account number, exact balance or individual trades.
- A privacy policy page and the consent checkbox cover contact by Beta. A cookie notice covers the Meta Pixel and retargeting.

### Wording rules

| Never say | Say instead |
| --- | --- |
| Eligible, qualified, approved, accepted | Ready, readiness |
| "You can join Beta" | "Here's how traders take the next step with Beta" |
| Any return %, profit figure or performance claim in marketing or share cards | Score and band only |
| "Buy", "sell", trade ideas, signals | Process advice only: risk, sizing, consistency |

The score is a self-check, not part of Beta's manager vetting. That keeps the "verified-not-endorsed" posture intact. Statements can't be verified for authenticity here; real vetting happens in Beta's own process.

### Disclaimer (draft, for counsel)

> The Manager Test analyzes past trading results for educational purposes only. It is not investment advice, does not predict future performance, and is not an assessment for admission to the Beta platform. Results depend entirely on the statement provided.

It appears on the results screen, on every PDF page and on the calculator pages.

### Before launch

- [ ] Counsel reviews the disclaimer, band names and follow-up email wording
- [ ] Privacy policy published
- [ ] **Blocker:** real export screenshots (desktop + mobile) replace the tutorial placeholders. No video clip in v1.
- [ ] Counsel review of coach-insight wording (instrument, session and direction named only to describe the trader's own past results)
- [ ] Copy for the sign-in email (placeholder in the code until supplied)
- [ ] Copy for the "sign-in link sent" state of the signed-out banner (placeholder: "Sign-in link sent. Check your email.")
- [ ] Copy for the account-deleted confirmation email (placeholder in the code until supplied)

## Build order and acceptance tests

Build the scoring engine first and make it pass the synthetic tests before any screen exists. Each screen gets an HTML reference and spec before Claude Code builds it, so nothing in the UI is improvised.

1. **Scoring engine** with synthetic test statements, reusing the league's synthetic cohort. This is the merge gate.
2. **Parsers** for MT5 XLSX and HTML, tested on at least 10 real statements from the waitlist and the team's circle.
3. **Upload flow and results screen.**
4. **Lead form, database and CRM push.**
5. **PDF report.**
6. **Share cards.**
7. **Calculators.**
8. **Follow-up emails and daily digest.**
9. **Counsel wording review, analytics events, launch.**

### Acceptance tests (must all pass)

- [ ] Disciplined trader (low drawdown, steady months, stops on every trade) scores 75 or more
- [ ] High-return gambler (+300%, martingale chains) scores 40 or less, with the martingale flag shown
- [ ] Blown account (drawdown ≥ 50%) scores 30 or less
- [ ] 2-month account gets "Not enough history" and a correct come-back date
- [ ] Demo account is labeled and its depth pillar is halved
- [ ] Same file uploaded twice gives the identical score
- [ ] Deposits and withdrawals don't change the return metrics
- [ ] MT4 file, empty report and non-report file each give a clear error
- [ ] No raw statement or account number is found anywhere in the database or logs
- [ ] Share card shows no money amounts or returns
- [ ] Share card shows no coach lines; the money-amount check passes on every shareable surface
- [ ] A 60+ lead appears in the next daily digest with a working WhatsApp link

## Launch and campaigns

No teasing: the tool launches when every acceptance test passes. It then runs as its own campaign, in parallel with the webinar campaign.

|  | Webinar campaign | Manager Test campaign |
| --- | --- | --- |
| Goal | Webinar registrations | Leads from the form (`lead_submitted`) |
| Hook | "From trading for friends to managing professionally" | "Are you ready to manage other people's money? Find out in 60 seconds." |
| Creatives | Webinar topic and speakers | Sample share cards, score reveals, one-stat insights |
| Retargeting | Registered but didn't attend | Scored but didn't fill the form |
| Tracking | Own UTM campaign | Own UTM campaign; cost per lead and drop-off rate |

**How they feed each other**

- Tool leads get the webinar invite in their follow-up (60+ and 40–59 bands).
- Webinar registrants get the tool link before the webinar: "Take the Manager Test first and bring your score."
- Both end in the same next steps: the Beta Managers Room and the manager application.

## Open items

**Decided**

- Free score comes before the form; drop-offs are tracked and retargeted.
- Step-by-step export tutorial for desktop and mobile above the upload box.
- Leads go into a CRM dedicated to this funnel, built into the tool.
- Domain is managertest.betaapp.me.
- WhatsApp follow-up stays manual, through the daily digest.
- No teasing; launch when ready.
- Two parallel campaigns: webinar and Manager Test.

**Still open**

- [x] **Thresholds:** CIO reviews every metric threshold and the red-flag rules before build step 1 closes.
- [x] **Subdomain:** managertest.betaapp.me confirmed.
- [x] **Advice texts:** drafted in Advice texts, approved.
- [ ] **Budget split** between the webinar and Manager Test campaigns.
- [ ] **Targets:** the numbers we aim for after launch (uploads per week, share of scorers who fill the form, cost per lead), so we can tell whether the tool is working.
