"""Early score, starter read and the short-period nudge (scoring 1.2.0)."""

from datetime import date, datetime, timedelta

import pytest

import synth
from manager_test import evaluate
from manager_test.engine import period_label

EVAL = date(2026, 11, 10)
FORMATS = {"mt5-xlsx": synth.to_xlsx, "mt5-html": synth.to_html, "mt4": synth.to_mt4_html}


def run(rep, fmt="mt5-xlsx"):
    return evaluate(FORMATS[fmt](rep), EVAL)


@pytest.mark.parametrize("fmt", FORMATS)
def test_early_cap_holds_at_69_even_with_perfect_metrics(fmt):
    # 20 winning trades with stops over 2 weeks: every metric that can be perfect is,
    # and the uncapped score is far above 69.
    rep = synth.few_trades(20, start=datetime(2026, 10, 19, 9))
    r = run(rep, fmt)
    assert r["score_type"] == "early"
    assert r["uncapped_score"] > 69
    assert r["score"] == 69
    assert r["band"]["name"] == "Emerging Manager"


def test_early_score_still_takes_a_lower_red_flag_cap():
    rep = synth.few_trades(20, start=datetime(2026, 10, 19, 9), stops=False)
    big = [synth.Trade("EURUSD", "buy", v, datetime(2026, 11, 3, 9 + i), 1.1, datetime(2026, 11, 3, 9 + i, 30),
                       1.09, -100.0 * v) for i, v in enumerate([0.5, 1.0, 2.0, 4.0])]
    rep.trades = rep.trades + big
    r = run(rep)
    assert r["score_type"] == "early"
    assert r["score"] <= 40 and "martingale" in [f["code"] for f in r["red_flags"]]


@pytest.mark.parametrize("n,expected", [(4, "starter"), (5, "early"), (29, "early")])
def test_trade_count_boundaries(n, expected):
    r = run(synth.few_trades(n, days_between=4))
    assert r["score_type"] == expected


def test_thirty_trades_over_three_months_is_full_but_just_under_is_early():
    start = datetime(2026, 7, 1, 9)
    full = synth.few_trades(30, start=start, days_between=4)   # 1 Jul -> ~26 Oct
    assert run(full)["score_type"] == "full"
    short = synth.few_trades(30, start=datetime(2026, 8, 5, 9), days_between=3)  # under 3 months
    assert run(short)["score_type"] == "early"


@pytest.mark.parametrize("fmt", FORMATS)
def test_starter_read_has_no_score_or_band(fmt):
    rep = synth.few_trades(3, win=False, stops=False)
    rep.trades[0] = synth.Trade("EURUSD", "buy", 0.5, rep.trades[0].open_time, 1.1,
                                rep.trades[0].open_time + timedelta(minutes=20), 1.102, 30.0, sl=1.09)
    r = run(rep, fmt)
    assert r["score_type"] == "starter"
    assert r["score"] is None and r["band"] is None and r["pillars"] is None and r["red_flag_panel"] is None
    assert r["starter"]["heading"] == "Your starter read"
    assert r["starter"]["line"] == ("You have 3 closed trades so far. Here's what we can already see, "
                                    "and how to build a record investors trust.")
    keys = [m["key"] for m in r["starter"]["metrics"]]
    assert keys == ["stop_usage", "avg_loss", "hold_asymmetry"]
    stops = r["starter"]["metrics"][0]
    assert stops["kind"] == "advice" and stops["text"] == "Only 33% of your trades had a stop loss. An investor's first question is \"what happens if you're wrong?\", and a stop is the answer."
    assert len(stops["actions"]) == 3
    assert r["retest_default"] is True
    assert r["progress"][1] == {"key": "trades", "current": 3, "target": 30}


def test_starter_skips_what_cannot_be_measured_and_praises_what_is_perfect():
    r = run(synth.few_trades(2))  # two winners with stops: no losses to measure
    metrics = r["starter"]["metrics"]
    assert [m["key"] for m in metrics] == ["stop_usage"]
    assert metrics[0]["kind"] == "strength"
    assert metrics[0]["text"] == "100% of your trades had a stop loss. Investors notice that."


def test_nudge_when_the_file_covers_under_30_days():
    rep = synth.few_trades(8, start=datetime(2026, 10, 20, 9), report_time=datetime(2026, 11, 7, 12))
    r = run(rep)
    assert r["period"]["days"] == 19
    assert r["nudge"] == ("Your file only covers 2 weeks. Did you choose All History? "
                          "Export again for a more accurate score.")


def test_no_nudge_from_30_days():
    rep = synth.few_trades(8, start=datetime(2026, 10, 5, 9), report_time=datetime(2026, 11, 4, 12))
    r = run(rep)
    assert r["period"]["days"] >= 30 and r["nudge"] is None


def test_period_starts_at_the_first_deposit():
    rep = synth.few_trades(8, start=datetime(2026, 10, 20, 9), report_time=datetime(2026, 11, 7, 12))
    rep.cash[0].time = datetime(2026, 9, 1, 8)
    r = run(rep)
    assert r["period"]["start"].startswith("2026-09-01") and r["nudge"] is None


@pytest.mark.parametrize("days,label", [(1, "1 day"), (13, "13 days"), (14, "2 weeks"), (55, "7 weeks"),
                                        (56, "1 month"), (95, "3 months"), (400, "13 months")])
def test_period_labels(days, label):
    assert period_label(days) == label


def test_early_headline_does_not_restate_the_short_record():
    r = run(synth.short_history())
    assert r["score_type"] == "early"
    assert r["headline"]["metric"] not in {"months_history", "closed_trades"}
    full = run(synth.few_trades(30, start=datetime(2026, 7, 1, 9), days_between=4))
    assert full["score_type"] == "full"  # full scores keep the plain rule
