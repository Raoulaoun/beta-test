"""Scoring acceptance tests from docs/spec.md, plus the approved Phase 1 decisions."""

import json
import logging
import math
from datetime import date, datetime, timedelta

import pytest

import synth
from manager_test import evaluate
from manager_test.metrics import size_bucket
from manager_test.parse import parse_statement
from manager_test import metrics as metrics_mod

EVAL = date(2026, 11, 10)
FORMATS = {"xlsx": synth.to_xlsx, "html": synth.to_html}


def run(rep, fmt="xlsx", when=EVAL):
    return evaluate(FORMATS[fmt](rep), when)


def metric(result, key):
    for p in result["pillars"]:
        for m in p["metrics"]:
            if m["key"] == key:
                return m
    raise KeyError(key)


def pillar(result, key):
    return next(p for p in result["pillars"] if p["key"] == key)


def codes(result):
    return [f["code"] for f in result["red_flags"]]


# ---------- spec acceptance tests ----------

@pytest.mark.parametrize("fmt", FORMATS)
def test_disciplined_trader_scores_75_or_more(fmt):
    r = run(synth.disciplined(), fmt)
    assert r["status"] == "scored"
    assert r["score"] >= 75
    assert r["red_flags"] == []
    assert metric(r, "stop_usage")["value"] == 1.0


@pytest.mark.parametrize("fmt", FORMATS)
def test_martingale_gambler_scores_40_or_less_with_flag(fmt):
    rep = synth.martingale_gambler()
    deposited = sum(c.amount for c in rep.cash)
    final = deposited + sum(t.profit for t in rep.trades)
    assert final / deposited - 1 >= 3.0, "scenario must be a +300% record"
    r = run(rep, fmt)
    assert r["score"] <= 40
    assert "martingale" in codes(r)
    assert r["uncapped_score"] > 40, "the cap, not the metrics alone, should decide this one"


@pytest.mark.parametrize("fmt", FORMATS)
def test_blown_account_scores_30_or_less(fmt):
    r = run(synth.blown(), fmt)
    assert metric(r, "max_drawdown")["value"] >= 0.50
    assert r["score"] <= 30
    assert "blown_account" in codes(r)


@pytest.mark.parametrize("fmt", FORMATS)
def test_two_month_account_gets_not_enough_history(fmt):
    rep = synth.short_history()
    r = run(rep, fmt)
    assert r["status"] == "not_enough_history"
    assert r["score"] is None and r["pillars"] is None
    assert r["band"]["name"] == "Not enough history"
    first = min(t.open_time for t in rep.trades).date()
    assert first == date(2026, 9, 1)
    assert r["come_back_date"] == "2026-12-01"  # first trade + 3 months; 64 trades is enough


def test_come_back_date_when_too_few_trades():
    # 4 months but only ~20 trades: projected from the recent trade rate.
    start = datetime(2026, 6, 1, 10)
    trades = [synth.Trade("EURUSD", "buy", 0.5, start + timedelta(days=7 * i), 1.1,
                              start + timedelta(days=7 * i, hours=2), 1.102, 20.0, sl=1.09)
              for i in range(20)]
    rep = synth.Report(trades=trades, cash=[synth.Cash(start - timedelta(days=1), 10_000.0)])
    r = run(rep)
    assert r["status"] == "not_enough_history"
    last = rep.trades[-1].close_time
    recent = sum(1 for t in rep.trades if t.close_time > last - timedelta(days=30))
    rate = recent / 30
    expected = EVAL + timedelta(days=math.ceil(10 / rate))
    assert r["come_back_date"] == expected.isoformat()


@pytest.mark.parametrize("fmt", FORMATS)
def test_demo_account_is_labeled_and_depth_halved(fmt):
    live = run(synth.disciplined(), fmt)
    demo_rep = synth.disciplined()
    demo_rep.server = "Example-Demo"
    demo_rep.account_type = "demo"
    demo = run(demo_rep, fmt)
    assert demo["account"]["account_type"] == "demo"
    assert live["account"]["account_type"] == "live"
    assert pillar(demo, "depth")["score"] == pytest.approx(pillar(live, "depth")["score"] * 0.5, abs=0.01)
    assert demo["score"] < live["score"]


