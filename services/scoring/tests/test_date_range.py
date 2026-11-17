"""Exports for a date range ("Last 2 weeks") start after the deposit. The money already in
the account goes back in as one opening cash flow, so the first trade is measured against
the real balance, not against zero."""

from datetime import date

import pytest

import synth
from manager_test import evaluate, metrics
from manager_test.parse import parse_statement

WRITERS = {"mt5-xlsx": synth.to_xlsx, "mt5-html": synth.to_html, "mt4": synth.to_mt4_html}


def cut_at_a_loss(rep):
    """Start the export at a losing trade, past the middle of the history."""
    trades = sorted(rep.trades, key=lambda t: t.open_time)
    loss = next(t for t in trades[len(trades) // 2:] if t.profit < 0)
    return synth.date_range_export(rep, loss.open_time)


@pytest.mark.parametrize("fmt", WRITERS)
def test_opening_balance_is_one_cash_flow(fmt):
    rep = cut_at_a_loss(synth.disciplined())
    stmt = parse_statement(WRITERS[fmt](rep))
    first = stmt.events[0]
    assert first.is_cash_flow and first.amount == pytest.approx(rep.opening, abs=0.01)
    assert rep.opening > 1000


@pytest.mark.parametrize("fmt", WRITERS)
def test_first_losing_trade_is_not_a_total_loss(fmt):
    full = metrics.compute(parse_statement(synth.to_xlsx(synth.disciplined())), date(2026, 11, 17))["values"]
    cut = metrics.compute(parse_statement(WRITERS[fmt](cut_at_a_loss(synth.disciplined()))), date(2026, 11, 17))["values"]
    # A window of the same history can't fall further than the whole history did.
    assert cut["max_drawdown"] <= full["max_drawdown"] + 1e-6
    result = evaluate(WRITERS[fmt](cut_at_a_loss(synth.disciplined())))
    assert not any("Drawdown over 50%" in str(f) for f in result["red_flags"])


def test_all_history_export_adds_nothing():
    rep = synth.disciplined()
    stmt = parse_statement(synth.to_xlsx(rep))
    assert sum(e.is_cash_flow for e in stmt.events) == len(rep.cash)


def test_without_the_fix_the_cut_would_read_as_blown():
    # Guard on the scenario itself: with no opening balance, the first row is a loss.
    rep = cut_at_a_loss(synth.disciplined())
    first = min(rep.trades, key=lambda t: t.close_time)
    assert first.profit < 0 and not rep.cash
