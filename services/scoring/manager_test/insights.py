"""Headline insight, top-3 fixes and red-flag explanations, filled from approved copy."""

from . import texts
from .score import METRICS, PILLARS, _pct0

_DEFS = {m.key: m for m in METRICS}

RED_FLAG_HEADINGS = {
    "martingale": "Martingale",
    "grid": "Grid",
    "blown_account": "Blown or near-blown account",
    "no_stops": "No stop losses",
}


def _fill(template: str, value: str | None) -> str:
    return template.replace("{value}", value or "")


def _all_metrics(pillars: list[dict]) -> list[dict]:
    order = {m.key: i for i, m in enumerate(METRICS)}
    out = [m for p in pillars for m in p["metrics"]]
    return sorted(out, key=lambda m: order[m["key"]])


def _usable(metric: dict) -> bool:
    # A metric with no value (e.g. profit shares when net profit is not positive)
    # can't fill its template, so it is never picked for copy.
    return metric["display"] is not None


# Metrics that only see closed trades: never praised while losses are held open.
CLOSED_TRADE_ONLY = {"max_drawdown", "worst_day", "avg_loss", "profit_factor", "hold_asymmetry"}


def headline(pillars: list[dict], score: int, losses_held_open: bool = False) -> dict:
    lines = texts.load()["headlines"]
    if score >= 80:
        order = {p.key: i for i, p in enumerate(PILLARS)}
        for pillar in sorted(pillars, key=lambda p: (-p["score"], order[p["key"]])):
            candidates = [m for m in _all_metrics([pillar]) if _usable(m)
                          and not (losses_held_open and m["key"] in CLOSED_TRADE_ONLY)]
            if not candidates:
                continue
            best = sorted(candidates, key=lambda m: -m["score"])[0]  # stable: table order on ties
            d = _DEFS[best["key"]]
            return {"kind": "strength", "metric": best["key"], "pillar": pillar["key"],
                    "text": _fill(lines[d.headline_name]["strength"], best["display"])}
    worst = sorted([m for m in _all_metrics(pillars) if _usable(m)], key=lambda m: -m["points_lost"])[0]
    d = _DEFS[worst["key"]]
    return {"kind": "weakness", "metric": worst["key"], "pillar": worst["pillar"],
            "text": _fill(lines[d.headline_name]["weakness"], worst["display"])}


def top_fixes(pillars: list[dict], n: int = 3) -> list[dict]:
    advice = texts.load()["advice"]
    ranked = sorted([m for m in _all_metrics(pillars) if _usable(m) and m["points_lost"] > 0],
                    key=lambda m: -m["points_lost"])
    out = []
    for m in ranked[:n]:
        a = advice[_DEFS[m["key"]].advice_name]
        out.append({"metric": m["key"], "name": _DEFS[m["key"]].advice_name,
                    "points_lost": m["points_lost"],
                    "diagnosis": _fill(a["diagnosis"], m["display"]),
                    "actions": list(a["actions"])})
    return out


def red_flag_texts(flags: list[dict]) -> list[dict]:
    explanations = texts.load()["red_flags"]
    out = []
    for f in flags:
        heading = RED_FLAG_HEADINGS[f["code"]]
        value = _pct0(f["value"]) if f["code"] == "blown_account" else None
        out.append({**f, "name": heading, "text": _fill(explanations[heading], value)})
    return out


# Results-screen red-flag panel: one row per flag, plus a summary line for 2+ rows.
PANEL_ROWS = [  # (code, row key in docs/advice-texts.md "Red-flag panel lines", cap)
    ("martingale", "Martingale", 40),
    ("grid", "Grid", 40),
    ("blown_account", "Blown or near-blown account", 30),
    ("no_stops", "No stop losses", None),
    ("losses_held_open", "Losses held open", None),
]


def red_flag_panel(flags: list[dict], notes: list[str]) -> dict:
    lines = texts.load()["panel"]
    present = {f["code"] for f in flags} | set(notes)
    rows = [{"code": code, "text": lines[key], "cap": cap}
            for code, key, cap in PANEL_ROWS if code in present]
    caps = [r["cap"] for r in rows if r["cap"] is not None]
    lowest = min(caps) if caps else None
    summary = None
    if len(rows) >= 2:
        if lowest is None:
            summary = lines["Two or more flags, none of them capping"].replace("{count}", str(len(rows)))
        else:
            summary = (lines["Two or more flags (summary line above the rows)"]
                       .replace("{count}", str(len(rows))).replace("{lowest cap}", str(lowest)))
    return {"none": not rows, "none_text": lines["None"] if not rows else None,
            "summary": summary, "rows": rows, "cap_applied": lowest}