def test_demo_detected_from_server_name_alone():
    rep = synth.disciplined()
    rep.server = "Broker-Demo01"
    assert run(rep)["account"]["account_type"] == "demo"


@pytest.mark.parametrize("fmt", FORMATS)
def test_same_file_twice_gives_identical_result(fmt):
    data = FORMATS[fmt](synth.disciplined())
    assert json.dumps(evaluate(data, EVAL), sort_keys=True) == json.dumps(evaluate(data, EVAL), sort_keys=True)


def test_xlsx_and_html_give_the_same_result():
    rep = synth.disciplined()
    a, b = run(rep, "xlsx"), run(rep, "html")
    assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)


RETURN_METRICS = ["max_drawdown", "worst_day", "avg_loss", "return_to_drawdown", "sortino"]


def test_deposits_and_withdrawals_do_not_change_return_metrics():
    base = run(synth.disciplined())
    flows = [synth.Cash(datetime(2025, 9, 15, 3), 25_000.0),
             synth.Cash(datetime(2026, 2, 10, 3), -8_000.0),
             synth.Cash(datetime(2026, 7, 1, 3), 5_000.0)]
    moved = run(synth.disciplined(extra_cash=flows))
    for key in RETURN_METRICS:
        assert metric(moved, key)["value"] == pytest.approx(metric(base, key)["value"], rel=2e-3), key
    assert pillar(moved, "risk_adjusted")["score"] == pytest.approx(pillar(base, "risk_adjusted")["score"], abs=0.5)
    assert moved["history"]["closed_trades"] == base["history"]["closed_trades"]


def test_a_deposit_alone_is_not_a_return():
    rep = synth.disciplined()
    rep.cash.append(synth.Cash(datetime(2026, 3, 2, 3), 1_000_000.0))
    rep.cash.sort(key=lambda c: c.time)
    s = parse_statement(synth.to_xlsx(rep))
    m = metrics_mod.compute(s, EVAL)
    baseline = metrics_mod.compute(parse_statement(synth.to_xlsx(synth.disciplined())), EVAL)
    # The trades are unchanged, so a huge deposit must make every later return smaller,
    # never larger, and it must never show up as a gain.
    assert m["values"]["max_drawdown"] <= baseline["values"]["max_drawdown"] + 1e-9
    assert m["context"]["annualized_return"] < baseline["context"]["annualized_return"]


@pytest.mark.parametrize("data,code", [
    (synth.MT4_HTML, "mt4_file"),
    (synth.NOT_A_REPORT_TEXT, "not_a_report"),
    (synth.NOT_A_REPORT_PDF, "not_a_report"),
    (b"", "not_a_report"),
])
def test_bad_files_give_clear_errors(data, code):
    from manager_test.errors import StatementError
    with pytest.raises(StatementError) as exc:
        evaluate(data, EVAL)
    assert exc.value.code == code


def test_spreadsheet_that_is_not_a_report():
    from manager_test.errors import NotAReport
    with pytest.raises(NotAReport):
        evaluate(synth.spreadsheet_without_sections(), EVAL)


@pytest.mark.parametrize("fmt", FORMATS)
def test_empty_report(fmt):
    from manager_test.errors import EmptyReport
    rep = synth.Report(trades=[], cash=[synth.Cash(datetime(2026, 1, 1), 1000.0)])
    with pytest.raises(EmptyReport):
        evaluate(FORMATS[fmt](rep), EVAL)


def test_error_copy_matches_design():
    import re
    from pathlib import Path
    from manager_test.errors import EmptyReport, FileTooLarge, Mt4Statement, NotAReport
    flow = (Path(__file__).resolve().parents[3] / "design" / "flow" / "index.html").read_text(encoding="utf-8")
    for key, cls in [("mt4", Mt4Statement), ("empty", EmptyReport), ("notstatement", NotAReport),
                     ("toolarge", FileTooLarge)]:
        line = re.search(rf"^\s*{key}: \[(['\"])(.+?)\1, '(.+?)'\],$", flow, re.M)
        assert line, key
        assert (cls.message, cls.hint) == (line.group(2), line.group(3)), key


