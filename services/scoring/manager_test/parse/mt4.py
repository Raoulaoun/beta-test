"""Read an MT4 HTML statement (Save as Report / Save as Detailed Report) into a Statement.

Layout: a company name above the table, a header row ("Account: 123", "Name: …",
"Currency: USD", "Leverage: …", report date), then sections marked by a single cell
("Closed Transactions:", "Open Trades:", "Working Orders:", "Summary:", "Details:").
The account number is masked here and the raw value never leaves this module.

Unverified on real MT4 files until samples arrive; built from the documented layout.
"""

import html as htmllib
import re
from datetime import datetime

from ..errors import EmptyReport, NotAReport
from ..fingerprint import account_fingerprint
from ..model import BalanceEvent, OpenPosition, Position, Statement
from .grid import html_grid
from .mt5 import _non_empty, _num, _table, _text, _time, mask_account

SECTIONS = {"closed transactions", "open trades", "working orders", "summary", "details"}
TRADE_TYPES = {"buy", "sell"}
CASH_TYPES = {"balance", "credit"}
DEMO = re.compile(r"\bdemo\b", re.I)
_HEADER_DATE_FORMATS = ("%Y %B %d, %H:%M", "%Y %b %d, %H:%M", "%Y.%m.%d %H:%M", "%Y.%m.%d %H:%M:%S")
_PERIOD = re.compile(r"(\d{4}\.\d{2}\.\d{2}(?: \d{2}:\d{2}(?::\d{2})?)?)\s*[-–]\s*(\d{4}\.\d{2}\.\d{2}(?: \d{2}:\d{2}(?::\d{2})?)?)")


def _company(text: str) -> str | None:
    """The broker name MT4 prints in bold above the statement table."""
    m = re.search(r"<div[^>]*font:\s*20pt[^>]*>\s*<b>(.*?)</b>", text, re.I | re.S)
    if not m:
        m = re.search(r"<body[^>]*>.*?<b>(.*?)</b>", text, re.I | re.S)
    if not m:
        return None
    name = " ".join(htmllib.unescape(re.sub(r"<[^>]+>", "", m.group(1))).split())
    return name or None


def _title(text: str) -> str:
    m = re.search(r"<title>(.*?)</title>", text, re.I | re.S)
    return " ".join(htmllib.unescape(m.group(1)).split()) if m else ""


def _header_time(value: str) -> datetime | None:
    v = " ".join(value.split())
    for fmt in _HEADER_DATE_FORMATS:
        try:
            return datetime.strptime(v, fmt)
        except ValueError:
            continue
    return None


def _sections(grid):
    header, sections, current = [], {}, None
    for row in grid:
        cells = _non_empty(row)
        if len(cells) == 1 and cells[0][1].rstrip(":").strip().lower() in SECTIONS:
            current = cells[0][1].rstrip(":").strip().lower()
            sections.setdefault(current, [])
            continue
        (header if current is None else sections[current]).append(row)
    return header, sections


def _labelled(rows, label: str) -> float | None:
    """A 'Label:' cell followed by its value, anywhere in a row (Summary block)."""
    for row in rows:
        cells = _non_empty(row)
        for (_, a), (_, b) in zip(cells, cells[1:]):
            if a.rstrip(":").strip().lower() == label:
                return _num(b)
    return None


def parse_mt4(text: str) -> Statement:
    grid = html_grid(text)
    header_rows, sections = _sections(grid)
    if "closed transactions" not in sections:
        raise NotAReport("no Closed Transactions section")

    account = currency = number = None
    report_time = None
    header_text = []
    for row in header_rows:
        for _, cell in _non_empty(row):
            header_text.append(cell)
            m = re.match(r"^account:\s*(\d+)", cell, re.I)
            if m:
                number = m.group(1)
                account = mask_account(number)
            m = re.match(r"^currency:\s*(\S+)", cell, re.I)
            if m:
                currency = m.group(1)
            t = _header_time(cell)
            if t:
                report_time = t
    company = _company(text)
    title = _title(text)

    period = None
    for cell in header_text:
        if cell.lower().startswith("period"):
            m = _PERIOD.search(cell)
            if m:
                a, b = _time(m.group(1)), _time(m.group(2))
                if a and b:
                    period = (a, b)

    is_demo = any(DEMO.search(s or "") for s in [company, title, *header_text])
    stmt = Statement(broker=company, server=None, currency=currency, account_masked=account,
                     account_type_field="demo" if is_demo else None, report_time=report_time,
                     platform="MT4", period=period,
                     # MT4 statements don't name the server; the broker name stands in.
                     account_fingerprint=account_fingerprint(number, company))

    positions, events = [], []
    for r in _table(sections["closed transactions"]):
        kind = _text(r.get("type")).lower()
        t_open = _time(r.get("opentime"))
        if t_open is None:
            continue
        if kind in CASH_TYPES:
            # Description spans the middle columns; the amount sits in the Profit column.
            amount = _num(r.get("profit"))
            if amount:
                events.append(BalanceEvent(time=t_open, amount=amount, is_cash_flow=True))
            continue
        if kind not in TRADE_TYPES:
            continue  # pending orders (buy limit, sell stop…) that were cancelled or expired
        t_close = _time(r.get("closetime"))
        if t_close is None:
            continue
        sl = _num(r.get("s/l"))
        commission = (_num(r.get("commission")) or 0.0) + (_num(r.get("taxes")) or 0.0)
        p = Position(position_id=_text(r.get("ticket")), symbol=_text(r.get("item")).upper(),
                     direction=kind, volume=_num(r.get("size")) or 0.0, open_time=t_open,
                     open_price=_num(r.get("price")) or 0.0, stop_loss=sl if sl else None,
                     close_time=t_close, close_price=_num(r.get("price_2")) or 0.0,
                     commission=commission, swap=_num(r.get("swap")) or 0.0,
                     profit=_num(r.get("profit")) or 0.0,
                     take_profit=_num(r.get("t/p")) or None)
        positions.append(p)
        if p.net:
            events.append(BalanceEvent(time=t_close, amount=p.net, is_cash_flow=False))

    for r in _table(sections.get("open trades", [])):
        kind = _text(r.get("type")).lower()
        t_open = _time(r.get("opentime"))
        if kind not in TRADE_TYPES or t_open is None:
            continue
        stmt.open_positions.append(OpenPosition(
            symbol=_text(r.get("item")).upper(), direction=kind, volume=_num(r.get("size")) or 0.0,
            open_time=t_open, open_price=_num(r.get("price")) or 0.0,
            floating_profit=sum(_num(r.get(c)) or 0.0 for c in ("profit", "swap", "commission", "taxes"))))

    stmt.equity = _labelled(sections.get("summary", []), "equity")
    positions.sort(key=lambda p: (p.open_time, p.close_time, p.position_id))
    events.sort(key=lambda e: e.time)  # stable: report order within the same minute
    stmt.positions, stmt.events = positions, events
    if not positions:
        raise EmptyReport()
    return stmt
