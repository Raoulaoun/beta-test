"""MT4 statements (Save as Report / Save as Detailed Report). Synthetic only until real files arrive."""

from datetime import date, datetime

import pytest

import synth
from manager_test import evaluate
from manager_test.parse import parse_statement

EVAL = date(2026, 11, 10)


@pytest.mark.parametrize("build", [synth.disciplined, synth.martingale_gambler, synth.blown], ids=["disciplined", "gambler", "blown"])
@pytest.mark.parametrize("detailed", [False, True], ids=["statement", "detailed"])
def test_mt4_scores_exactly_like_mt5(build, detailed):
    rep = build()
    mt5, mt4 = evaluate(synth.to_xlsx(rep), EVAL), evaluate(synth.to_mt4_html(rep, detailed=detailed), EVAL)
    assert mt4["account"]["platform"] == "MT4" and mt5["account"]["platform"] == "MT5"
    for key in ("score", "uncapped_score", "score_type"):
        assert mt4[key] == mt5[key], key
    assert [p["score"] for p in mt4["pillars"]] == [p["score"] for p in mt5["pillars"]]
    assert [f["code"] for f in mt4["red_flags"]] == [f["code"] for f in mt5["red_flags"]]


def test_mt4_header_cash_and_cancelled_orders():
    rep = synth.disciplined()
    rep.cash.append(synth.Cash(datetime(2026, 3, 2, 3), -2_000.0))
    stmt = parse_statement(synth.to_mt4_html(rep, cancelled_orders=3))
    assert stmt.platform == "MT4"
    assert stmt.broker == "Example Markets Ltd" and stmt.currency == "USD"
    assert stmt.account_masked == "•••567"
    assert stmt.report_time == datetime(2026, 11, 10, 12, 0)
    assert len(stmt.positions) == len(rep.trades)          # cancelled pending orders skipped
    flows = [e.amount for e in stmt.events if e.is_cash_flow]
    assert flows == [10_000.0, -2_000.0]


def test_mt4_open_trades_and_equity():
    start = datetime(2025, 6, 2, 10)
    trades = [synth.Trade("EURUSD", "buy", 0.5, start.replace(day=2 + i % 25, month=6 + i // 25), 1.1,
                          start.replace(day=2 + i % 25, month=6 + i // 25, hour=13), 1.102, 40.0, sl=1.09)
              for i in range(100)]
    rep = synth.Report(trades=trades, cash=[synth.Cash(datetime(2025, 6, 1), 10_000.0)],
                       open_positions=[synth.OpenPos("EURUSD", "buy", 2.0, datetime(2026, 10, 1, 10), 1.12, -3_500.0)])
    stmt = parse_statement(synth.to_mt4_html(rep))
    assert len(stmt.open_positions) == 1 and stmt.open_positions[0].floating_profit == -3_500.0
    assert stmt.equity == pytest.approx(14_000.0 - 3_500.0)
    r = evaluate(synth.to_mt4_html(rep), EVAL)
    assert "losses_held_open" in r["notes"]


def test_mt4_demo_detected_from_company_name():
    rep = synth.disciplined()
    rep.account_type = "demo"
    r = evaluate(synth.to_mt4_html(rep), EVAL)
    assert r["account"]["account_type"] == "demo"


def test_mt4_account_number_never_leaves_the_parser():
    rep = synth.disciplined()
    r = evaluate(synth.to_mt4_html(rep), EVAL)
    import json
    assert rep.account not in json.dumps(r)


def test_mt4_with_no_closed_trades_is_empty():
    from manager_test.errors import EmptyReport
    rep = synth.Report(trades=[], cash=[synth.Cash(datetime(2026, 1, 1), 1000.0)])
    with pytest.raises(EmptyReport):
        evaluate(synth.to_mt4_html(rep, cancelled_orders=0), EVAL)
