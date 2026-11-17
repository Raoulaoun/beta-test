"""Coach insights: what is working for the trader and what is costing them.

Ten areas, copy from docs/advice-texts.md ("Coach insights"), word for word. Every finding
is an aggregate over a segment of the trader's own past trades (never a single trade, never
a market view). Deterministic, versioned with SCORING_VERSION.

Times: broker server time is assumed to follow the New York close convention (server time =
New York time + 7 h, i.e. UTC+2 in winter, UTC+3 in summer). Sessions are defined in UTC;
hour blocks are shown in broker server time.
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import numpy as np

from . import texts
from .metrics import NORMAL_SIZE_BALANCE, build_timeline
from .model import Position, Statement

MIN_TRADES = 10                 # a segment needs at least 10 trades
LOSS_SHARE_MIN = 0.10           # costing: ≥10% of all gross losses …
PF_GAIN_MIN = 0.10              # … or profit factor without it improves by ≥0.1
PROFIT_SHARE_MIN = 0.10         # working: ≥10% of total profit (total profit positive)
STREAK_DROP = 0.15              # after a loss: win rate drops 15+ points
BIG_WIN_PCTL = 90               # after a big win: wins in the top 10%
BIG_WIN_WINDOW = 5              # … and the 5 trades after each
BIG_WIN_SIZE_UP = 1.3           # … size up 1.3× or more
BIG_WIN_GIVEBACK = 0.5          # … or give back 50% or more
EARLY_EXIT_SHARE = 0.40         # exits: 40%+ of winners closed before their own target
TARGET_TOLERANCE = 0.10         # a target counts as reached within 10% of its distance
FATIGUE_FROM = 3                # fatigue: from the 3rd trade of the day onwards
SIZE_SPREAD = 3.0               # size consistency: 90th percentile ≥ 3× 10th percentile

NY = ZoneInfo("America/New_York")
SERVER_OFFSET = timedelta(hours=7)
HOUR_LABEL = "broker server time (close to Beirut time)"
SESSIONS = [("Asia", 0, 7), ("London", 7, 12), ("London/New York overlap", 12, 16),
            ("New York", 16, 21), ("After hours", 21, 24)]
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
AREAS = ["Session", "Hour of day", "Day of week", "Instrument", "Direction",
         "After a loss", "After a big win", "Exits", "Fatigue", "Size consistency"]


@dataclass
class Finding:
    area: str
    polarity: str                      # working | costing
    segment: str | None
    trades: int
    impact: float                      # money involved ÷ all gross losses (ranking)
    share: float | None = None
    pf_without: float | None = None
    values: dict[str, str] = field(default_factory=dict)
    data: dict = field(default_factory=dict)
    copy_key: str | None = None        # coach-table row when an area has variants


# ---------- helpers ----------

def server_to_utc(t: datetime) -> datetime:
    return (t - SERVER_OFFSET).replace(tzinfo=NY).astimezone(timezone.utc)


def session_of(t: datetime) -> str:
    h = server_to_utc(t).hour
    return next(name for name, a, b in SESSIONS if a <= h < b)


def hour_block(t: datetime) -> str:
    a = (t.hour // 3) * 3
    return f"{a:02d}:00–{a + 3:02d}:00 {HOUR_LABEL}"


def profit_factor(nets) -> float:
    gp = sum(x for x in nets if x > 0)
    gl = -sum(x for x in nets if x < 0)
    if gl == 0:
        return math.inf if gp > 0 else 0.0
    return gp / gl


def pct0(v: float) -> str:
    return f"{v * 100:.0f}%"


def pct1(v: float) -> str:
    return f"{v * 100:.1f}%"


def pf_text(v: float) -> str:
    return "99+" if math.isinf(v) else f"{v:.2f}"


def ordinal(n: int) -> str:
    suffix = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


# ---------- segment areas ----------

def _segment_findings(area: str, positions: list[Position], key) -> list[Finding]:
    """Best and worst segment of an area. The copy is superlative ("your strongest day",
    "your most expensive day"), so each area reports at most one of each."""
    nets_all = [p.net for p in positions]
    total_net = sum(nets_all)
    total_gl = -sum(x for x in nets_all if x < 0)
    pf_all = profit_factor(nets_all)
    groups: dict[str, list[Position]] = defaultdict(list)
    for p in positions:
        groups[key(p)].append(p)
    sized = {seg: ps for seg, ps in groups.items() if len(ps) >= MIN_TRADES}
    seg_net = {seg: sum(p.net for p in ps) for seg, ps in sized.items()}
    # "{share} of your profit": against the profit of this area's winning segments (≤100%).
    winning_profit = sum(n for n in seg_net.values() if n > 0)
    costing, working = [], []
    for seg, ps in sized.items():
        net = seg_net[seg]
        if net < 0:
            gl = -sum(p.net for p in ps if p.net < 0)
            share = gl / total_gl if total_gl else 0.0
            ids = {id(p) for p in ps}
            pf_wo = profit_factor([p.net for p in positions if id(p) not in ids])
            gain = math.inf if math.isinf(pf_wo) else pf_wo - pf_all
            if share >= LOSS_SHARE_MIN or gain >= PF_GAIN_MIN:
                costing.append(Finding(area, "costing", seg, len(ps), impact=-net / total_gl if total_gl else 0.0,
                                       share=share, pf_without=pf_wo,
                                       values={"segment": seg, "share": pct0(share), "pf_without": pf_text(pf_wo)}))
        elif net > 0 and total_net > 0 and net / total_net >= PROFIT_SHARE_MIN:
            share = net / winning_profit
            working.append(Finding(area, "working", seg, len(ps), impact=share, share=share,
                                   values={"segment": seg, "share": pct0(share)}))
    out = []
    if costing:
        out.append(max(costing, key=lambda f: (f.impact, f.segment)))
    if working:
        out.append(max(working, key=lambda f: (f.impact, f.segment)))
    return out


# ---------- behaviour areas ----------

def _norm_sizes(positions: list[Position], stmt: Statement) -> list[float]:
    """Lots per $10k of balance at entry, relative to that symbol's median (1.0 = normal)."""
    tl = build_timeline(stmt)
    raw = []
    for p in positions:
        bal = tl.balance_before(p.open_time)
        raw.append(p.volume / (bal / NORMAL_SIZE_BALANCE) if bal > 0 else math.nan)
    by_sym: dict[str, list[float]] = defaultdict(list)
    for p, r in zip(positions, raw):
        if not math.isnan(r):
            by_sym[p.symbol].append(r)
    med = {k: float(np.median(v)) for k, v in by_sym.items()}
    return [r / med[p.symbol] if not math.isnan(r) and med.get(p.symbol) else math.nan for p, r in zip(positions, raw)]


