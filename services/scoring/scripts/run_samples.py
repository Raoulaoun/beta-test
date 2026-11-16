"""Score every file in samples/ and print a Markdown table. Writes nothing.

Usage: python scripts/run_samples.py [samples_dir] [--date YYYY-MM-DD]
Only masked account numbers are printed; file names are shown as given.
"""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from manager_test import evaluate  # noqa: E402
from manager_test.errors import StatementError  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    when = date.fromisoformat(argv[argv.index("--date") + 1]) if "--date" in argv else date.today()
    if "--date" in argv:
        args.remove(argv[argv.index("--date") + 1])
    folder = Path(args[0]) if args else ROOT / "samples"
    files = sorted(p for p in folder.iterdir() if p.is_file() and not p.name.startswith("."))
    if not files:
        print(f"No files in {folder}")
        return
    print(f"Evaluation date: {when}\n")
    print("| File | Account | Broker | Type | Size | Months | Trades | Score | Band | "
          "Risk | Disc. | Cons. | Risk-adj. | Depth | Red flags | Notes |")
    print("|" + "---|" * 16)
    for p in files:
        try:
            r = evaluate(p.read_bytes(), when)
        except StatementError as exc:
            print(f"| {p.name} | | | | | | | | error: `{exc.code}` | | | | | | | |")
            continue
        a, h = r["account"], r["history"]
        pil = {x["key"]: f'{x["score"]:.0f}' for x in r["pillars"]} if r["pillars"] else {}
        score = r["score"] if r["score"] is not None else f'— (back {r["come_back_date"]})'
        flags = ", ".join(f["code"] for f in r["red_flags"]) or "—"
        print(f'| {p.name} | {a["account_masked"]} | {a["broker"]} | {a["account_type"]} | {a["size_bucket"]} '
              f'| {h["months"]:.1f} | {h["closed_trades"]} | {score} | {r["band"]["name"]} '
              f'| {pil.get("risk_control", "")} | {pil.get("discipline", "")} | {pil.get("consistency", "")} '
              f'| {pil.get("risk_adjusted", "")} | {pil.get("depth", "")} | {flags} | {", ".join(r["notes"]) or "—"} |')


if __name__ == "__main__":
    main(sys.argv[1:])
