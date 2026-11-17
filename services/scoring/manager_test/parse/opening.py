"""Opening balance for exports that start after the first deposit.

A report exported for a date range ("Last 2 weeks" instead of "All History") has no
deposit row: the money was already in the account when the range starts. Without it the
balance would start at 0 and the first losing trade would read as a 100% loss. The
balance the report states lets us put the missing money back as one cash flow at the
start, so it never counts as profit or loss.
"""

from datetime import timedelta

from ..model import BalanceEvent

TOLERANCE = 0.01  # report rounding


def with_opening_balance(events: list[BalanceEvent], opening: float | None) -> list[BalanceEvent]:
    if opening is None or opening <= TOLERANCE or not events:
        return events
    first = min(e.time for e in events)
    return [BalanceEvent(time=first - timedelta(seconds=1), amount=round(opening, 2), is_cash_flow=True), *events]