def _after_loss(positions, total_gl, base_wr) -> list[Finding]:
    steady = None
    for k in (2, 3):
        sample = [p for i, p in enumerate(positions) if i >= k and all(q.net < 0 for q in positions[i - k:i])]
        if len(sample) < MIN_TRADES:
            break
        wr = sum(p.net > 0 for p in sample) / len(sample)
        if base_wr - wr >= STREAK_DROP:
            net = sum(p.net for p in sample)
            gl = -sum(p.net for p in sample if p.net < 0)
            impact = (-net if net < 0 else gl) / total_gl if total_gl else 0.0
            return [Finding("After a loss", "costing", None, len(sample), impact=impact,
                            values={"streak": str(k), "winrate": pct0(wr)},
                            data={"streak": k, "winrate": wr, "base_winrate": base_wr})]
        if steady is None:
            steady = (len(sample), wr)
    if steady is None:
        return []
    return [Finding("After a loss", "working", None, steady[0], impact=0.0, data={"winrate": steady[1], "base_winrate": base_wr})]


def _after_big_win(positions, sizes, total_gl) -> list[Finding]:
    wins = [p.net for p in positions if p.net > 0]
    if len(wins) < MIN_TRADES:
        return []
    cut = float(np.percentile(wins, BIG_WIN_PCTL))
    big = [i for i, p in enumerate(positions) if p.net > 0 and p.net >= cut]
    window, given_back, won = set(), 0.0, 0.0
    for i in big:
        idx = list(range(i + 1, min(i + 1 + BIG_WIN_WINDOW, len(positions))))
        window.update(idx)
        won += positions[i].net
        given_back += max(0.0, -sum(positions[j].net for j in idx))
    if len(window) < MIN_TRADES:
        return []
    ws = [sizes[j] for j in sorted(window) if not math.isnan(sizes[j])]
    change = float(np.mean(ws)) if ws else 1.0
    giveback = given_back / won if won else 0.0
    sized_up, gave_back = change >= BIG_WIN_SIZE_UP, giveback >= BIG_WIN_GIVEBACK
    if sized_up or gave_back:
        # Three approved variants: both, size-up only, give-back only.
        variant = "both" if sized_up and gave_back else ("size-up only" if sized_up else "give-back only")
        return [Finding("After a big win", "costing", None, len(window), impact=given_back / total_gl if total_gl else 0.0,
                        share=giveback, values={"change": f"{change:.1f}×", "share": pct0(giveback)},
                        data={"change": change, "giveback": giveback, "big_wins": len(big), "variant": variant},
                        copy_key=None if variant == "both" else f"After a big win: {variant}")]
    return [Finding("After a big win", "working", None, len(window), impact=0.0, data={"change": change, "giveback": giveback})]


