"""Coach insights: one synthetic record per area, word-for-word copy, materiality,
ordering, and aggregates only. Records are built directly as parsed statements."""

import json
from datetime import datetime, timedelta

import pytest

from manager_test import coach as C
from manager_test import texts
from manager_test.engine import evaluate_statement
from manager_test.model import BalanceEvent, Position, Statement

COPY = texts.load()["coach"]
START = datetime(2026, 6, 1)  # a Monday


def pos(i, t, net, symbol="EURUSD", direction="buy", volume=1.0, sl=None, tp=None, open_price=100.0, hold=timedelta(hours=1)):
    """A closed trade whose price move matches its profit (money per price unit = 1 per lot)."""
    move = net / volume
    close = open_price + (move if direction == "buy" else -move)
    return Position(str(i), symbol, direction, volume, t, open_price, sl, t + hold, close, 0.0, 0.0, net, tp)


def stmt(positions, deposit=10_000.0):
    ps = sorted(positions, key=lambda p: p.open_time)
    events = [BalanceEvent(START - timedelta(days=1), deposit, True)]
    events += [BalanceEvent(p.close_time, p.net, False) for p in sorted(ps, key=lambda p: p.close_time)]
    return Statement("Broker", "Server-1", "USD", None, "real", None, positions=ps, events=events)


def weekday_at(day, hour):
    """Trading day `day` (0-based, weekdays only from START) at `hour` server time."""
    d = START
    n = 0
    while True:
        if d.weekday() < 5:
            if n == day:
                return d.replace(hour=hour)
            n += 1
        d += timedelta(days=1)


def find(result, area, polarity):
    return [f for f in result["findings"] if f["area"] == area and f["polarity"] == polarity]


# ---------- segment areas ----------

def test_day_of_week_costing_word_for_word():
    ps = []
    for d in range(60):
        t = weekday_at(d, 10)
        ps.append(pos(d, t, -80.0 if t.weekday() == 0 else (60.0 if d % 3 else -20.0)))
    r = C.coach(stmt(ps))
    [f] = find(r, "Day of week", "costing")
    assert f["segment"] == "Monday"
    share = f["share"]
    assert f["text"] == COPY["Day of week"]["costing"].replace("{segment}", "Monday").replace("{share}", f"{round(share * 100)}%")
    assert f["action"] == COPY["Day of week"]["action"].replace("{segment}", "Monday")
    assert f["trades"] == 12


def test_instrument_working_and_costing_with_pf_without():
    ps = []
    for i in range(30):
        t = START + timedelta(days=i, hours=9)
        ps.append(pos(i, t, 90.0 if i % 4 else -30.0, symbol="XAUUSD"))
        ps.append(pos(100 + i, t + timedelta(hours=2), -50.0 if i % 3 else 20.0, symbol="GBPJPY"))
    r = C.coach(stmt(ps))
    [w] = find(r, "Instrument", "working")
    [c] = find(r, "Instrument", "costing")
    assert w["segment"] == "XAUUSD" and c["segment"] == "GBPJPY"
    assert w["text"].startswith("XAUUSD carries your results: ") and w["text"].endswith(" of your profit.")
    assert c["pf_without"] is not None and c["pf_without"] > 1
    assert "Without it, your profit factor would be" in c["text"]
    assert c["action"] == "Pause GBPJPY or trade it at half size until you understand why it costs you."


def test_direction_labels_are_long_and_short():
    ps = [pos(i, START + timedelta(days=i, hours=9), 70.0 if i % 2 else -10.0, direction="buy") for i in range(20)]
    ps += [pos(50 + i, START + timedelta(days=i, hours=14), -40.0 if i % 2 else 5.0, direction="sell") for i in range(20)]
    r = C.coach(stmt(ps))
    assert find(r, "Direction", "working")[0]["text"] == "Your long trades are where your skill shows."
    assert find(r, "Direction", "costing")[0]["text"] == "Your short trades lose money overall."


