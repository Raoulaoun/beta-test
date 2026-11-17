"""Load the approved copy from docs/advice-texts.md, word for word.

The service never carries its own copy of these texts: it reads the approved
Markdown file so the product can't drift from what was signed off.
"""

import os
import re
from functools import lru_cache
from pathlib import Path

DEFAULT_PATH = Path(__file__).resolve().parents[3] / "docs" / "advice-texts.md"


def _clean(s: str) -> str:
    # The Markdown escapes underscores in placeholders (first\_name); unescape them.
    return s.replace("\\_", "_").strip()


@lru_cache(maxsize=1)
def load(path: str | None = None) -> dict:
    p = Path(path or os.environ.get("ADVICE_TEXTS_PATH") or DEFAULT_PATH)
    lines = p.read_text(encoding="utf-8").splitlines()

    advice: dict[str, dict] = {}
    red_flags: dict[str, str] = {}
    headlines: dict[str, dict] = {}
    tables: dict[str, dict[str, str]] = {}  # every 2-column table, by section heading
    coach: dict[str, dict[str, str]] = {}

    section = ""
    current: str | None = None
    for raw in lines:
        line = raw.rstrip()
        if line.startswith("## "):
            section = line[3:].strip().lower()
            current = None
            continue
        if line.startswith("### "):
            current = None
            continue
        m = re.fullmatch(r"\*\*(.+?)\*\*", line.strip())
        if m and (section.startswith("metric advice") or section.startswith("red flag")):
            current = m.group(1)
            if section.startswith("metric advice"):
                advice[current] = {"diagnosis": "", "actions": []}
            else:
                red_flags[current] = ""
            continue
        if section.startswith("coach insights") and line.startswith("|"):
            cells = [_clean(c) for c in line.strip("|").split("|")]
            if len(cells) == 4 and cells[0] != "Area" and not set(cells[0]) <= {"-", " "}:
                coach[cells[0]] = {"working": cells[1], "costing": cells[2], "action": cells[3]}
            continue
        if line.startswith("|") and not section.startswith("headline"):
            cells = [_clean(c) for c in line.strip("|").split("|")]
            if len(cells) == 2 and cells[0] not in ("Case", "Where") and not set(cells[0]) <= {"-", " "}:
                tables.setdefault(section, {})[cells[0]] = cells[1]
            continue
        if section.startswith("headline") and line.startswith("|"):
            cells = [_clean(c) for c in line.strip("|").split("|")]
            if len(cells) == 3 and cells[0] not in ("Metric", "---") and not set(cells[0]) <= {"-", " "}:
                headlines[cells[0]] = {"weakness": cells[1], "strength": cells[2]}
            continue
        if current is None or not line.strip():
            continue
        if section.startswith("metric advice"):
            if line.startswith("- "):
                advice[current]["actions"].append(_clean(line[2:]))
            else:
                advice[current]["diagnosis"] = _clean((advice[current]["diagnosis"] + " " + line))
        elif section.startswith("red flag"):
            red_flags[current] = _clean(red_flags[current] + " " + line)

    def table(prefix: str) -> dict[str, str]:
        return next((t for name, t in tables.items() if name.startswith(prefix)), {})

    return {"advice": advice, "red_flags": red_flags, "headlines": headlines,
            "panel": table("red-flag panel"), "messages": table("upload errors"),
            "copy": table("early score"), "coach": coach}
