"""Parsed statement. Built in memory from the upload and never persisted."""

from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class Position:
    position_id: str
    symbol: str
    direction: str  # "buy" | "sell"
    volume: float
    open_time: datetime
    open_price: float
    stop_loss: float | None
    close_time: datetime
    close_price: float
    commission: float
    swap: float
    profit: float

    @property
    def net(self) -> float:
        return self.profit + self.commission + self.swap

    @property
    def has_stop(self) -> bool:
        return self.stop_loss is not None and self.stop_loss != 0

    @property
    def hold_seconds(self) -> float:
        return (self.close_time - self.open_time).total_seconds()


@dataclass(frozen=True)
class OpenPosition:
    symbol: str
    direction: str
    volume: float
    open_time: datetime
    open_price: float
    floating_profit: float


@dataclass(frozen=True)
class BalanceEvent:
    """One row of the Deals section, reduced to its effect on the balance."""

    time: datetime
    amount: float
    is_cash_flow: bool  # deposit / withdrawal / credit: excluded from returns


@dataclass
class Statement:
    broker: str | None
    server: str | None
    currency: str | None
    account_masked: str | None
    account_type_field: str | None  # "real" / "demo" / "contest", from the account line
    report_time: datetime | None
    equity: float | None = None          # "Equity:" under Open Positions, if the report has it
    positions: list[Position] = field(default_factory=list)
    open_positions: list[OpenPosition] = field(default_factory=list)
    events: list[BalanceEvent] = field(default_factory=list)