def test_file_over_10mb_rejected():
    from manager_test.errors import FileTooLarge
    with pytest.raises(FileTooLarge):
        evaluate(b"<html>" + b"x" * (10 * 1024 * 1024), EVAL)


# ---------- privacy ----------

@pytest.mark.parametrize("fmt", FORMATS)
def test_account_number_never_in_output_or_logs(fmt, caplog):
    rep = synth.disciplined()
    caplog.set_level(logging.DEBUG)
    r = run(rep, fmt)
    blob = json.dumps(r) + caplog.text
    assert rep.account not in blob
    assert rep.account[1:] not in blob  # no partial leak beyond the last 3 digits
    assert r["account"]["account_masked"] == "•••567"


def test_engine_writes_nothing_to_disk(tmp_path, monkeypatch):
    import builtins
    import io as _io
    real_open = builtins.open
    writes = []

    def guarded(file, mode="r", *a, **k):
        if any(c in mode for c in "wax+"):
            writes.append(file)
        return real_open(file, mode, *a, **k)

    data = synth.to_xlsx(synth.disciplined())
    monkeypatch.setattr(builtins, "open", guarded)
    monkeypatch.setattr(_io, "open", guarded)
    evaluate(data, EVAL)
    assert writes == []


# ---------- approved decisions ----------

def test_revenge_sizing_ignores_account_growth():
    # Fixed-fraction sizing grows lots as the account grows; that is not revenge.
    r = run(synth.disciplined())
    assert metric(r, "revenge_sizing")["value"] == pytest.approx(1.0, abs=0.05)


def test_revenge_sizing_catches_bigger_size_after_losses():
    r = run(synth.martingale_gambler())
    assert metric(r, "revenge_sizing")["value"] >= 2.0


@pytest.mark.parametrize("currency", ["USC", "USc"])
def test_cent_account_bucket_divides_by_100(currency):
    rep = synth.disciplined()
    rep.cash[0].amount = 300_000.0  # 3,000 dollars in cents
    rep.currency = currency
    r = run(rep)
    assert r["account"]["is_cent_account"] is True
    s = parse_statement(synth.to_xlsx(rep))
    final = metrics_mod.build_timeline(s).balances_after[-1]
    assert r["account"]["size_bucket"] == size_bucket(final / 100, cent=False)
    rep.currency = "USD"
    assert run(rep)["account"]["size_bucket"] == size_bucket(final, cent=False)


def _all_winners(open_positions):
    start = datetime(2025, 6, 2, 10)
    trades = [synth.Trade("EURUSD", "buy", 0.5, start + timedelta(days=3 * i), 1.1,
                          start + timedelta(days=3 * i, hours=3), 1.102, 40.0, sl=1.09)
              for i in range(150)]
    return synth.Report(trades=trades, cash=[synth.Cash(start - timedelta(days=1), 10_000.0)],
                        open_positions=open_positions)


def test_losses_held_open_blocks_automatic_full_marks():
    clean = run(_all_winners([]))
    assert clean["notes"] == []
    assert metric(clean, "profit_factor")["score"] == 100
    assert metric(clean, "hold_asymmetry")["score"] == 100

    held = run(_all_winners([synth.OpenPos("EURUSD", "buy", 2.0, datetime(2025, 8, 1, 10), 1.12, -4_000.0)]))
    assert held["notes"] == ["losses_held_open"]
    assert metric(held, "profit_factor")["score"] < 100
    assert metric(held, "hold_asymmetry")["score"] < 100


def test_evaluation_date_is_stored_and_drives_recency():
    rep = synth.disciplined()
    now = run(rep, when=EVAL)
    later = run(rep, when=EVAL + timedelta(days=200))
    assert now["evaluation_date"] == "2026-11-10"
    assert later["evaluation_date"] == "2027-05-29"
    assert metric(later, "days_since_last")["score"] == 0
    assert later["score"] < now["score"]


