"""Turn an uploaded file (bytes, in memory) into a grid of cell values.

MT5 writes the same report as XLSX or HTML. Both become a list of rows where each
cell sits at the column index it occupies in the report, so one parser reads both.
Merged XLSX cells and HTML colspans keep their value in the first column only.
"""

import io
import re
import zipfile

from ..errors import NotAReport

Grid = list[list[object]]

MAX_BYTES = 10 * 1024 * 1024


def _is_zip(data: bytes) -> bool:
    return data[:4] == b"PK\x03\x04"


def xlsx_grid(data: bytes) -> Grid:
    import openpyxl

    try:
        wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except (zipfile.BadZipFile, KeyError, ValueError, OSError) as exc:
        raise NotAReport("unreadable spreadsheet") from exc
    try:
        ws = wb.worksheets[0]
        return [list(row) for row in ws.iter_rows(values_only=True)]
    finally:
        wb.close()


def decode_text(data: bytes) -> str:
    if data[:2] == b"\xff\xfe":
        return data[2:].decode("utf-16-le", errors="replace")
    if data[:2] == b"\xfe\xff":
        return data[2:].decode("utf-16-be", errors="replace")
    if data[:3] == b"\xef\xbb\xbf":
        return data[3:].decode("utf-8", errors="replace")
    # UTF-16 without a BOM shows up as every other byte being NUL.
    sample = data[:2000]
    if sample and sample.count(b"\x00") > len(sample) // 4:
        return data.decode("utf-16-le", errors="replace")
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data.decode("cp1252", errors="replace")


_HIDDEN = re.compile(r"display\s*:\s*none", re.I)


def html_grid(text: str) -> Grid:
    import lxml.html

    try:
        doc = lxml.html.document_fromstring(text)
    except Exception as exc:  # lxml raises several types for garbage input
        raise NotAReport("unreadable html") from exc

    grid: Grid = []
    for tr in doc.iter("tr"):
        if _HIDDEN.search(tr.get("style", "")) or "hidden" in tr.get("class", "").split():
            continue
        row: list[object] = []
        for cell in tr:
            if cell.tag not in ("td", "th"):
                continue
            value = " ".join(cell.text_content().split())
            row.append(value if value else None)
            try:
                span = int(cell.get("colspan", "1"))
            except ValueError:
                span = 1
            row.extend([None] * max(span - 1, 0))
        grid.append(row)
    return grid


def is_mt4(text: str) -> bool:
    """MT4 statements (Statement and Detailed Statement) have a Closed Transactions section."""
    return "closed transactions" in text.lower()


def read_html(data: bytes) -> str:
    text = decode_text(data)
    if "<" not in text[:4000] or not re.search(r"<\s*(table|tr|html)", text, re.I):
        raise NotAReport("not html or xlsx")
    return text


def file_to_grid(data: bytes) -> Grid:
    """Grid for either platform's file (used by checks that read the report's own totals)."""
    if _is_zip(data):
        return xlsx_grid(data)
    return html_grid(read_html(data))
