# Approved designs

Extracted from the published Claude Design board ("Manager Test Board"). Each folder is a
standalone, runnable copy of one design page with its fonts, images and scripts. The
screenshots are the 36 frames of the board, rendered at the width the board shows them.

These are the source of truth for every screen. Match them exactly. A screen or state that
isn't listed here hasn't been designed yet: ask before building it.

## How to view

The pages pick their state from URL parameters, so open them through a local server:

```bash
cd design && python3 -m http.server 8765
```

Then open, for example, `http://127.0.0.1:8765/flow/index.html?screen=results&flags=warn`.

## Pages and states

| Folder | Parameters | States |
| --- | --- | --- |
| `flow/` | `screen` = `landing`, `analyzing`, `error`, `results`, `short`, `sent` | The public tool: landing with upload and export tutorial, analyzing, errors, results with lead form, not enough history, confirmation with share card |
| | `err` = `mt4`, `empty`, `notstatement`, `toolarge` | Error variants (with `screen=error`) |
| | `flags` = `none`, `warn` | Results with no red flags, or with the martingale warning |
| | `tab=mobile` | Export tutorial on its "On mobile" tab |
| | `step` = `0`–`3` | Analyzing progress |
| | `form=errors` | Lead form validation errors |
| | `exit=1` | Exit prompt open |
| `pdf-report/` | none | Full PDF report, all pages |
| `calculators/` | `calc` = `position`, `ruin`, `drawdown`, `compound`, `rr` | The five calculators |
| `admin/` | `view` = `leads`, `detail`, `pipeline`, `funnel`, `drops` | Funnel CRM |
| `emails/report-email/` | none | Report delivery email |
| `emails/digest-email/` | none | Daily digest email (admin) |
| `share-card/component.html` | `format` = `story`, `post`; `name` | Share card source. Rendered inside `flow/` on the `sent` screen; it does not run on its own |

## Board frames

| Screenshot | Page and parameters | Width |
| --- | --- | --- |
| 01-landing-mobile | `flow/?screen=landing` | 390 |
| 02-landing-mobile-export-tab | `flow/?screen=landing&tab=mobile` | 390 |
| 03-landing-desktop | `flow/?screen=landing` | 1440 |
| 04-analyzing-mobile | `flow/?screen=analyzing&step=1` | 390 |
| 05-analyzing-desktop | `flow/?screen=analyzing&step=1` | 1440 |
| 06-error-mt4-mobile | `flow/?screen=error&err=mt4` | 390 |
| 07-error-mt4-desktop | `flow/?screen=error&err=mt4` | 1440 |
| 08-error-empty-mobile | `flow/?screen=error&err=empty` | 390 |
| 09-error-not-statement-mobile | `flow/?screen=error&err=notstatement` | 390 |
| 10-error-too-large-mobile | `flow/?screen=error&err=toolarge` | 390 |
| 11-results-mobile | `flow/?screen=results&flags=none` | 390 |
| 12-results-desktop | `flow/?screen=results&flags=none` | 1440 |
| 13-results-warn-mobile | `flow/?screen=results&flags=warn` | 390 |
| 14-results-warn-desktop | `flow/?screen=results&flags=warn` | 1440 |
| 15-form-errors-mobile | `flow/?screen=results&form=errors` | 390 |
| 16-exit-prompt-mobile | `flow/?screen=results&exit=1` (viewport 844 high) | 390 |
| 17-exit-prompt-desktop | `flow/?screen=results&exit=1` (viewport 900 high) | 1440 |
| 18-not-enough-history-mobile | `flow/?screen=short` | 390 |
| 19-not-enough-history-desktop | `flow/?screen=short` | 1440 |
| 20-sent-mobile | `flow/?screen=sent` | 390 |
| 21-sent-desktop | `flow/?screen=sent` | 1440 |
| 22-pdf-report | `pdf-report/` | 1000 |
| 23–29 calculators | `calculators/?calc=…` | 390 / 1440 |
| 30–34 admin | `admin/?view=…` | 1440 |
| 35-email-report | `emails/report-email/` | 660 |
| 36-email-digest | `emails/digest-email/` | 660 |

## Known gaps in the export

- `share-card/component.html` links `styles.css` and `assets/beta-mark-light.png`, which
  were not in the published bundle. The card still renders on the `sent` screen; only the
  small logo mark on the card is affected.
- The Claude Design badge was removed from the pages. It is editor chrome, not product UI.

## Regenerating

The extraction tools are in `tools/design/`: `unbundle.py` unpacks a bundled page,
`standalone.py` turns an unpacked page into a runnable folder, and `shoot.js` with
`frames.json` renders the screenshots.