def _exits(positions, total_gl) -> list[Finding]:
    sample = [p for p in positions if p.net > 0 and p.take_profit and p.take_profit != p.open_price]
    if len(sample) < MIN_TRADES:
        return []
    early, missed = 0, 0.0
    for p in sample:
        target = abs(p.take_profit - p.open_price)
        done = (p.close_price - p.open_price) * (1 if p.direction == "buy" else -1)
        if done < target * (1 - TARGET_TOLERANCE):
            early += 1
            if done > 0:
                missed += p.net * min(target / done - 1, 3.0)
    share = early / len(sample)
    if share >= EARLY_EXIT_SHARE:
        return [Finding("Exits", "costing", None, len(sample), impact=missed / total_gl if total_gl else 0.0,
                        share=share, values={"share": pct0(share)}, data={"early": early})]
    return [Finding("Exits", "working", None, len(sample), impact=0.0, share=share)]


def _fatigue(positions, total_gl) -> list[Finding]:
    order: dict[int, int] = {}
    by_day: dict = defaultdict(list)
    for i, p in enumerate(positions):
        by_day[p.open_time.date()].append(i)
    for idx in by_day.values():
        for k, i in enumerate(idx, start=1):
            order[i] = k
    top = max(order.values(), default=0)
    base = [i for i, k in order.items() if k >= FATIGUE_FROM]
    if len(base) < MIN_TRADES:
        return []
    for n in range(FATIGUE_FROM, top + 1):
        tail = [positions[i] for i, k in order.items() if k >= n]
        if len(tail) < MIN_TRADES:
            break
        net = sum(p.net for p in tail)
        if net < 0:
            return [Finding("Fatigue", "costing", None, len(tail), impact=-net / total_gl if total_gl else 0.0,
                            values={"n_ordinal": ordinal(n), "n_minus_1": str(n - 1)}, data={"n": n})]
    return [Finding("Fatigue", "working", None, len(base), impact=0.0)]


