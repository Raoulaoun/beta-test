"""Under 3 months of history, Profitable months and Best month are "not enough data yet":
left out of Consistency (its other metrics reweighted), never the headline or a top fix."""

import synth
from manager_test import evaluate

MONTH = {"profitable_months", "best_month_share"}


def metrics_of(result):
    return {m["key"]: m for p in result["pillars"] for m in p["metrics"]}


def test_short_history_leaves_month_metrics_out():
    r = evaluate(synth.to_xlsx(synth.short_history()))
    ms = metrics_of(r)
    for k in MONTH:
        assert ms[k]["insufficient"] and ms[k]["display"] is None and ms[k]["points_lost"] == 0
    consistency = next(p for p in r["pillars"] if p["key"] == "consistency")
    used = [m for m in consistency["metrics"] if not m["insufficient"]]
    expected = sum(m["share"] * m["score"] for m in used) / sum(m["share"] for m in used)
    assert abs(consistency["score"] - round(expected, 2)) < 0.01


def test_short_history_headline_and_fixes_never_name_months():
    for rep in (synth.short_history(), synth.with_(synth.short_history(), trades=synth.short_history().trades[:35])):
        r = evaluate(synth.to_xlsx(rep))
        assert r["headline"]["metric"] not in MONTH
        assert not {f["metric"] for f in r.get("top_fixes", [])} & MONTH
        assert "months were profitable" not in r["headline"]["text"]


def test_long_history_unchanged():
    r = evaluate(synth.to_xlsx(synth.disciplined()))
    ms = metrics_of(r)
    for k in MONTH:
        assert not ms[k]["insufficient"] and ms[k]["display"] is not None


def test_trade_counts_use_thousand_separators():
    r = evaluate(synth.to_xlsx(synth.few_trades(1200, days_between=0)))
    assert r["score_type"] == "early"
    assert "based on 1,200 trades" in r["early"]["line"]
