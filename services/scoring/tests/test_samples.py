"""Real statements in samples/ (git-ignored) must agree with their own broker Results block.

Skipped when samples/ is empty, so CI never needs the private files.
"""

from datetime import date
from pathlib import Path

import pytest

from manager_test import evaluate
from manager_test.parse import parse_statement
from manager_test.parse.grid import file_to_grid
from manager_test.parse.mt5 import _non_empty, _num, _split_sections

SAMPLES = Path(__file__).resolve().parents[3] / "samples"
FILES = sorted(p for p in SAMPLES.glob("*") if p.is_file() and not p.name.startswith(".")) if SAMPLES.exists() else []


def broker_results(data: bytes) -> dict[str, float]:
    _, sections = _split_sections(file_to_grid(data))
    out = {}
    for row in sections.get("results", []):
        cells = [v for _, v in _non_empty(row)]
        for label, value in zip(cells[::2], cells[1::2]):
            out[label.rstrip(":").strip().lower()] = _num(value)
    return out


@pytest.mark.skipif(not FILES, reason="no files in samples/")
@pytest.mark.parametrize("path", FILES, ids=lambda p: p.name)
@pytest.mark.filterwarnings("ignore::UserWarning")
def test_sample_matches_broker_results(path):
    data = path.read_bytes()
    stmt = parse_statement(data)
    results = broker_results(data)
    assert len(stmt.positions) == int(results["total trades"])
    assert sum(p.net for p in stmt.positions) == pytest.approx(results["total net profit"], abs=0.01)
    r = evaluate(data, date(2026, 11, 16))
    assert r["status"] in {"scored", "not_enough_history"}
    assert stmt.account_masked and stmt.account_masked.startswith("•••")
