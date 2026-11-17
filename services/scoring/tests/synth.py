"""Synthetic MT5 ReportHistory statements for tests, in both XLSX and HTML layouts.

Built in memory. Every scenario is seeded, so each run produces the same files.
"""

import io
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta

import numpy as np

T_FMT = "%Y.%m.%d %H:%M:%S"

POSITION_COLS = ["Time", "Position", "Symbol", "Type", "Volume", "Price", "S / L", "T / P",
                 "Time", "Price", "Commission", "Swap", "Profit"]
ORDER_COLS = ["Open Time", "Order", "Symbol", "Type", "Volume", "Price", "S / L", "T / P",
              "Time", "State", "Comment"]
DEAL_COLS = ["Time", "Deal", "Symbol", "Type", "Direction", "Volume", "Price", "Order",
             "Commission", "Fee", "Swap", "Profit", "Balance", "Comment"]
OPEN_COLS = ["Time", "Position", "Symbol", "Type", "Volume", "Price", "S / L", "T / P",
             "Market Price", "Swap", "Profit", "Comment"]


@dataclass
class Trade:
    symbol: str
    direction: str
    volume: float
    open_time: datetime
    open_price: float
    close_time: datetime
    close_price: float
    profit: float
    sl: float | None = None
    commission: float = 0.0
    swap: float = 0.0


@dataclass
class Cash:
    time: datetime
    amount: float


@dataclass
class OpenPos:
    symbol: str
    direction: str
    volume: float
    open_time: datetime
    open_price: float
    profit: float


@dataclass
class Report:
    trades: list[Trade]
    cash: list[Cash]
    open_positions: list[OpenPos] = field(default_factory=list)
    account: str = "51234567"
    currency: str = "USD"
    server: str = "Example-Live"
    account_type: str = "real"
    company: str = "Example Markets Ltd"
    report_time: datetime = datetime(2026, 11, 10, 12, 0, 0)
    equity: float | None = None  # statement's "Equity:" figure; computed when None
    opening: float = 0.0  # balance before the first row: a date-range export, not All History


# ---------- scenario builders ----------

def _trading_days(start: datetime, end: datetime):
    d = start
    while d < end:
        if d.weekday() < 5:
            yield d
        d += timedelta(days=1)


def risk_based(seed: int, start: datetime, end: datetime, *, risk: float, win_rate: float,
               rr: float, trades_per_day=(1, 2), deposit: float = 10_000.0,
               extra_cash: list[Cash] | None = None, stops: bool = True,
               symbols=("EURUSD", "GBPUSD", "XAUUSD")) -> Report:
    """Fixed-fraction risk trader: every trade risks `risk` of the balance before it."""
    rng = np.random.RandomState(seed)
    cash = [Cash(start - timedelta(days=1), deposit)] + list(extra_cash or [])
    cash.sort(key=lambda c: c.time)
    trades, balance, ci = [], 0.0, 0
    for day in _trading_days(start, end):
        for k in range(rng.randint(trades_per_day[0], trades_per_day[1] + 1)):
            open_t = day + timedelta(hours=9 + 3 * k, minutes=int(rng.randint(0, 50)))
            while ci < len(cash) and cash[ci].time <= open_t:
                balance += cash[ci].amount
                ci += 1
            win = rng.rand() < win_rate
            hold = timedelta(minutes=int(rng.randint(30, 150)))
            close_t = open_t + hold
            pnl = balance * risk * (rr if win else -1.0)
            symbol = symbols[rng.randint(len(symbols))]
            price = 2000.0 if symbol == "XAUUSD" else 1.1
            direction = "buy" if rng.rand() < 0.5 else "sell"
            move = price * 0.002 * (1 if win else -1) * (1 if direction == "buy" else -1)
            trades.append(Trade(symbol, direction, round(balance / 10_000 * 0.5, 2), open_t, price,
                                close_t, price + move, round(pnl, 2),
                                sl=(price * 0.99 if direction == "buy" else price * 1.01) if stops else None))
            balance += round(pnl, 2)
    while ci < len(cash):
        ci += 1
    return Report(trades=trades, cash=cash)


def disciplined(seed: int = 7, **kw) -> Report:
    return risk_based(seed, datetime(2025, 5, 5), datetime(2026, 11, 6),
                      risk=0.005, win_rate=0.55, rr=1.6, **kw)


