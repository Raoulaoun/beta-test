"""evaluate(): uploaded bytes in, result JSON out. Pure and deterministic.

The same file with the same evaluation date always returns the same result.
Nothing is written to disk, a database or logs here.

Three outcomes (score_type):
  full     3+ months and 30+ closed trades: the full score.
  early    5+ closed trades, below the full threshold: scored the same way, capped at 69.
  starter  under 5 closed trades: no score or band, only what can already be measured.
"""

import math
from datetime import date, datetime, timezone

from . import flags as flag_rules
from . import insights, metrics, texts
from .parse import parse_statement
from .score import BANDS, METRICS, band_for, display, metric_points, round_half_up, score_metrics
from .version import SCORING_VERSION

MIN_MONTHS = 3
MIN_TRADES = 30
MIN_EARLY_TRADES = 5
EARLY_CAP = 69
SHORT_PERIOD_DAYS = 30
STARTER_METRICS = ["stop_usage", "avg_loss", "hold_asymmetry"]

_DEFS = {m.key: m for m in METRICS}


def _is_demo(stmt) -> bool:
    names = " ".join(filter(None, [stmt.server, stmt.broker])).lower()
    return "demo" in names or stmt.account_type_field == "demo"


def statement_period(stmt, last_trade: datetime) -> tuple[datetime, datetime]:
    """The statement's own period if it states one (MT4), else first event to report date."""
    if stmt.period:
        return stmt.period
    starts = [p.open_time for p in stmt.positions] + [e.time for e in stmt.events]
    start = min(starts)
    ends = [t for t in [stmt.report_time] if t and t >= start]
    end = ends[0] if ends else max([last_trade] + [e.time for e in stmt.events])
    return start, end


def period_label(days: int) -> str:
    """Days under 14, weeks under 8, otherwise months."""
    def plural(n, one, many):
        return f"{n} {one if n == 1 else many}"
    if days < 14:
        return plural(days, "day", "days")
    if days < 56:
        return plural(days // 7, "week", "weeks")
    return plural(max(1, int(days / 30.4375)), "month", "months")


def _starter_metrics(values: dict) -> list[dict]:
    t = texts.load()
    out = []
    for key in STARTER_METRICS:
        v = values[key]
        computable = {
            "stop_usage": True,
            "avg_loss": v > 0,                                   # needs a losing trade
            "hold_asymmetry": v is not None and 0 < v < math.inf,  # needs winners and losers
        }[key]
        if not computable:
            continue
        d = _DEFS[key]
        shown = display(d, v)
        pts = metric_points(d, v)
        item = {"key": key, "name": d.advice_name, "value": round(v, 6), "display": shown, "score": round(pts, 2)}
        if pts >= 100:
            item.update(kind="strength",
                        text=t["headlines"][d.headline_name]["strength"].replace("{value}", shown))
        else:
            a = t["advice"][d.advice_name]
            item.update(kind="advice", text=a["diagnosis"].replace("{value}", shown), actions=list(a["actions"]))
        out.append(item)
    return out


def evaluate(data: bytes, evaluation_date: date | None = None) -> dict:
    evaluation_date = evaluation_date or datetime.now(timezone.utc).date()
    stmt = parse_statement(data)
    demo = _is_demo(stmt)
    m = metrics.compute(stmt, evaluation_date)
    ctx = m["context"]

    result: dict = {
        "scoring_version": SCORING_VERSION,
        "evaluation_date": evaluation_date.isoformat(),
        "account": {
            "broker": stmt.broker,
            "server": stmt.server,
            "currency": stmt.currency,
            "account_masked": stmt.account_masked,
            "account_type": "demo" if demo else "live",
            "is_cent_account": ctx["is_cent"],
            "size_bucket": ctx["size_bucket"],
        },
        "history": {
            "months": round(m["values"]["months_history"], 2),
            "closed_trades": ctx["trade_count"],
            "first_trade": ctx["first_trade"].isoformat(),
            "last_trade": ctx["last_trade"].isoformat(),
        },
        "drawdown_basis": "closed_balance_and_end_equity" if ctx["losses_held_open"] else "closed_balance",
        "notes": ["losses_held_open"] if ctx["losses_held_open"] else [],
    }
    result["account"]["platform"] = stmt.platform

    copy = texts.load()["copy"]
    start, end = statement_period(stmt, ctx["last_trade"])
    days = max(1, (end.date() - start.date()).days)
    label = period_label(days)
    result["period"] = {"start": start.isoformat(), "end": end.isoformat(), "days": days, "label": label}
    result["nudge"] = (copy["Short-period nudge"].replace("{period}", label)
                       if days < SHORT_PERIOD_DAYS else None)

    trades = ctx["trade_count"]
    full = (metrics.add_months(ctx["first_trade"].date(), MIN_MONTHS) <= ctx["last_trade"].date()
            and trades >= MIN_TRADES)
    score_type = "full" if full else ("early" if trades >= MIN_EARLY_TRADES else "starter")
    result["score_type"] = score_type
    result["status"] = score_type
    result["retest_default"] = score_type != "full"
    months_done = min(math.floor(m["values"]["months_history"]), MIN_MONTHS)
    result["progress"] = None if full else [
        {"key": "months", "current": months_done, "target": MIN_MONTHS},
        {"key": "trades", "current": min(trades, MIN_TRADES), "target": MIN_TRADES},
    ]

    if score_type == "starter":
        result.update({
            "score": None, "band": None, "pillars": None, "red_flags": [], "red_flag_panel": None,
            "headline": None, "top_fixes": [], "early": None,
            "starter": {
                "heading": copy["Starter read heading"],
                "line": copy["Starter read line"].replace("{trades}", str(trades)),
                "metrics": _starter_metrics(m["values"]),
            },
        })
        return result

    scored = score_metrics(m["values"], demo)
    found = flag_rules.detect(stmt.positions, m["values"]["max_drawdown"], m["values"]["stop_usage"])
    uncapped = round_half_up(scored["raw_score"])
    caps = [flag_rules.CAPS[f["code"]] for f in found if flag_rules.CAPS[f["code"]] is not None]
    if score_type == "early":
        caps.append(EARLY_CAP)
    score = min([uncapped] + caps)
    code, name, meaning = band_for(score)

    result.update({
        "score": score,
        "uncapped_score": uncapped,
        "band": {"code": code, "name": name, "meaning": meaning},
        "pillars": scored["pillars"],
        "red_flags": insights.red_flag_texts(found),
        "red_flag_panel": insights.red_flag_panel(found, result["notes"]),
        "headline": insights.headline(scored["pillars"], score, ctx["losses_held_open"], early=score_type == "early"),
        "top_fixes": insights.top_fixes(scored["pillars"]),
        "starter": None,
        "early": None if score_type == "full" else {
            "label": copy["Early score label"],
            "line": (copy["Early score line"].replace("{trades}", str(trades)).replace("{period}", label)),
            "cap": EARLY_CAP,
        },
    })
    return result


__all__ = ["evaluate", "BANDS"]
