from ..errors import FileTooLarge
from ..model import Statement
from .grid import MAX_BYTES, file_to_grid
from .mt5 import mask_account, parse_grid


def parse_statement(data: bytes) -> Statement:
    """Parse an uploaded MT5 report held in memory. Nothing is written anywhere."""
    if len(data) > MAX_BYTES:
        raise FileTooLarge()
    return parse_grid(file_to_grid(data))


__all__ = ["parse_statement", "mask_account"]
