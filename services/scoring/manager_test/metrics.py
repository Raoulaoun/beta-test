"""Raw metric values from a parsed statement.

Returns are measured on trading P&L only. Each trading event's return is its P&L
divided by the balance just before it; chaining those gives a trading equity index
that deposits and withdrawals cannot move. Drawdown, worst day, annualized return
and Sortino come from that index. The report has no floating equity curve, so drawdown
is measured on closed balance, plus one final equity point when open trades end the
statement in floating loss.
"""

import bisect
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta

import numpy as np

from .model import Position, Statement

REVENGE_WINDOW = timedelta(hours=4)
NORMAL_SIZE_BALANCE = 10_000.0  # lots per $10k of balance
CENT_CURRENCIES = {"USC", "EUC", "GBC", "JPC", "CHC", "AUC"}


@dataclass
class Timeline:
    times: list[datetime]
    balances_after: list[float]

    def balance_before(self, t: datetime) -> float:
        i = bisect.bisect_left(self.times, t)
        return self.balances_after[i - 1] if i > 0 else 0.0


def build_timeline(stmt: Statement) -> Timeline:
    times, balances, running = [], [], 0.0
    for e in stmt.events:
        running += e.amount
        times.append(e.time)
        balances.append(running)
    return Timeline(times, balances)


def is_cent_account(currency: str | None) -> bool:
    if not currency:
        return False
    c = currency.strip()
    return c.upper() in CENT_CURRENCIES or "CENT" in c.upper() or (len(c) == 3 and c[2] == "c" and c[:2].isupper())


def size_bucket(balance: float, cent: bool) -> str:
    amount = balance / 100 if cent else balance
    if amount < 1_000:
        return "under $1k"
    if amount < 10_000:
        return "$1k–10k"
    if amount <= 50_000:
        return "$10k–50k"
    return "over $50k"


def add_months(d: date, months: int) -> date:
    y, m = divmod(d.month - 1 + months, 12)
    y += d.year
    m += 1
    last_day = [31, 29 if (y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)) else 28,
                31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
    return date(y, m, min(d.day, last_day))


def _weekday_bucket(d: date) -> date:
    """Weekend P&L counts toward the following Monday."""
    if d.weekday() == 5:
        return d + timedelta(days=2)
    if d.weekday() == 6:
        return d + timedelta(days=1)
    return d


def _trading_returns(stmt: Statement) -> list[tuple[datetime, float]]:
    out, balance = [], 0.0
    for e in stmt.events:
        if not e.is_cash_flow:
            if balance > 0:
                out.append((e.time, max(e.amount / balance, -1.0)))
            elif e.amount < 0:
                out.append((e.time, -1.0))
        balance += e.amount
    return out