def test_segment_under_ten_trades_is_never_reported():
    ps = [pos(i, START + timedelta(days=i, hours=9), 50.0 if i % 3 else -20.0) for i in range(40)]
    ps += [pos(100 + i, START + timedelta(days=i, hours=10), -200.0, symbol="USDJPY") for i in range(9)]
    r = C.coach(stmt(ps))
    assert not [f for f in r["findings"] if f["segment"] == "USDJPY"]


def test_immaterial_losing_segment_is_not_reported():
    # GBPUSD loses a little: <10% of gross losses, and removing it barely moves profit factor.
    ps = [pos(i, START + timedelta(days=i, hours=9), 100.0 if i % 2 else -90.0) for i in range(80)]
    ps += [pos(200 + i, START + timedelta(days=i, hours=11), -3.0 if i % 2 else 2.0, symbol="GBPUSD") for i in range(12)]
    r = C.coach(stmt(ps))
    assert not find(r, "Instrument", "costing")


def test_hour_label_names_server_time():
    ps = [pos(i, START + timedelta(days=i, hours=15), -60.0 if i % 4 else 10.0) for i in range(15)]
    ps += [pos(50 + i, START + timedelta(days=i, hours=9), 80.0) for i in range(30)]
    r = C.coach(stmt(ps))
    [c] = find(r, "Hour of day", "costing")
    assert c["segment"] == "15:00–18:00 broker server time (close to Beirut time)"
    assert c["text"] == f"Trades opened between {c['segment']} lost money overall."


def test_sessions_are_converted_from_server_time_to_utc():
    # Server 10:00 in June (UTC+3) is 07:00 UTC: London.
    assert C.session_of(datetime(2026, 6, 2, 10)) == "London"
    # Server 09:00 in January (UTC+2) is 07:00 UTC: London too.
    assert C.session_of(datetime(2026, 1, 6, 9)) == "London"
    assert C.session_of(datetime(2026, 6, 2, 9)) == "Asia"


# ---------- behaviour areas ----------

def test_after_a_loss_costing():
    ps, i, t = [], 0, START
    pattern = [-50, -50, -50, -50, 60, 60, 60, 60, 60, 60]  # after 2 losses in a row, mostly more losses
    for _ in range(8):
        for net in pattern:
            ps.append(pos(i, t, float(net)))
            i += 1
            t += timedelta(hours=5)
    r = C.coach(stmt(ps))
    [f] = find(r, "After a loss", "costing")
    assert f["text"].startswith("After 2 losses in a row, your win rate drops to ")
    assert f["action"] == "Stop for the session after 2 losses in a row."


def test_after_a_loss_steady_is_working():
    ps = [pos(i, START + timedelta(hours=5 * i), 50.0 if i % 2 else -40.0) for i in range(80)]
    ps = [p if int(p.position_id) % 5 else pos(int(p.position_id), p.open_time, -40.0) for p in ps]
    r = C.coach(stmt(ps))
    assert not find(r, "After a loss", "costing")


def test_exits_costing_when_winners_close_before_target():
    ps = []
    for i in range(20):
        # Target 100 price units away; half the winners close at 40.
        net = 40.0 if i % 2 else 100.0
        ps.append(pos(i, START + timedelta(days=i, hours=9), net, tp=200.0))
    ps += [pos(100 + i, START + timedelta(days=i, hours=13), -30.0) for i in range(10)]
    r = C.coach(stmt(ps))
    [f] = find(r, "Exits", "costing")
    assert f["text"] == "You close 50% of winners before your own target."


def test_fatigue_costing_with_ordinal():
    ps, i = [], 0
    for d in range(15):
        day = START + timedelta(days=d)
        for k, net in enumerate([80.0, 60.0, -70.0, -70.0]):
            ps.append(pos(i, day.replace(hour=8 + 2 * k), net))
            i += 1
    r = C.coach(stmt(ps))
    [f] = find(r, "Fatigue", "costing")
    assert f["text"] == "From your 3rd trade of the day, you lose money."
    assert f["action"] == "Set a limit of 2 trades per day."


