"""Print the per-pillar and per-metric breakdown for each synthetic trader."""

import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(HERE), str(HERE / "tests")]
import synth  # noqa: E402
from manager_test import evaluate  # noqa: E402

EVAL = date(2026, 11, 10)


def demo():
    r = synth.disciplined()
    r.server, r.account_type = "Example-Demo", "demo"
    return r


SCENARIOS = [
    ("Disciplined trader", synth.disciplined),
    ("Disciplined trader, demo", demo),
    ("Martingale gambler (+300%)", synth.martingale_gambler),
    ("Blown account", synth.blown),
    ("2-month account (early score)", synth.short_history),
    ("3 trades (starter read)", lambda: synth.few_trades(3, win=False, stops=False)),
]

for title, build in SCENARIOS:
    r = evaluate(synth.to_xlsx(build()), EVAL)
    print(f"\n### {title}")
    if r["score_type"] == "starter":
        print(f'Starter read ({r["history"]["closed_trades"]} trades): {[m["key"] for m in r["starter"]["metrics"]]}')
        continue
    if r["score_type"] == "early":
        print(f'{r["early"]["line"]}')
    flags = ", ".join(f["code"] for f in r["red_flags"]) or "none"
    print(f'Score {r["score"]} (uncapped {r["uncapped_score"]}), {r["band"]["name"]}, '
          f'{r["account"]["account_type"]}, red flags: {flags}')
    print(f'Headline: {r["headline"]["text"]}')
    print(f'Top fixes: {", ".join(f["name"] for f in r["top_fixes"]) or "none"}\n')
    print("| Pillar | Metric | Value | Full at | Zero at | Points |")
    print("|---|---|---|---|---|---|")
    for p in r["pillars"]:
        print(f'| **{p["name"]}** ({p["weight"]:.0%}) | | | | | **{p["score"]:.1f}** |')
        for m in p["metrics"]:
            print(f'| | {m["key"]} | {m["display"]} | {m["full_marks_at"]} | {m["zero_at"]} | {m["score"]:.1f} |')