def martingale_gambler(seed: int = 11) -> Report:
    """Doubles size after every loss, on one symbol, no stops. Ends far up."""
    rng = np.random.RandomState(seed)
    start, end = datetime(2026, 3, 2), datetime(2026, 10, 30)
    cash = [Cash(start - timedelta(days=1), 2_000.0)]
    trades, base, level = [], 0.35, 0
    for day in _trading_days(start, end):
        for k in range(3):
            open_t = day + timedelta(hours=8 + 3 * k)
            close_t = open_t + timedelta(hours=2)
            vol = round(base * (2 ** level), 2)
            win = rng.rand() < 0.62
            pnl = vol * (60.0 if win else -50.0)
            trades.append(Trade("XAUUSD", "buy", vol, open_t, 2000.0, close_t,
                                2000.0 + (6 if win else -5), round(pnl, 2)))
            level = 0 if win else min(level + 1, 5)
    return Report(trades=trades, cash=cash)


def blown(seed: int = 5) -> Report:
    """Risks 8% a trade with a weak edge; a bad stretch takes it past 50% down."""
    return risk_based(seed, datetime(2025, 11, 3), datetime(2026, 10, 30),
                      risk=0.08, win_rate=0.42, rr=1.3, trades_per_day=(0, 1))


def short_history(seed: int = 3) -> Report:
    return risk_based(seed, datetime(2026, 9, 1), datetime(2026, 11, 2),
                      risk=0.005, win_rate=0.55, rr=1.6)


# ---------- writers ----------

def _fmt_num(v: float, html: bool) -> object:
    if not html:
        return round(v, 2)
    s = f"{v:,.2f}".replace(",", " ")
    return s


def _rows(rep: Report, html: bool) -> list[tuple[str, list]]:
    """Rows as (kind, cells). kind: 'label', 'section', 'header', 'data', 'blank'."""
    f = lambda v: _fmt_num(v, html)  # noqa: E731
    rows: list[tuple[str, list]] = [
        ("title", ["Trade History Report"]),
        ("label", ["Name:", "Test Trader"]),
        ("label", ["Account:", f"{rep.account} ({rep.currency}, {rep.server}, {rep.account_type}, Hedge)"]),
        ("label", ["Company:", rep.company]),
        ("label", ["Date:", rep.report_time.strftime("%Y.%m.%d %H:%M")]),
        ("section", ["Positions"]),
        ("header", POSITION_COLS),
    ]
    for i, t in enumerate(rep.trades):
        rows.append(("data", [t.open_time.strftime(T_FMT), str(1000 + i), t.symbol, t.direction,
                              t.volume, t.open_price, "" if t.sl is None else round(t.sl, 5), "",
                              t.close_time.strftime(T_FMT), t.close_price, f(t.commission),
                              f(t.swap), f(t.profit)]))
    rows += [("section", ["Orders"]), ("header", ORDER_COLS), ("section", ["Deals"]), ("header", DEAL_COLS)]

    events = []
    for c in rep.cash:
        events.append((c.time, 0, ["", "balance", "", "", "", "", f(0), f(0), f(0), c.amount,
                                   "Deposit" if c.amount > 0 else "Withdrawal"]))
    for i, t in enumerate(rep.trades):
        events.append((t.open_time, 1, [t.symbol, t.direction, "in", t.volume, t.open_price, str(i),
                                        f(0), f(0), f(0), 0.0, ""]))
        opp = "sell" if t.direction == "buy" else "buy"
        events.append((t.close_time, 2, [t.symbol, opp, "out", t.volume, t.close_price, str(i),
                                         f(t.commission), f(0), f(t.swap), t.profit, ""]))
    events.sort(key=lambda e: (e[0], e[1]))
    balance = rep.opening
    for n, (time, _, cells) in enumerate(events):
        amount = cells[9] + t_float(cells[6], html) + t_float(cells[8], html)
        balance += amount
        out = [time.strftime(T_FMT), str(5000 + n)] + cells[:9] + [f(cells[9]), f(balance), cells[10]]
        out = out[:8] + out[8:]
        rows.append(("data", out))
    rows += [("section", ["Open Positions"]), ("header", OPEN_COLS)]
    for i, o in enumerate(rep.open_positions):
        rows.append(("data", [o.open_time.strftime(T_FMT), str(9000 + i), o.symbol, o.direction, o.volume,
                              o.open_price, "", "", o.open_price, f(0), f(o.profit), ""]))
    if rep.open_positions:
        # MT5's summary under Open Positions: label in column A, value in column D.
        floating = sum(o.profit for o in rep.open_positions)
        equity = rep.equity if rep.equity is not None else balance + floating
        rows += [("data", ["", "", "", "", "", "", "", "", "", "", f(floating), ""]),
                 ("label", ["Balance:", f(balance)]), ("label", ["Credit Facility:", f(0)]),
                 ("label", ["Floating P/L:", f(floating)]), ("label", ["Equity:", f(equity)])]
    rows += [("section", ["Results"]), ("label", ["Total Net Profit:", f(sum(t.profit for t in rep.trades))])]
    return rows


