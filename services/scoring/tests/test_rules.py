"""Unit tests for scoring math, red flags and the approved copy."""

import json
import re
from datetime import datetime, timedelta
from pathlib import Path

import pytest

import synth
from manager_test import evaluate, texts
from manager_test.flags import grid_positions, martingale_positions
from manager_test.model import Position
from manager_test.score import METRICS, PILLARS, band_for, metric_points, round_half_up

EVAL = synth.datetime(2026, 11, 10).date()
DOC = (Path(__file__).resolve().parents[3] / "docs" / "advice-texts.md").read_text(encoding="utf-8")


def pos(i, symbol="EURUSD", direction="buy", vol=0.1, open_h=0, close_h=1, price=1.1, net=10.0):
    base = datetime(2026, 1, 5)
    return Position(str(i), symbol, direction, vol, base + timedelta(hours=open_h), price, 1.0,
                    base + timedelta(hours=close_h), price, 0.0, 0.0, net)


def test_weights_add_up():
    assert sum(p.weight for p in PILLARS) == pytest.approx(1.0)
    for p in PILLARS:
        assert sum(m.share for m in METRICS if m.pillar == p.key) == pytest.approx(1.0), p.key


@pytest.mark.parametrize("key,value,expected", [
    ("max_drawdown", 0.10, 100), ("max_drawdown", 0.40, 0), ("max_drawdown", 0.25, 50),
    ("stop_usage", 0.90, 100), ("stop_usage", 0.60, 50), ("stop_usage", 0.10, 0),
    ("profit_factor", 1.4, 50), ("months_history", 24, 100), ("months_history", 3, 0),
    ("days_since_last", 105, 50), ("profit_factor", float("inf"), 100),
    ("hold_asymmetry", float("inf"), 0), ("top5_share", None, 0),
])
def test_linear_interpolation(key, value, expected):
    m = next(x for x in METRICS if x.key == key)
    assert metric_points(m, value) == pytest.approx(expected)


def test_bands_and_rounding():
    assert band_for(80)[1] == "Professional Grade"
    assert band_for(79)[1] == "Emerging Manager"
    assert band_for(40)[1] == "Building"
    assert band_for(39)[1] == "Developing"
    assert round_half_up(79.5) == 80 and round_half_up(79.49) == 79


def test_martingale_chain_needs_three_positions():
    two = [pos(0, net=-10, vol=0.1, open_h=0, close_h=1), pos(1, vol=0.2, open_h=2, close_h=3)]
    assert martingale_positions(two) == set()
    three = [pos(0, net=-10, vol=0.1, open_h=0, close_h=1),
             pos(1, net=-10, vol=0.2, open_h=2, close_h=3),
             pos(2, vol=0.4, open_h=4, close_h=5)]
    assert martingale_positions(three) == {0, 1, 2}


def test_bigger_size_after_a_win_is_not_martingale():
    ps = [pos(0, net=10, vol=0.1, open_h=0, close_h=1), pos(1, net=10, vol=0.2, open_h=2, close_h=3),
          pos(2, vol=0.4, open_h=4, close_h=5)]
    assert martingale_positions(ps) == set()


def test_grid_three_open_at_worsening_prices():
    ps = [pos(0, open_h=0, close_h=10, price=1.10), pos(1, open_h=1, close_h=10, price=1.09),
          pos(2, open_h=2, close_h=10, price=1.08)]
    assert grid_positions(ps) == {0, 1, 2}


def test_grid_needs_positions_open_together_and_worse_prices():
    sequential = [pos(0, open_h=0, close_h=1, price=1.10), pos(1, open_h=2, close_h=3, price=1.09),
                  pos(2, open_h=4, close_h=5, price=1.08)]
    assert grid_positions(sequential) == set()
    better = [pos(0, open_h=0, close_h=10, price=1.08), pos(1, open_h=1, close_h=10, price=1.09),
              pos(2, open_h=2, close_h=10, price=1.10)]
    assert grid_positions(better) == set()
    sells = [pos(0, direction="sell", open_h=0, close_h=10, price=1.08),
             pos(1, direction="sell", open_h=1, close_h=10, price=1.09),
             pos(2, direction="sell", open_h=2, close_h=10, price=1.10)]
    assert grid_positions(sells) == {0, 1, 2}


def test_grid_flag_end_to_end():
    rep = synth.disciplined()
    # Turn every 10th trading day into a 3-leg buy grid on EURUSD.
    extra = []
    for i, t in enumerate(rep.trades[::10]):
        for k in range(3):
            extra.append(synth.Trade("EURUSD", "buy", 0.5, t.open_time + timedelta(minutes=5 + k),
                                     1.10 - 0.002 * k, t.open_time + timedelta(hours=1), 1.101, 5.0, sl=1.05))
    rep.trades = sorted(rep.trades + extra, key=lambda t: t.open_time)
    r = evaluate(synth.to_xlsx(rep), EVAL)
    assert "grid" in [f["code"] for f in r["red_flags"]]
    assert r["score"] <= 40


# ---------- approved copy is used word for word ----------

def test_every_metric_has_advice_and_headline():
    t = texts.load()
    for m in METRICS:
        assert m.advice_name in t["advice"], m.advice_name
        a = t["advice"][m.advice_name]
        assert a["diagnosis"] and 2 <= len(a["actions"]) <= 3
        assert m.headline_name in t["headlines"], m.headline_name
    assert set(t["red_flags"]) == {"Martingale", "Grid", "Blown or near-blown account", "No stop losses"}


def _template_matches_doc(filled: str, template: str):
    pattern = re.escape(template).replace(re.escape("{value}"), ".+?")
    assert re.fullmatch(pattern, filled), filled


@pytest.mark.parametrize("rep", [synth.disciplined(), synth.martingale_gambler(), synth.blown()],
                         ids=["disciplined", "gambler", "blown"])
def test_output_copy_comes_from_the_doc(rep):
    r = evaluate(synth.to_xlsx(rep), EVAL)
    t = texts.load()
    for fix in r["top_fixes"]:
        a = t["advice"][fix["name"]]
        _template_matches_doc(fix["diagnosis"], a["diagnosis"])
        assert fix["actions"] == a["actions"]
        for action in fix["actions"]:
            assert action in DOC
    for f in r["red_flags"]:
        _template_matches_doc(f["text"], t["red_flags"][f["name"]])
    name = next(m.headline_name for m in METRICS if m.key == r["headline"]["metric"])
    _template_matches_doc(r["headline"]["text"], t["headlines"][name][r["headline"]["kind"]])


BANNED = re.compile(r"\b(eligible|qualified|approved|accepted)\b", re.I)


@pytest.mark.parametrize("rep", [synth.disciplined(), synth.martingale_gambler(), synth.blown(),
                                 synth.short_history()])
def test_no_banned_wording_in_output(rep):
    assert not BANNED.search(json.dumps(evaluate(synth.to_xlsx(rep), EVAL), ensure_ascii=False))


def test_no_llm_or_network_imports():
    src = "".join(p.read_text() for p in (Path(__file__).resolve().parents[1] / "manager_test").rglob("*.py"))
    for name in ("anthropic", "openai", "requests", "httpx", "urllib.request", "socket"):
        assert f"import {name}" not in src and f"from {name}" not in src, name