def test_crm_fields_present():
    r = run(synth.disciplined())
    acct, hist = r["account"], r["history"]
    assert acct["broker"] == "Example Markets Ltd"
    assert acct["size_bucket"] in {"under $1k", "$1k–10k", "$10k–50k", "over $50k"}
    assert acct["account_type"] in {"live", "demo"}
    assert hist["months"] > 17 and hist["closed_trades"] == len(synth.disciplined().trades)
    assert r["scoring_version"] and r["evaluation_date"]
    assert r["drawdown_basis"] == "closed_balance"


# ---------- open trades in floating loss at the end (scoring 1.1.0) ----------

def _winners_then_open_loss(floating_share: float, equity: float | None = None, fmt_open=True):
    start = datetime(2025, 6, 2, 10)
    trades = [synth.Trade("EURUSD", "buy", 0.5, start + timedelta(days=3 * i), 1.1,
                          start + timedelta(days=3 * i, hours=3), 1.102, 40.0, sl=1.09)
              for i in range(150)]
    final_balance = 10_000.0 + 40.0 * len(trades)
    opens = [synth.OpenPos("EURUSD", "buy", 2.0, datetime(2026, 10, 1, 10), 1.12, -final_balance * floating_share)] if fmt_open else []
    rep = synth.Report(trades=trades, cash=[synth.Cash(start - timedelta(days=1), 10_000.0)],
                       open_positions=opens, equity=equity)
    return rep, final_balance


@pytest.mark.parametrize("fmt", FORMATS)
def test_floating_loss_at_end_enters_drawdown_and_blocks_drawdown_praise(fmt):
    rep, _ = _winners_then_open_loss(0.25)
    r = run(rep, fmt)
    assert metric(r, "max_drawdown")["value"] == pytest.approx(0.25, abs=1e-6)
    assert r["drawdown_basis"] == "closed_balance_and_end_equity"
    assert "losses_held_open" in r["notes"]
    assert any(row["code"] == "losses_held_open" for row in r["red_flag_panel"]["rows"])
    from manager_test.insights import CLOSED_TRADE_ONLY
    assert r["headline"]["metric"] not in CLOSED_TRADE_ONLY
    if r["headline"]["kind"] == "strength":
        assert "drawdown" not in r["headline"]["text"].lower()


def test_same_record_without_open_loss_has_no_drawdown():
    rep, _ = _winners_then_open_loss(0.25, fmt_open=False)
    r = run(rep)
    assert metric(r, "max_drawdown")["value"] == 0
    assert r["notes"] == [] and r["drawdown_basis"] == "closed_balance"
    assert r["headline"]["metric"] == "max_drawdown"  # the praise the open loss must take away


def test_statement_equity_figure_wins_over_computed():
    # Equity includes things the open-position rows don't (e.g. credit), so the report's
    # own Equity: line is used when present.
    rep, final_balance = _winners_then_open_loss(0.25, equity=0.60 * (10_000.0 + 40.0 * 150))
    r = run(rep)
    assert metric(r, "max_drawdown")["value"] == pytest.approx(0.40, abs=1e-6)


def test_end_equity_point_moves_worst_day_and_return_but_not_sortino():
    clean, _ = _winners_then_open_loss(0.25, fmt_open=False)
    held, _ = _winners_then_open_loss(0.25)
    a, b = run(clean), run(held)
    assert metric(b, "worst_day")["value"] == pytest.approx(0.25, abs=1e-6)
    assert metric(b, "return_to_drawdown")["value"] < 10
    assert metric(a, "sortino")["value_is_unbounded"] == metric(b, "sortino")["value_is_unbounded"]
    assert metric(a, "sortino")["value"] == metric(b, "sortino")["value"]
    assert b["score"] < a["score"]


def test_open_trades_in_profit_change_nothing():
    rep, _ = _winners_then_open_loss(-0.10)  # negative share = floating profit
    r = run(rep)
    assert r["notes"] == [] and metric(r, "max_drawdown")["value"] == 0