def t_float(v: object, html: bool) -> float:
    return float(str(v).replace(" ", "")) if html else float(v)


def to_xlsx(rep: Report) -> bytes:
    import openpyxl

    wb = openpyxl.Workbook()
    ws = wb.active
    for kind, cells in _rows(rep, html=False):
        if kind == "label":
            # MT5 puts the label in column A and the value in column D.
            ws.append([cells[0], None, None, cells[1]])
        else:
            ws.append(cells)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def to_html(rep: Report) -> bytes:
    out = ['<html><head><meta charset="utf-16"><title>Report</title></head><body>',
           '<table>', '<tr style="display:none"><td>hidden</td><td>Deals</td></tr>']
    for kind, cells in _rows(rep, html=True):
        if kind == "label":
            out.append(f'<tr><th colspan="3" align="right">{cells[0]}</th>'
                       f'<th colspan="10" align="left"><b>{cells[1]}</b></th></tr>')
        elif kind in ("section", "title"):
            out.append(f'<tr><th colspan="14"><div><b>{cells[0]}</b></div></th></tr>')
        elif kind == "header":
            out.append("<tr>" + "".join(f"<td><b>{c}</b></td>" for c in cells) + "</tr>")
        else:
            out.append("<tr>" + "".join(f"<td>{'' if c is None else c}</td>" for c in cells) + "</tr>")
    out.append("</table></body></html>")
    return b"\xff\xfe" + "\n".join(out).encode("utf-16-le")


def with_(rep: Report, **kw) -> Report:
    return replace(rep, **kw)


# ---------- non-MT5 files ----------

MT4_HTML = (b"<html><head><title>Statement: 1234567 - Trader</title></head><body><table>"
            b"<tr><td>Account: 1234567</td></tr><tr><td><b>Closed Transactions:</b></td></tr>"
            b"<tr><td>Ticket</td><td>Open Time</td><td>Type</td></tr></table></body></html>")
NOT_A_REPORT_TEXT = b"Hello, these are my trading notes for the week."
NOT_A_REPORT_PDF = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def spreadsheet_without_sections() -> bytes:
    import openpyxl

    wb = openpyxl.Workbook()
    wb.active.append(["Date", "Pair", "Result"])
    wb.active.append(["2026-01-02", "EURUSD", 12.5])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ---------- MT4 statements (Save as Report / Save as Detailed Report) ----------

MT4_COLS = ["Ticket", "Open Time", "Type", "Size", "Item", "Price", "S / L", "T / P",
            "Close Time", "Price", "Commission", "Taxes", "Swap", "Profit"]
MT4_T = "%Y.%m.%d %H:%M"


def _m4(v: float) -> str:
    return f"{v:,.2f}".replace(",", " ")