def _size_consistency(positions, stmt, total_gl) -> list[Finding]:
    """Risk per trade as % of balance at entry: stop distance × size where a stop exists
    (money per price unit estimated per symbol from the trader's own closed trades), loss
    size for trades without a stop."""
    tl = build_timeline(stmt)
    k_by_sym: dict[str, list[float]] = defaultdict(list)
    for p in positions:
        move = (p.close_price - p.open_price) * (1 if p.direction == "buy" else -1)
        if p.volume > 0 and abs(move) > 0 and p.profit:
            k = p.profit / (move * p.volume)
            if k > 0:
                k_by_sym[p.symbol].append(k)
    money_per_unit = {s: float(np.median(v)) for s, v in k_by_sym.items() if len(v) >= 3}
    pairs, source = [], {"stop": 0, "loss": 0}
    for p in positions:
        k = money_per_unit.get(p.symbol)
        if p.has_stop and k:
            bal = tl.balance_before(p.open_time)
            if bal > 0:
                pairs.append((abs(p.open_price - p.stop_loss) * p.volume * k / bal, p))
                source["stop"] += 1
        elif p.net < 0:
            bal = tl.balance_before(p.close_time)
            if bal > 0:
                pairs.append((-p.net / bal, p))
                source["loss"] += 1
    pairs = [(r, p) for r, p in pairs if r > 0]
    if len(pairs) < MIN_TRADES:
        return []
    risks = [r for r, _ in pairs]
    lo, hi = float(np.percentile(risks, 10)), float(np.percentile(risks, 90))
    data = {"p10": lo, "p90": hi, **source}
    if lo > 0 and hi / lo >= SIZE_SPREAD:
        # Money lost on the riskiest 10% of trades, as a share of all gross losses.
        lost = -sum(p.net for r, p in pairs if r >= hi and p.net < 0)
        return [Finding("Size consistency", "costing", None, len(pairs), impact=lost / total_gl if total_gl else 0.0,
                        values={"min": pct1(lo), "max": pct1(hi)}, data=data)]
    return [Finding("Size consistency", "working", None, len(pairs), impact=0.0, data=data)]


# ---------- assembly ----------

def _fill(template: str, values: dict[str, str]) -> str:
    for k, v in values.items():
        template = template.replace("{" + k + "}", v)
    return template


def analyse(stmt: Statement) -> list[Finding]:
    positions = sorted(stmt.positions, key=lambda p: (p.open_time, p.close_time, p.position_id))
    if len(positions) < MIN_TRADES:
        return []
    nets = [p.net for p in positions]
    total_gl = -sum(x for x in nets if x < 0)
    base_wr = sum(x > 0 for x in nets) / len(nets)
    found: list[Finding] = []
    found += _segment_findings("Session", positions, lambda p: session_of(p.open_time))
    found += _segment_findings("Hour of day", positions, lambda p: hour_block(p.open_time))
    found += _segment_findings("Day of week", positions, lambda p: WEEKDAYS[p.open_time.weekday()])
    found += _segment_findings("Instrument", positions, lambda p: p.symbol.upper())
    found += _segment_findings("Direction", positions, lambda p: "long" if p.direction == "buy" else "short")
    found += _after_loss(positions, total_gl, base_wr)
    found += _after_big_win(positions, _norm_sizes(positions, stmt), total_gl)
    found += _exits(positions, total_gl)
    found += _fatigue(positions, total_gl)
    found += _size_consistency(positions, stmt, total_gl)
    return found


def coach(stmt: Statement) -> dict:
    copy = texts.load()["coach"]
    findings = analyse(stmt)
    area_rank = {a: i for i, a in enumerate(AREAS)}
    costing = sorted([f for f in findings if f.polarity == "costing"], key=lambda f: (-f.impact, area_rank[f.area], f.segment or ""))
    # Segment strengths (with a share of profit) first, then steady behaviours in table order.
    working = sorted([f for f in findings if f.polarity == "working"],
                     key=lambda f: (f.share is None or f.area in ("Exits",), -(f.impact or 0), area_rank[f.area], f.segment or ""))

    def view(f: Finding, rank: int) -> dict:
        c = copy[f.copy_key or f.area]
        out = {
            "area": f.area, "polarity": f.polarity, "segment": f.segment, "trades": f.trades,
            "share": None if f.share is None else round(f.share, 4),
            "pf_without": None if f.pf_without is None or math.isinf(f.pf_without) else round(f.pf_without, 4),
            "impact": round(f.impact, 4), "rank": rank,
            "text": _fill(c[f.polarity], f.values),
            "action": _fill(c["action"], f.values) if f.polarity == "costing" else None,
            "data": {k: (round(v, 4) if isinstance(v, float) else v) for k, v in f.data.items()},
        }
        return out

    all_views = [view(f, i + 1) for i, f in enumerate(working)] + [view(f, i + 1) for i, f in enumerate(costing)]
    return {
        "findings": all_views,
        "top": {"working": next((v for v in all_views if v["polarity"] == "working"), None),
                "costing": next((v for v in all_views if v["polarity"] == "costing"), None)},
    }
