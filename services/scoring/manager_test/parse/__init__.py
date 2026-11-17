from ..errors import FileTooLarge
from ..model import Statement
from .grid import MAX_BYTES, html_grid, is_mt4, read_html, xlsx_grid
from .mt4 import parse_mt4
from .mt5 import mask_account, parse_grid


def parse_statement(data: bytes) -> Statement:
    """Parse an uploaded MT4 or MT5 statement held in memory. Nothing is written anywhere."""
    if len(data) > MAX_BYTES:
        raise FileTooLarge()
    if data[:4] == b"PK\x03\x04":
        return parse_grid(xlsx_grid(data))           # MT5 XLSX
    text = read_html(data)
    if is_mt4(text):
        return parse_mt4(text)                        # MT4 Statement / Detailed Statement
    return parse_grid(html_grid(text))                # MT5 HTML


__all__ = ["parse_statement", "mask_account"]