def test_size_consistency_costing_from_stop_distance():
    ps = []
    for i in range(30):
        stop_dist = 10.0 if i % 3 else 60.0  # risk 0.1% vs 0.6% of a 10k balance
        net = 30.0 if i % 2 else -stop_dist
        ps.append(pos(i, START + timedelta(days=i, hours=9), net, sl=100.0 - stop_dist))
    r = C.coach(stmt(ps))
    [f] = find(r, "Size consistency", "costing")
    assert f["text"].startswith("Your risk per trade swings from ") and " to " in f["text"]
    assert f["data"]["stop"] == 30


def test_ordinal():
    assert [C.ordinal(n) for n in (1, 2, 3, 4, 11, 12, 13, 21, 22, 23)] == \
        ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd"]


# ---------- assembly ----------

def mixed():
    ps, i = [], 0
    for d in range(60):
        t = weekday_at(d, 9)
        for k in range(4):
            sym = ["XAUUSD", "EURUSD", "GBPJPY"][k % 3]
            net = {0: 70.0, 1: 20.0, 2: -45.0, 3: -60.0}[k] if t.weekday() else -90.0
            ps.append(pos(i, t + timedelta(hours=2 * k), net, symbol=sym, direction="buy" if i % 3 else "sell",
                          sl=100.0 - 40.0 * (1 + i % 4)))
            i += 1
    return stmt(ps)


def test_ordering_ranks_and_top():
    r = C.coach(mixed())
    costing = [f for f in r["findings"] if f["polarity"] == "costing"]
    working = [f for f in r["findings"] if f["polarity"] == "working"]
    assert costing, "the mixed record has costing findings"
    assert [f["rank"] for f in costing] == list(range(1, len(costing) + 1))
    assert [f["rank"] for f in working] == list(range(1, len(working) + 1))
    assert [f["impact"] for f in costing] == sorted([f["impact"] for f in costing], reverse=True)
    assert r["top"]["costing"] == costing[0]
    assert r["top"]["working"] == (working[0] if working else None)


def test_every_text_comes_from_the_approved_table():
    r = C.coach(mixed())
    for f in r["findings"]:
        assert f["area"] in COPY
        assert "{" not in f["text"] and (f["action"] is None or "{" not in f["action"])
        template = COPY[f["area"]][f["polarity"]]
        fixed = [part for part in template.replace("{n}th", "{n}").split("{") ]
        assert fixed[0].split("}")[-1] in f["text"]


def test_aggregates_only_and_deterministic():
    s = mixed()
    a, b = C.coach(s), C.coach(s)
    assert json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
    blob = json.dumps(a)
    assert "position_id" not in blob and "2026-" not in blob
    for f in a["findings"]:
        assert set(f) == {"area", "polarity", "segment", "trades", "share", "pf_without", "impact", "rank", "text", "action", "data"}
        assert all(not isinstance(v, (list, dict)) for v in f["data"].values()), "no per-trade lists"


def test_under_ten_trades_no_findings():
    ps = [pos(i, START + timedelta(days=i, hours=9), 50.0) for i in range(9)]
    assert C.coach(stmt(ps)) == {"findings": [], "top": {"working": None, "costing": None}}


def test_engine_attaches_coach_and_starter_has_none():
    full = evaluate_statement(mixed())
    assert full["coach"]["findings"] and full["scoring_version"] == "1.3.0"
    starter = evaluate_statement(stmt([pos(i, START + timedelta(days=i, hours=9), 50.0) for i in range(4)]))
    assert starter["score_type"] == "starter" and starter["coach"] is None


@pytest.mark.parametrize("area", C.AREAS)
def test_every_area_has_copy(area):
    assert set(COPY[area]) == {"working", "costing", "action"}
