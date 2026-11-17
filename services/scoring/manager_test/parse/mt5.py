"""Read an MT5 ReportHistory grid into a Statement.

The account number is masked here and the raw value never leaves this module.
"""

import re
from datetime import datetime

from ..errors import EmptyReport, NotAReport
from ..model import BalanceEvent, OpenPosition, Position, Statement
from .grid import Grid

SECTIONS = {"positions", "orders", "deals", "open positions", "working orders", "results", "summary"}
CASH_FLOW_TYPES = {"balance", "credit", "bonus", "correction", "deposit", "withdrawal"}
TRADE_TYPES = {"buy", "sell"}


# ---------- cell helpers ----------

def _text(v: object) -> str:
    if v is None:
        return ""
    return " ".join(str(v).split())


def _num(v: object) -> float | None:
    if v is None:
        return None
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = re.sub(r"[\s   ]", "", str(v))
    if not s:
        return None
    m = re.match(r"^-?\d+(\.\d+)?", s)
    return float(m.group(0)) if m else None


def _time(v: object) -> datetime | None:
    if isinstance(v, datetime):
        return v
    s = _text(v)
    for fmt in ("%Y.%m.%d %H:%M:%S", "%Y.%m.%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y.%m.%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _non_empty(row: list[object]) -> list[tuple[int, str]]:
    return [(i, _text(v)) for i, v in enumerate(row) if _text(v)]


# ---------- header block ----------

def _header_value(row: list[object], label: str) -> str | None:
    cells = _non_empty(row)
    if not cells or cells[0][1].rstrip(":").strip().lower() != label:
        return None
    return cells[1][1] if len(cells) > 1 else ""


def mask_account(number: str) -> str:
    digits = re.sub(r"\D", "", number)
    return "•••" + digits[-3:] if len(digits) >= 3 else "•••"


def _parse_header(rows: Grid) -> dict:
    out: dict = {"broker": None, "server": None, "currency": None,
                 "account_masked": None, "account_type_field": None, "report_time": None}
    for row in rows:
        for label in ("account", "company", "broker", "date"):
            value = _header_value(row, label)
            if value is None:
                continue
            if label == "account":
                m = re.match(r"^\s*(\d+)\s*(?:\((.*)\))?", value)
                if m:
                    out["account_masked"] = mask_account(m.group(1))
                    parts = [p.strip() for p in (m.group(2) or "").split(",")]
                    if len(parts) >= 1 and parts[0]:
                        out["currency"] = parts[0]
                    if len(parts) >= 2 and parts[1]:
                        out["server"] = parts[1]
                    if len(parts) >= 3 and parts[2]:
                        out["account_type_field"] = parts[2].lower()
            elif label in ("company", "broker") and value and not out["broker"]:
                out["broker"] = value
            elif label == "date":
                out["report_time"] = _time(value)
    return out


# ---------- sections ----------

def _split_sections(grid: Grid) -> tuple[Grid, dict[str, Grid]]:
    header_rows: Grid = []
    sections: dict[str, Grid] = {}
    current: str | None = None
    for row in grid:
        cells = _non_empty(row)
        if len(cells) == 1 and cells[0][1].lower() in SECTIONS:
            current = cells[0][1].lower()
            sections.setdefault(current, [])
            continue
        if current is None:
            header_rows.append(row)
        else:
            sections[current].append(row)
    return header_rows, sections


def _table(rows: Grid) -> list[dict[str, object]]:
    """First non-empty row is the column header; the rest are records keyed by name."""
    rows = [r for r in rows if _non_empty(r)]
    if not rows:
        return []
    columns: list[tuple[int, str]] = []
    seen: dict[str, int] = {}
    for idx, name in _non_empty(rows[0]):
        key = re.sub(r"\s+", "", name.lower())
        seen[key] = seen.get(key, 0) + 1
        columns.append((idx, key if seen[key] == 1 else f"{key}_{seen[key]}"))
    records = []
    for row in rows[1:]:
        rec = {key: (row[idx] if idx < len(row) else None) for idx, key in columns}
        records.append(rec)
    return records


def _positions(rows: Grid) -> list[Position]:
    out = []
    for r in _table(rows):
        open_t, close_t = _time(r.get("time")), _time(r.get("time_2"))
        direction = _text(r.get("type")).lower()
        if open_t is None or close_t is None or direction not in TRADE_TYPES:
            continue
        sl = _num(r.get("s/l"))
        out.append(Position(
            position_id=_text(r.get("position")),
            symbol=_text(r.get("symbol")),
            direction=direction,
            volume=_num(r.get("volume")) or 0.0,
            open_time=open_t,
            open_price=_num(r.get("price")) or 0.0,
            stop_loss=sl if sl else None,
            close_time=close_t,
            close_price=_num(r.get("price_2")) or 0.0,
            commission=_num(r.get("commission")) or 0.0,
            swap=_num(r.get("swap")) or 0.0,
            profit=_num(r.get("profit")) or 0.0,
        ))
    out.sort(key=lambda p: (p.open_time, p.close_time, p.position_id))
    return out


def _open_positions(rows: Grid) -> list[OpenPosition]:
    out = []
    for r in _table(rows):
        t = _time(r.get("time"))
        direction = _text(r.get("type")).lower()
        if t is None or direction not in TRADE_TYPES:
            continue
        out.append(OpenPosition(
            symbol=_text(r.get("symbol")),
            direction=direction,
            volume=_num(r.get("volume")) or 0.0,
            open_time=t,
            open_price=_num(r.get("price")) or 0.0,
            floating_profit=(_num(r.get("profit")) or 0.0) + (_num(r.get("swap")) or 0.0),
        ))
    return out


def _summary_value(rows: Grid, label: str) -> float | None:
    """A 'Label:' row under Open Positions (Balance, Floating P/L, Equity)."""
    for row in rows:
        cells = _non_empty(row)
        if len(cells) >= 2 and cells[0][1].rstrip(":").strip().lower() == label:
            return _num(cells[1][1])
    return None


def _events(rows: Grid) -> list[BalanceEvent]:
    out = []
    for r in _table(rows):
        t = _time(r.get("time"))
        if t is None:
            continue
        kind = _text(r.get("type")).lower()
        amount = sum(_num(r.get(c)) or 0.0 for c in ("profit", "commission", "fee", "swap"))
        if amount == 0:
            continue
        out.append(BalanceEvent(time=t, amount=amount, is_cash_flow=kind in CASH_FLOW_TYPES))
    # Stable sort keeps the report's own order for events in the same second.
    out.sort(key=lambda e: e.time)
    return out


def parse_grid(grid: Grid) -> Statement:
    header_rows, sections = _split_sections(grid)
    if "deals" not in sections or "positions" not in sections:
        raise NotAReport("missing Positions or Deals section")

    stmt = Statement(**_parse_header(header_rows))
    stmt.positions = _positions(sections["positions"])
    stmt.open_positions = _open_positions(sections.get("open positions", []))
    stmt.equity = _summary_value(sections.get("open positions", []), "equity")
    stmt.events = _events(sections["deals"])
    if not stmt.positions:
        raise EmptyReport()
    return stmt
