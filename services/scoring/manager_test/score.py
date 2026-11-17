"""Fixed-scale scoring: metric points, pillars, red-flag caps and bands (spec.md)."""

import math
from dataclasses import dataclass
from typing import Callable


def _pct0(v: float) -> str:
    return f"{v * 100:.0f}%"


def _pct1(v: float) -> str:
    return f"{v * 100:.1f}%"


def _times(v: float) -> str:
    return f"{v:.1f}×"


def _num1(v: float) -> str:
    return f"{v:.1f}"


def _num2(v: float) -> str:
    return f"{v:.2f}"


def _int(v: float) -> str:
    return f"{int(v)}"


@dataclass(frozen=True)
class MetricDef:
    key: str
    pillar: str
    share: float
    full: float
    zero: float
    advice_name: str      # heading in docs/advice-texts.md, metric advice
    headline_name: str    # row in docs/advice-texts.md, headline table
    fmt: Callable[[float], str]


@dataclass(frozen=True)
class PillarDef:
    key: str
    name: str
    weight: float


PILLARS = [
    PillarDef("risk_control", "Risk control", 0.25),
    PillarDef("discipline", "Discipline", 0.20),
    PillarDef("consistency", "Consistency", 0.20),
    PillarDef("risk_adjusted", "Risk-adjusted return", 0.20),
    PillarDef("depth", "Track record depth", 0.15),
]

# Order matters: it breaks ties in the headline and top-3 fixes.
METRICS = [
    MetricDef("max_drawdown", "risk_control", 0.40, 0.10, 0.40, "Max drawdown", "Max drawdown", _pct1),
    MetricDef("worst_day", "risk_control", 0.20, 0.03, 0.15, "Worst day", "Worst day", _pct1),
    MetricDef("avg_loss", "risk_control", 0.20, 0.01, 0.05, "Average loss per trade", "Average loss", _pct1),
    MetricDef("stop_usage", "risk_control", 0.20, 0.90, 0.30, "Stop loss usage", "Stop loss usage", _pct0),
    MetricDef("revenge_sizing", "discipline", 0.30, 1.1, 2.0, "Revenge sizing", "Revenge sizing", _times),
    MetricDef("adding_to_losers", "discipline", 0.30, 0.0, 0.20, "Adding to losers", "Adding to losers", _pct0),
    MetricDef("hold_asymmetry", "discipline", 0.20, 1.0, 3.0, "Holding losers", "Holding losers", _times),
    MetricDef("overtrading", "discipline", 0.20, 0.05, 0.25, "Overtrading", "Overtrading", _pct0),
    MetricDef("profitable_months", "consistency", 0.40, 0.75, 0.35, "Profitable months", "Profitable months", _pct0),
    MetricDef("top5_share", "consistency", 0.40, 0.30, 1.00, "Profit from a few trades", "Profit from a few trades", _pct0),
    MetricDef("best_month_share", "consistency", 0.20, 0.25, 0.70, "Best month", "Best month", _pct0),
    MetricDef("return_to_drawdown", "risk_adjusted", 0.40, 2.0, 0.0, "Return compared with drawdown", "Return compared with drawdown", _num1),
    MetricDef("sortino", "risk_adjusted", 0.30, 2.0, 0.0, "Sortino ratio", "Sortino ratio", _num2),
    MetricDef("profit_factor", "risk_adjusted", 0.30, 1.8, 1.0, "Profit factor", "Profit factor", _num2),
    MetricDef("months_history", "depth", 0.50, 24, 3, "Months of history", "Months of history", _int),
    MetricDef("closed_trades", "depth", 0.30, 300, 30, "Number of trades", "Number of trades", _int),
    MetricDef("days_since_last", "depth", 0.20, 30, 180, "Recent activity", "Recent activity", _int),
]

PILLAR_WEIGHT = {p.key: p.weight for p in PILLARS}
DEMO_DEPTH_FACTOR = 0.5

BANDS = [
    (80, "professional_grade", "Professional Grade", "Your record looks like a manager's"),
    (60, "emerging_manager", "Emerging Manager", "Close, with a few things to fix"),
    (40, "building", "Building", "Promising, with clear gaps"),
    (0, "developing", "Developing", "Trading for yourself, not yet for others"),
]


def metric_points(m: MetricDef, value: float | None) -> float:
    """0–100 by linear interpolation between the zero point and full marks."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return 0.0
    if math.isinf(value):
        good = (value > 0) == (m.full > m.zero)
        return 100.0 if good else 0.0
    t = (value - m.zero) / (m.full - m.zero)
    return max(0.0, min(1.0, t)) * 100.0


def display(m: MetricDef, value: float | None) -> str | None:
    if value is None:
        return None
    if math.isinf(value):
        return "99+" if value > 0 else "0"
    return m.fmt(value)


def round_half_up(x: float) -> int:
    return int(math.floor(x + 0.5))


def band_for(score: int) -> tuple[str, str, str]:
    for floor, code, name, meaning in BANDS:
        if score >= floor:
            return code, name, meaning
    return BANDS[-1][1:]


def score_metrics(values: dict, is_demo: bool) -> dict:
    metrics = []
    for m in METRICS:
        v = values[m.key]
        pts = metric_points(m, v)
        metrics.append({
            "key": m.key,
            "pillar": m.pillar,
            "share": m.share,
            "value": None if v is None else (None if math.isinf(v) else round(v, 6)),
            "value_is_unbounded": v is not None and math.isinf(v),
            "display": display(m, v),
            "full_marks_at": m.full,
            "zero_at": m.zero,
            "score": round(pts, 2),
            # Points this metric costs the overall score (weight x gap to full marks).
            "points_lost": round(PILLAR_WEIGHT[m.pillar] * m.share * (100.0 - pts), 4),
        })

    pillars, raw = [], 0.0
    for p in PILLARS:
        ms = [x for x in metrics if x["pillar"] == p.key]
        s = sum(x["share"] * x["score"] for x in ms)
        if p.key == "depth" and is_demo:
            s *= DEMO_DEPTH_FACTOR
        raw += p.weight * s
        pillars.append({"key": p.key, "name": p.name, "weight": p.weight, "score": round(s, 2),
                        "metrics": ms})
    return {"pillars": pillars, "raw_score": raw}
