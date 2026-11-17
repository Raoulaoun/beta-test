"""Write synthetic MT5 statements for the end-to-end run. Usage: python make_fixtures.py <out_dir>"""
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path[:0] = [str(ROOT / "services" / "scoring"), str(ROOT / "services" / "scoring" / "tests")]
import synth  # noqa: E402

out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)

def winners_with_open_loss():
    start = datetime(2025, 6, 2, 10)
    trades = [synth.Trade("EURUSD", "buy", 0.5, start + timedelta(days=3 * i), 1.1,
                          start + timedelta(days=3 * i, hours=3), 1.102, 40.0, sl=1.09) for i in range(150)]
    return synth.Report(trades=trades, cash=[synth.Cash(start - timedelta(days=1), 10_000.0)],
                        open_positions=[synth.OpenPos("EURUSD", "buy", 2.0, datetime(2025, 8, 1, 10), 1.12, -4_000.0)])

demo = synth.disciplined(); demo.server, demo.account_type = "Example-Demo", "demo"
files = {
    "disciplined.xlsx": synth.to_xlsx(synth.disciplined()),
    "disciplined.html": synth.to_html(synth.disciplined()),
    "demo.xlsx": synth.to_xlsx(demo),
    "martingale.xlsx": synth.to_xlsx(synth.martingale_gambler()),
    "blown.xlsx": synth.to_xlsx(synth.blown()),
    "short-history.xlsx": synth.to_xlsx(synth.short_history()),
    "losses-held-open.xlsx": synth.to_xlsx(winners_with_open_loss()),
    "mt4-statement.htm": synth.to_mt4_html(synth.disciplined()),
    "mt4-detailed.htm": synth.to_mt4_html(synth.martingale_gambler(), detailed=True),
    "mt4-no-trades.htm": synth.MT4_HTML,                   # MT4 statement with no closed trades
    "early-nudge.xlsx": synth.to_xlsx(synth.few_trades(20, start=datetime(2026, 10, 19, 9), report_time=datetime(2026, 11, 10, 12))),
    "starter.xlsx": synth.to_xlsx(synth.Report(trades=synth.few_trades(3, win=False, stops=False).trades[:2] + synth.few_trades(1, start=datetime(2026, 10, 9, 9)).trades, cash=[synth.Cash(datetime(2026, 10, 4), 10_000.0)], report_time=datetime(2026, 10, 12, 12))),
    "notes.xlsx": synth.spreadsheet_without_sections(),    # server: not a report
    "photo.png": b"\x89PNG\r\n\x1a\n" + b"\x00" * 64,      # browser: wrong extension
    "empty.xlsx": b"",                                     # browser: empty file
    "empty-report.xlsx": synth.to_xlsx(synth.Report(trades=[], cash=[synth.Cash(datetime(2026, 1, 1), 1000.0)])),
    "big.xlsx": b"\0" * (10 * 1024 * 1024 + 1),            # browser: over 10 MB
}
for name, data in files.items():
    (out / name).write_bytes(data)
print("wrote", len(files), "files; account number in synthetic files:", synth.Report([], []).account)
