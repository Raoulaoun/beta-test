"""evaluate(): uploaded bytes in, result JSON out. Pure and deterministic.

The same file with the same evaluation date always returns the same result.
Nothing is written to disk, a database or logs here.
"""

import math
from datetime import date, datetime, timedelta, timezone

from . import flags as flag_rules
from . import insights, metrics
from .parse import parse_statement
from .score import (BANDS, NOT_ENOUGH_HISTORY, band_for, round_half_up, score_metrics)
from .version import SCORING_VERSION

MIN_MONTHS = 3
MIN_TRADES = 30
STALE_FLOOR_DAYS = 7


def _is_demo(stmt) -> bool:
    names = " ".join(filter(None, [stmt.server, stmt.broker])).lower()
    return "demo" in names or stmt.account_type_field == "demo"


def come_back_date(first: datetime, last: datetime, close_times: list[datetime],
                   evaluation_date: date) -> date:
    trades = len(close_times)
    dates = []
    if metrics.add_months(first.date(), MIN_MONTHS) > last.date():
        dates.append(metrics.add_months(first.date(), MIN_MONTHS))
    if trades < MIN_TRADES:
        # Project from the trade rate over the last 30 days of the record,
        # or over the whole record if those 30 days were empty.
        recent = sum(1 for t in close_times if t > last - timedelta(days=30))
        if recent:
            rate = recent / 30
        else:
            rate = trades / max((last - first).total_seconds() / 86400, 1.0)
        dates.append(evaluation_date + timedelta(days=math.ceil((MIN_TRADES - trades) / rate)))
    result = max(dates)
    if result <= evaluation_date:
        result = evaluation_date + timedelta(days=STALE_FLOOR_DAYS)
    return result


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
        "drawdown_basis": "closed_balance",
        "notes": ["losses_held_open"] if ctx["losses_held_open"] else [],
    }

    enough = (metrics.add_months(ctx["first_trade"].date(), MIN_MONTHS) <= ctx["last_trade"].date()
              and ctx["trade_count"] >= MIN_TRADES)
    if not enough:
        code, name, meaning = NOT_ENOUGH_HISTORY
        result.update({
            "status": "not_enough_history",
            "score": None,
            "band": {"code": code, "name": name, "meaning": meaning},
            "come_back_date": come_back_date(
                ctx["first_trade"], ctx["last_trade"],
                [p.close_time for p in stmt.positions], evaluation_date).isoformat(),
            "pillars": None, "red_flags": [], "headline": None, "top_fixes": [],
        })
        return result

    scored = score_metrics(m["values"], demo)
    found = flag_rules.detect(stmt.positions, m["values"]["max_drawdown"], m["values"]["stop_usage"])
    uncapped = round_half_up(scored["raw_score"])
    caps = [flag_rules.CAPS[f["code"]] for f in found if flag_rules.CAPS[f["code"]] is not None]
    score = min([uncapped] + caps)
    code, name, meaning = band_for(score)

    result.update({
        "status": "scored",
        "score": score,
        "uncapped_score": uncapped,
        "band": {"code": code, "name": name, "meaning": meaning},
        "pillars": scored["pillars"],
        "red_flags": insights.red_flag_texts(found),
        "headline": insights.headline(scored["pillars"], score),
        "top_fixes": insights.top_fixes(scored["pillars"]),
        "come_back_date": None,
    })
    return result


__all__ = ["evaluate", "BANDS"]