def to_mt4_html(rep: Report, detailed: bool = False, company: str | None = None,
                cancelled_orders: int = 2) -> bytes:
    """An MT4 statement in the layout the terminal writes, encoded windows-1252."""
    company = company or (rep.company + (" Demo" if rep.account_type == "demo" else ""))
    title = ("Detailed Statement" if detailed else "Statement") + f": {rep.account} - Test Trader"
    td = lambda v, extra="": f"<td{extra}>{v}</td>"  # noqa: E731
    rows = []
    events = [(c.time, 0, "cash", c) for c in rep.cash] + [(t.open_time, 1, "trade", t) for t in rep.trades]
    events.sort(key=lambda e: (e[0], e[1]))
    ticket = 70000
    for _, _, kind, obj in events:
        ticket += 1
        if kind == "cash":
            rows.append("<tr align=right>" + td(ticket) + td(obj.time.strftime(MT4_T), " class=msdate nowrap")
                        + td("balance") + td("Deposit" if obj.amount > 0 else "Withdrawal", " colspan=10 align=left")
                        + td(_m4(obj.amount), " class=mspt") + "</tr>")
        else:
            t = obj
            rows.append("<tr align=right>" + td(ticket) + td(t.open_time.strftime(MT4_T), " class=msdate nowrap")
                        + td(t.direction) + td(f"{t.volume:.2f}", " class=mspt") + td(t.symbol.lower())
                        + td(f"{t.open_price:.5f}") + td(f"{t.sl:.5f}" if t.sl else "0.00000") + td("0.00000")
                        + td(t.close_time.strftime(MT4_T), " class=msdate nowrap") + td(f"{t.close_price:.5f}")
                        + td(_m4(t.commission), " class=mspt") + td("0.00", " class=mspt")
                        + td(_m4(t.swap), " class=mspt") + td(_m4(t.profit), " class=mspt") + "</tr>")
    for i in range(cancelled_orders):  # pending orders that never filled: must be ignored
        t = rep.trades[min(i * 7, len(rep.trades) - 1)] if rep.trades else None
        when = (t.open_time if t else rep.report_time).strftime(MT4_T)
        rows.append("<tr align=right>" + td(90000 + i) + td(when, " class=msdate nowrap") + td("buy limit")
                    + td("0.10", " class=mspt") + td("eurusd") + td("1.05000") + td("0.00000") + td("0.00000")
                    + td(when, " class=msdate nowrap") + td("1.10000") + td("cancelled", " colspan=4 align=right") + "</tr>")
    closed_pl = sum(t.profit + t.commission + t.swap for t in rep.trades)
    deposits = sum(c.amount for c in rep.cash)
    balance = rep.opening + deposits + closed_pl
    floating = sum(o.profit for o in rep.open_positions)
    equity = rep.equity if rep.equity is not None else balance + floating

    open_rows = []
    for i, o in enumerate(rep.open_positions):
        open_rows.append("<tr align=right>" + td(95000 + i) + td(o.open_time.strftime(MT4_T), " class=msdate nowrap")
                         + td(o.direction) + td(f"{o.volume:.2f}", " class=mspt") + td(o.symbol.lower())
                         + td(f"{o.open_price:.5f}") + td("0.00000") + td("0.00000") + td("&nbsp;")
                         + td(f"{o.open_price:.5f}") + td("0.00", " class=mspt") + td("0.00", " class=mspt")
                         + td("0.00", " class=mspt") + td(_m4(o.profit), " class=mspt") + "</tr>")
    if not open_rows:
        open_rows = ['<tr align=right><td colspan=14 align=center>No transactions</td></tr>']

    head_cells = "".join(f"<td nowrap>{c}</td>" for c in MT4_COLS)
    open_head = "".join(f"<td nowrap>{'&nbsp;' if c == 'Close Time' else c}</td>" for c in MT4_COLS)
    details = ""
    if detailed:
        details = ("<tr align=left><td colspan=13><b>Details:</b></td></tr>"
                   '<tr align=left><td colspan=13><img src="DetailedStatement.gif" width=820 height=200 border=0 alt="Graph"></td></tr>'
                   f"<tr align=right><td colspan=3>Gross Profit:</td><td>{_m4(sum(t.profit for t in rep.trades if t.profit > 0))}</td>"
                   f"<td colspan=3>Gross Loss:</td><td>{_m4(sum(t.profit for t in rep.trades if t.profit < 0))}</td>"
                   f"<td colspan=3>Total Net Profit:</td><td colspan=3>{_m4(closed_pl)}</td></tr>"
                   f"<tr align=right><td colspan=3>Total Trades:</td><td>{len(rep.trades)}</td><td colspan=10>&nbsp;</td></tr>")
    html = f"""<html><head><title>{title}</title>
<meta name="generator" content="MetaQuotes Software Corp.">
<style type="text/css" media="screen">td {{ font: 8pt Tahoma,Arial; }}</style></head>
<body topmargin=1 marginheight=1><div align=center>
<div style="font: 20pt Times New Roman"><b>{company}</b></div><br>
<table cellspacing=1 cellpadding=3 border=0>
<tr align=left><td colspan=2><b>Account: {rep.account}</b></td><td colspan=5><b>Name: Test Trader</b></td>
<td colspan=2><b>Currency: {rep.currency}</b></td><td colspan=2><b>Leverage: 1:100</b></td>
<td colspan=3 align=right><b>{rep.report_time.strftime('%Y %B %d, %H:%M')}</b></td></tr>
<tr align=left><td colspan=13><b>Closed Transactions:</b></td></tr>
<tr align=center bgcolor="#C0C0C0">{head_cells}</tr>
{''.join(rows)}
<tr align=right><td colspan=10>&nbsp;</td><td class=mspt>0.00</td><td class=mspt>0.00</td><td class=mspt>0.00</td><td class=mspt>{_m4(closed_pl)}</td></tr>
<tr align=right><td colspan=10><b>Closed Trade P/L:</b></td><td colspan=4 align=right class=mspt><b>{_m4(closed_pl)}</b></td></tr>
<tr align=left><td colspan=13><b>Open Trades:</b></td></tr>
<tr align=center bgcolor="#C0C0C0">{open_head}</tr>
{''.join(open_rows)}
<tr align=right><td colspan=13 align=right><b>{_m4(floating)}</b></td></tr>
<tr align=left><td colspan=13><b>Working Orders:</b></td></tr>
<tr align=right><td colspan=14 align=center>No transactions</td></tr>
<tr align=left><td colspan=13><b>Summary:</b></td></tr>
<tr align=right><td colspan=2><b>Deposit/Withdrawal:</b></td><td colspan=2 class=mspt><b>{_m4(deposits)}</b></td><td colspan=4><b>Credit Facility:</b></td><td class=mspt colspan=2><b>0.00</b></td><td colspan=4>&nbsp;</td></tr>
<tr align=right><td colspan=2><b>Closed Trade P/L:</b></td><td colspan=2 class=mspt><b>{_m4(closed_pl)}</b></td><td colspan=4><b>Floating P/L:</b></td><td class=mspt colspan=2><b>{_m4(floating)}</b></td><td colspan=2><b>Margin:</b></td><td colspan=2 class=mspt><b>0.00</b></td></tr>
<tr align=right><td colspan=2><b>Balance:</b></td><td colspan=2 class=mspt><b>{_m4(balance)}</b></td><td colspan=4><b>Equity:</b></td><td class=mspt colspan=2><b>{_m4(equity)}</b></td><td colspan=2><b>Free Margin:</b></td><td colspan=2 class=mspt><b>{_m4(equity)}</b></td></tr>
{details}
</table></div></body></html>"""
    return html.encode("cp1252")


def few_trades(n: int, start: datetime = datetime(2026, 10, 5, 9), days_between: int = 1,
               win: bool = True, stops: bool = True, report_time: datetime | None = None) -> Report:
    trades = [Trade("EURUSD", "buy", 0.5, start + timedelta(days=days_between * i), 1.1,
                    start + timedelta(days=days_between * i, hours=2), 1.102 if win else 1.098,
                    40.0 if win else -25.0, sl=1.09 if stops else None) for i in range(n)]
    return Report(trades=trades, cash=[Cash(start - timedelta(days=1), 10_000.0)],
                  report_time=report_time or (start + timedelta(days=days_between * n + 1)))


def date_range_export(rep: Report, cutoff: datetime) -> Report:
    """The same account exported from `cutoff` on ("Last N weeks" instead of All History):
    no deposit row, and the running balance starts at what the account held then."""
    before = [t for t in rep.trades if t.close_time < cutoff]
    opening = sum(c.amount for c in rep.cash if c.time < cutoff) + sum(t.profit + t.commission + t.swap for t in before)
    return replace(rep, trades=[t for t in rep.trades if t.open_time >= cutoff],
                   cash=[c for c in rep.cash if c.time >= cutoff], opening=round(opening, 2))