def compute(stmt: Statement, evaluation_date: date) -> dict:
    positions: list[Position] = stmt.positions
    timeline = build_timeline(stmt)
    returns = _trading_returns(stmt)

    first_open = min(p.open_time for p in positions)
    last_close = max(p.close_time for p in positions)
    report_time = stmt.report_time or (stmt.events[-1].time if stmt.events else last_close)
    final_balance = timeline.balances_after[-1] if timeline.balances_after else 0.0

    # ----- open trades in floating loss at the end of the statement -----
    # The closed-balance curve can't see them, so the statement's equity (balance +
    # floating P/L) is added as a final point of the trading index. It counts for
    # drawdown, worst day and return/drawdown; Sortino stays on closed trades.
    floating = sum(o.floating_profit for o in stmt.open_positions)
    end_equity = stmt.equity if stmt.equity is not None else final_balance + floating
    floating_loss_at_end = bool(stmt.open_positions) and end_equity < final_balance
    equity_returns = list(returns)
    if floating_loss_at_end and final_balance > 0:
        end_time = max(report_time, stmt.events[-1].time if stmt.events else last_close)
        equity_returns.append((end_time, max((end_equity - final_balance) / final_balance, -1.0)))

    # ----- trading equity index -----
    index = np.cumprod([1.0] + [1.0 + r for _, r in equity_returns])
    peaks = np.maximum.accumulate(index)
    drawdowns = np.where(peaks > 0, (peaks - index) / peaks, 0.0)
    max_dd = float(drawdowns.max()) if len(drawdowns) else 0.0

    daily: dict[date, float] = defaultdict(lambda: 1.0)
    weekday: dict[date, float] = defaultdict(lambda: 1.0)
    for t, r in equity_returns:
        daily[t.date()] *= 1.0 + r
    for t, r in returns:
        weekday[_weekday_bucket(t.date())] *= 1.0 + r
    worst_day = max([0.0] + [1.0 - g for g in daily.values()])

    # ----- per-position returns and sizing -----
    nets = np.array([p.net for p in positions])
    pos_returns = []
    for p in positions:
        bal = timeline.balance_before(p.close_time)
        pos_returns.append(p.net / bal if bal > 0 else (-1.0 if p.net < 0 else 0.0))
    pos_returns = np.array(pos_returns)
    losing_returns = pos_returns[nets < 0]
    avg_loss = float(-losing_returns.mean()) if len(losing_returns) else 0.0

    stop_usage = sum(p.has_stop for p in positions) / len(positions)

    # Revenge sizing: lots per $10k of balance, against that symbol's median.
    norm_size = []
    for p in positions:
        bal = timeline.balance_before(p.open_time)
        norm_size.append(p.volume / (bal / NORMAL_SIZE_BALANCE) if bal > 0 else math.nan)
    by_symbol: dict[str, list[float]] = defaultdict(list)
    for p, s in zip(positions, norm_size):
        if not math.isnan(s):
            by_symbol[p.symbol].append(s)
    medians = {sym: float(np.median(v)) for sym, v in by_symbol.items()}
    loss_closes = sorted(p.close_time for p in positions if p.net < 0)
    ratios = []
    for p, s in zip(positions, norm_size):
        if math.isnan(s) or not medians.get(p.symbol):
            continue
        i = bisect.bisect_left(loss_closes, p.open_time)  # losses closed strictly before open
        if i > 0 and p.open_time - loss_closes[i - 1] <= REVENGE_WINDOW:
            ratios.append(s / medians[p.symbol])
    revenge = float(np.mean(ratios)) if ratios else 1.0

    # Adding to losers: a same-symbol, same-direction entry at a worse price while
    # an earlier position is still open.
    adds = 0
    groups: dict[tuple[str, str], list[Position]] = defaultdict(list)
    for p in positions:
        groups[(p.symbol, p.direction)].append(p)
    for (_, direction), group in groups.items():
        for q in group:
            for p in group:
                if p is q or not (p.open_time < q.open_time < p.close_time):
                    continue
                worse = q.open_price < p.open_price if direction == "buy" else q.open_price > p.open_price
                if worse:
                    adds += 1
                    break
    adding = adds / len(positions)

    # ----- losers vs winners; floating losses when no closed loser exists -----
    winners = [p for p in positions if p.net > 0]
    losers = [p for p in positions if p.net < 0]
    floating_losers = [o for o in stmt.open_positions if o.floating_profit < 0]
    # With no closed loser, open losers stand in for losses (approved Phase 1 rule).
    open_losers_count = not losers and bool(floating_losers)

    gross_profit = float(nets[nets > 0].sum())
    gross_loss = float(-nets[nets < 0].sum())
    loser_holds = [p.hold_seconds for p in losers]
    if open_losers_count:
        gross_loss = float(-sum(o.floating_profit for o in floating_losers))
        loser_holds = [max((report_time - o.open_time).total_seconds(), 0.0) for o in floating_losers]

    if gross_loss > 0:
        profit_factor = gross_profit / gross_loss
    else:
        profit_factor = math.inf if gross_profit > 0 else 0.0

    winner_hold = float(np.mean([p.hold_seconds for p in winners])) if winners else 0.0
    loser_hold = float(np.mean(loser_holds)) if loser_holds else 0.0
    if not loser_holds:
        hold_asym = 0.0
    elif winner_hold <= 0:
        hold_asym = math.inf
    else:
        hold_asym = loser_hold / winner_hold

    # Overtrading: days with more than 3x the median daily trade count.
    per_day: dict[date, int] = defaultdict(int)
    for p in positions:
        per_day[p.open_time.date()] += 1
    counts = np.array(list(per_day.values()))
    median_count = float(np.median(counts))
    overtrading = float((counts > 3 * median_count).sum() / len(counts))

    # ----- consistency (money, as the spec defines it) -----
    net_profit = float(nets.sum())
    monthly: dict[tuple[int, int], float] = defaultdict(float)
    for p in positions:
        monthly[(p.close_time.year, p.close_time.month)] += p.net
    profitable_months = sum(v > 0 for v in monthly.values()) / len(monthly)
    if net_profit > 0:
        top5 = float(np.sort(nets[nets > 0])[::-1][:5].sum() / net_profit)
        best_month = max(monthly.values()) / net_profit
    else:
        top5 = None
        best_month = None

    # ----- risk-adjusted -----
    span_days = max((last_close - first_open).total_seconds() / 86400, 1.0)
    growth = float(index[-1])
    years = span_days / 365.25
    cagr = growth ** (1 / years) - 1 if growth > 0 else -1.0
    if max_dd > 0:
        ret_dd = cagr / max_dd
    else:
        ret_dd = math.inf if cagr > 0 else 0.0

    day, end = _weekday_bucket(first_open.date()), _weekday_bucket(last_close.date())
    series = []
    while day <= end:
        if day.weekday() < 5:
            series.append(weekday.get(day, 1.0) - 1.0)
        day += timedelta(days=1)
    series = np.array(series)
    downside = float(np.sqrt(np.mean(np.square(np.minimum(series, 0.0))))) if len(series) else 0.0
    mean_daily = float(series.mean()) if len(series) else 0.0
    if downside > 0:
        sortino = mean_daily / downside * math.sqrt(252)
    else:
        sortino = math.inf if mean_daily > 0 else 0.0

    # ----- depth -----
    months_history = (last_close - first_open).total_seconds() / 86400 / 30.4375
    days_since = max((evaluation_date - last_close.date()).days, 0)

    cent = is_cent_account(stmt.currency)

    return {
        "values": {
            "max_drawdown": max_dd,
            "worst_day": worst_day,
            "avg_loss": avg_loss,
            "stop_usage": stop_usage,
            "revenge_sizing": revenge,
            "adding_to_losers": adding,
            "hold_asymmetry": hold_asym,
            "overtrading": overtrading,
            "profitable_months": profitable_months,
            "top5_share": top5,
            "best_month_share": best_month,
            "return_to_drawdown": ret_dd,
            "sortino": sortino,
            "profit_factor": profit_factor,
            "months_history": months_history,
            "closed_trades": float(len(positions)),
            "days_since_last": float(days_since),
        },
        "context": {
            "first_trade": first_open,
            "last_trade": last_close,
            "trade_count": len(positions),
            "losses_held_open": floating_loss_at_end,
            "end_equity": end_equity,
            "annualized_return": cagr,
            "net_profit": net_profit,
            "final_balance": final_balance,
            "is_cent": cent,
            "size_bucket": size_bucket(final_balance, cent),
            "trading_days": len(per_day),
        },
    }
