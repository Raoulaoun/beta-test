"""The PDF report (design/pdf-report), rendered with WeasyPrint from HTML.

Input: a stored result (what the results screen showed; never trades, never the account
number), the full coach notes, the trader's name, the retest date and the team's links.
Stateless: nothing is written to disk. Pages:

1 Cover · 2 Every metric behind your score · 3 Your coach notes (built from the dashboard's
coach-note cards, approved) · 4 Red flags · 5 Your plan · 6 What managers are judged on ·
7 Next step. A starter read (no score yet) gets the cover, the last two pages and its
measured metrics in place of the pillars.

Approved changes to the design: every one of the 17 metrics is listed with your value and
its full-marks point (no professional-range column); the account is named without any
digits of its number.
"""

from __future__ import annotations

import html
from datetime import date
from pathlib import Path

from .score import METRICS, PILLARS

ASSETS = Path(__file__).parent / "pdf_assets"
DISCLAIMER = ("The Manager Test analyzes past trading results for educational purposes only. It is not investment "
              "advice, does not predict future performance, and is not an assessment for admission to the Beta "
              "platform. Results depend entirely on the statement provided.")
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
          "November", "December"]
BAND_RANGES = {"developing": "0–39", "building": "40–59", "emerging_manager": "60–79", "professional_grade": "80–100"}
PILLAR_NAME = {p.key: p.name for p in PILLARS}
METRIC = {m.key: m for m in METRICS}

e = lambda s: html.escape(str(s if s is not None else ""))  # noqa: E731


def long_date(iso: str) -> str:
    d = date.fromisoformat(iso[:10])
    return f"{d.day} {MONTHS[d.month - 1]} {d.year}"


def full_marks(key: str) -> str:
    """The full-marks point in words, from the scoring table: "10% or less", "2.0 or more"."""
    m = METRIC[key]
    shown = m.fmt(m.full)
    if m.full == 0:
        return shown
    return f"{shown} or less" if m.full < m.zero else f"{shown} or more"


def footer(n: int, total: int, dark: bool = False) -> str:
    """Bottom of every page: page number and the disclaimer."""
    if dark:
        return (f'<div class="foot" style="font-size:9.5px;line-height:1.5;color:#AEB8C4;bottom:40px;left:56px;right:56px">'
                f'<div style="font-weight:700;color:#C3CBD5;margin-bottom:6px">The Manager Test by Beta · {n} of {total}</div><div>{DISCLAIMER}</div></div>')
    return (f'<div class="foot" style="padding-top:12px;border-top:1px solid #DDE2E7;font-size:9.5px;line-height:1.5;color:#6B7684">'
            f'<div style="font-weight:700;color:#0B1F3A;margin-bottom:4px">The Manager Test by Beta · {n} of {total}</div><div>{DISCLAIMER}</div></div>')


def page(body: str, n: int, total: int, bg: str = "#FFFFFF") -> str:
    return (f'<section class="page" style="color:#1C2430;background:{bg};padding:52px 52px 36px">'
            f'{body}{footer(n, total)}</section>')


def kicker(text: str) -> str:
    return f'<div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#0E6B4F">{e(text)}</div>'


def h2(text: str, margin: str = "10px 0 6px") -> str:
    return (f'<h2 class="disp" style="margin:{margin};font-size:30px;font-weight:700;letter-spacing:-0.035em;'
            f'line-height:1.05;color:#0B1F3A">{e(text)}</h2>')


def pill(text: str, bg: str, fg: str) -> str:
    return f'<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:{bg};font-size:11px;font-weight:700;color:{fg}">{e(text)}</span>'


def bar(pct: float, width: str, height: str, track: str = "#E7F1ED", fill: str = "#0E6B4F") -> str:
    return (f'<div style="width:{width};height:{height};border-radius:999px;background:{track};overflow:hidden">'
            f'<div style="height:{height};width:{max(0, min(100, pct))}%;background:{fill};border-radius:999px"></div></div>')


# ---------- 1 cover ----------

def ring(score: int) -> str:
    c = 2 * 3.14159265 * 88
    dash = f"{c * score / 100:.1f} {c:.1f}"
    return (f'<svg viewBox="0 0 200 200" width="200" height="200"><g transform="rotate(-90 100 100)">'
            f'<circle cx="100" cy="100" r="88" fill="none" stroke="rgba(245,246,244,0.14)" stroke-width="12"/>'
            f'<circle cx="100" cy="100" r="88" fill="none" stroke="#9FDCBE" stroke-width="12" stroke-linecap="round" stroke-dasharray="{dash}"/></g></svg>')


def cover(d: dict, total: int) -> str:
    r = d["result"]
    acct = r.get("account") or {}
    kind = "Demo account" if acct.get("account_type") == "demo" else "Live account"
    hist = r.get("history") or {}
    trades = hist.get("closed_trades", 0)
    period = (r.get("period") or {}).get("label")
    record = " · ".join(x for x in [kind, period, f"{trades:,} {'trade' if trades == 1 else 'trades'}"] if x)
    if r.get("score_type") == "starter":
        s = r.get("starter") or {}
        middle = (f'<div style="margin-top:56px;width:440px">'
                  f'<div class="disp" style="font-size:32px;font-weight:700;letter-spacing:-0.03em;line-height:1.05;color:#9FDCBE">{e(s.get("heading"))}</div>'
                  f'<div style="margin-top:10px;font-size:15px;line-height:1.5;color:rgba(245,246,244,0.85)">{e(s.get("line"))}</div></div>')
    else:
        score = r.get("score") or 0
        band = r.get("band") or {}
        band_line = (r.get("early") or {}).get("line") if r.get("score_type") == "early" else \
            f"Band {BAND_RANGES.get(band.get('code'), '')} of four: Developing, Building, Emerging Manager, Professional Grade"
        middle = (
            '<div style="position:relative;margin-top:56px;height:200px">'
            f'<div style="position:absolute;top:0;left:0;width:200px;height:200px">{ring(score)}</div>'
            '<div style="position:absolute;top:0;left:0;width:200px;height:200px;text-align:center">'
            f'<div class="disp" style="padding-top:58px;font-size:76px;font-weight:700;letter-spacing:-0.05em;line-height:0.9">{score}</div>'
            '<div style="font-size:12px;font-weight:600;color:#C3CBD5;margin-top:4px">out of 100</div></div>'
            '<div style="position:absolute;top:50px;left:240px;right:0">'
            f'<div class="disp" style="font-size:32px;font-weight:700;letter-spacing:-0.03em;line-height:1.05;color:#9FDCBE">{e(band.get("name"))}</div>'
            f'<div style="margin-top:8px;font-size:15px;line-height:1.5;color:rgba(245,246,244,0.85)">{e(band.get("meaning"))}</div>'
            f'<div style="margin-top:14px;font-size:12px;color:#C3CBD5">{e(band_line)}</div></div></div>')
    cell = lambda label, value, left: (  # noqa: E731
        f'<td style="width:50%;padding:14px 0 14px {"20px" if left else "0"};border-bottom:1px solid rgba(245,246,244,0.18);vertical-align:top">'
        f'<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#C3CBD5">{label}</div>'
        f'<div style="margin-top:4px;font-size:15px;font-weight:600">{e(value)}</div></td>')
    account = f'{acct.get("platform") or "MT5"} · {"Demo" if acct.get("account_type") == "demo" else "Live"}'
    return (
        '<section class="page" style="color:#F5F6F4;background:linear-gradient(168deg,#0B1F3A 0%,#0B1F3A 40%,#0D2C3F 64%,#0E4A44 86%,#0E6B4F 116%);padding:56px 56px 40px">'
        '<div style="position:absolute;right:-30%;bottom:-20%;width:90%;height:60%;border-radius:50%;background:radial-gradient(closest-side,rgba(63,145,116,0.28),rgba(63,145,116,0))"></div>'
        '<table style="width:auto;table-layout:auto"><tr><td style="padding:0;vertical-align:middle"><img src="beta-mark-light.png" alt="Beta" style="height:26px;width:auto;display:block"></td>'
        '<td class="disp" style="padding:0 0 0 12px;vertical-align:middle;font-weight:700;font-size:24px;letter-spacing:-0.035em;line-height:1;color:#F5F6F4">beta</td>'
        '<td style="padding:0 0 0 12px;vertical-align:middle"><div style="width:1px;height:20px;background:rgba(245,246,244,0.24)"></div></td>'
        '<td style="padding:0 0 0 12px;vertical-align:middle;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#C3CBD5">The Manager Test</td></tr></table>'
        '<div style="margin-top:96px">'
        '<div style="font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9FDCBE">Manager-Readiness Report</div>'
        f'<h1 class="disp" style="margin:16px 0 0;font-size:52px;font-weight:700;letter-spacing:-0.045em;line-height:1;color:#F5F6F4">{e(d.get("name"))}</h1></div>'
        f'{middle}'
        '<div style="position:absolute;left:56px;right:56px;bottom:112px"><table style="border-top:1px solid rgba(245,246,244,0.18)">'
        f'<tr>{cell("Date", long_date(r["evaluation_date"]), False)}{cell("Broker", acct.get("broker") or "—", True)}</tr>'
        f'<tr>{cell("Account", account, False)}{cell("Record analyzed", record, True)}</tr></table></div>'
        f'{footer(1, total, dark=True)}</section>')


# ---------- 2 every metric ----------

COLS = '<colgroup><col style="width:47%"><col style="width:23.5%"><col style="width:29.5%"></colgroup>'


def metrics_page(d: dict, n: int, total: int) -> str:
    r = d["result"]
    priority = {f["metric"] for f in (r.get("top_fixes") or [])}
    rows = [f'<tr style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4C5A6E">'
            f'<td style="padding:0 0 8px;border-bottom:1.5px solid #0B1F3A">Metric</td><td style="padding:0 0 8px;border-bottom:1.5px solid #0B1F3A">You</td>'
            f'<td style="padding:0 0 8px;border-bottom:1.5px solid #0B1F3A">Full marks</td></tr>']
    for i, p in enumerate(r.get("pillars") or []):
        score = round(p["score"])
        rows.append(
            f'<tr><td colspan="3" style="padding:{12 if i == 0 else 14}px 0 6px"><table><tr>'
            f'<td class="disp" style="padding:0;font-size:16px;font-weight:700;color:#0B1F3A">{e(p["name"])} <span style="font-weight:500;color:#6B7684;font-size:12px">· {round(p["weight"] * 100)}%</span></td>'
            f'<td style="width:120px;padding:0 12px 0 0;vertical-align:middle">{bar(score, "120px", "6px")}</td>'
            f'<td class="disp" style="width:28px;padding:0;text-align:right;font-size:18px;font-weight:700;color:#0B1F3A">{score}</td></tr></table></td></tr>')
        for m in p["metrics"]:
            if m.get("insufficient"):
                value, colour = "Not enough data yet", "#6B7684"
            else:
                value = m.get("display") or "—"
                colour = "#A23B2E" if m["key"] in priority else "#0E6B4F" if (m.get("score") or 0) >= 100 else "#A9781F"
            td = 'style="padding:7px 12px 7px 0;border-bottom:1px solid #DDE2E7;font-size:12.5px"'
            rows.append(f'<tr><td {td}>{e(METRIC[m["key"]].advice_name)}</td><td {td}><b style="color:{colour}">{e(value)}</b></td>'
                        f'<td {td}>{e(full_marks(m["key"]))}</td></tr>')
    dot = lambda c, t: f'<span style="margin-right:18px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:{c};margin-right:6px"></span>{t}</span>'  # noqa: E731
    body = (kicker("Your five pillars") + h2("Every metric behind your score") +
            '<p style="margin:0 0 18px;font-size:13px;line-height:1.5;color:#4C5A6E">Each metric shows your value and the point that earns full marks.</p>'
            f'<table>{COLS}{"".join(rows)}</table>'
            f'<div style="margin-top:14px;font-size:11px;color:#4C5A6E">{dot("#0E6B4F", "Full marks")}{dot("#A9781F", "Below full marks")}{dot("#A23B2E", "Priority fix")}</div>')
    return page(body, n, total)


# ---------- starter read: what can already be measured ----------

def card(inner: str, style: str = "border:1px solid #DDE2E7") -> str:
    return f'<div style="margin-bottom:12px;padding:16px 18px;border-radius:14px;{style}">{inner}</div>'


def head_row(left: str, right: str) -> str:
    return f'<table><tr><td style="padding:0;vertical-align:top">{left}</td><td style="padding:0 0 0 16px;text-align:right;vertical-align:top;white-space:nowrap">{right}</td></tr></table>'


def starter_page(d: dict, n: int, total: int) -> str:
    s = d["result"].get("starter") or {}
    cards = []
    for m in s.get("metrics") or []:
        acts = "".join(f"<li>{e(a)}</li>" for a in (m.get("actions") or []))
        cards.append(card(
            head_row(f'<span style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7684">{e(m.get("name"))}</span>',
                     f'<span class="disp" style="font-size:16px;font-weight:700;color:#0B1F3A">{e(m.get("display"))}</span>')
            + f'<div style="margin-top:6px;font-size:13px;line-height:1.55">{e(m.get("text"))}</div>'
            + (f'<ol style="margin:6px 0 0;padding-left:18px;font-size:12.5px;line-height:1.6">{acts}</ol>' if acts else "")))
    return page(kicker("Your plan") + h2(s.get("heading") or "", "10px 0 20px") + "".join(cards), n, total)


# ---------- 3 coach notes (approved: built from the dashboard's coach-note cards) ----------

def coach_page(d: dict, n: int, total: int) -> str:
    coach = d.get("coach") or {}
    working = (coach.get("working") or [])[:3]
    costing = (coach.get("costing") or [])[:3]
    head = lambda t, line, colour: (  # noqa: E731
        f'<div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1.5px solid {line};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:{colour}">{t}</div>')
    w = "".join(f'<div style="margin-bottom:10px;padding:16px;border-radius:16px;background:#E7F1ED;font-size:14px;line-height:1.5;font-weight:500;color:#0B1F3A">{e(x["text"])}</div>' for x in working)
    c = "".join(
        f'<div style="margin-bottom:10px;padding:16px;border-radius:16px;background:#F5EBD6"><div style="font-size:14px;line-height:1.5;font-weight:500;color:#3D2C0B">{e(x["text"])}</div>'
        + (f'<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(122,90,22,0.2);font-size:13px;line-height:1.5;font-weight:700;color:#3D2C0B">{e(x["action"])}</div>' if x.get("action") else "")
        + '</div>' for x in costing)
    body = (kicker("Your coach notes") + '<div style="height:20px"></div>'
            '<table><colgroup><col style="width:50%"><col style="width:50%"></colgroup><tr>'
            f'<td style="padding:0 10px 0 0;vertical-align:top">{head("Working for you", "#0E6B4F", "#0E6B4F")}{w}</td>'
            f'<td style="padding:0 0 0 10px;vertical-align:top">{head("Costing you", "#A9781F", "#7A5A16")}{c}</td></tr></table>')
    return page(body, n, total)


# ---------- 4 red flags ----------

CLEAR = {
    "martingale": ("Martingale", "Doubling size after each loss to win it back. One bad run wipes out the account. We found no losing streak followed by stepped-up size."),
    "grid": ("Grid trading", "Stacking orders at fixed intervals with no stop. Looks steady until the market trends. We found no clusters of evenly spaced open positions."),
    "blown_account": ("Blown account", "A drawdown that took the account close to zero, or a margin stop-out. Your deepest drawdown was {dd}."),
}


def flag_card(name: str, text: str, state: str) -> str:
    styles = {"Clear": ("border:1px solid #DDE2E7", "#0B1F3A", pill("Clear", "#E7F1ED", "#0E6B4F"), "#1C2430"),
              "Found": ("border:1px solid rgba(162,59,46,0.25);background:#F5E4E1", "#7A2A20", pill("Found", "#FFFFFF", "#A23B2E"), "#1C2430"),
              "Watch": ("border:1px solid rgba(169,120,31,0.4);background:#F5EBD6", "#0B1F3A", pill("Watch", "#FFFFFF", "#7A5A16"), "#3D2C0B")}
    box, title_colour, badge, text_colour = styles[state]
    return card(head_row(f'<span class="disp" style="font-size:16px;font-weight:700;color:{title_colour}">{e(name)}</span>', badge)
                + f'<div style="margin-top:6px;font-size:12.5px;line-height:1.55;color:{text_colour}">{e(text)}</div>', box)


def metric_display(r: dict, key: str) -> str:
    return next((m.get("display") or "" for p in r.get("pillars") or [] for m in p["metrics"] if m["key"] == key), "")


def flags_page(d: dict, n: int, total: int) -> str:
    r = d["result"]
    found = {f["code"]: f for f in (r.get("red_flags") or [])}
    capping = [c for c in found if c in CLEAR]
    title = "No red flags found" if not found else (r.get("red_flag_panel") or {}).get("summary", "").split(".")[0]
    cards = [flag_card(name, found[code]["text"], "Found") if code in found else flag_card(name, text.replace("{dd}", metric_display(r, "max_drawdown")), "Clear")
             for code, (name, text) in CLEAR.items()]
    if "no_stops" in found:
        cards.append(flag_card(found["no_stops"].get("name") or "No stop losses", found["no_stops"]["text"], "Watch"))
    fixes = [f["metric"] for f in (r.get("top_fixes") or [])]
    if "revenge_sizing" in fixes:
        cards.append(flag_card("Revenge sizing", f"Not a cap, but worth fixing. After a loss, you trade {metric_display(r, 'revenge_sizing')} bigger. "
                               f"Investors read this as emotion driving size. It is fix {fixes.index('revenge_sizing') + 1} in your plan.", "Watch"))
    del capping
    body = (kicker("Red flags") + h2(title) +
            '<p style="margin:0 0 24px;font-size:13px;line-height:1.55;color:#4C5A6E;width:62ch">Some patterns tell an investor more than any score. We check every statement for them. Martingale, grid trading or a blown account caps your score at 40, whatever the profit.</p>'
            + "".join(cards) +
            '<div style="margin-top:10px;padding:18px 20px;border-radius:14px;background:#0B1F3A;color:#F5F6F4">'
            '<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9FDCBE">Why these cap your score</div>'
            '<div style="margin-top:6px;font-size:13px;line-height:1.55;color:rgba(245,246,244,0.88)">These strategies can show a smooth record for months and then lose everything in days. An investor can\'t see the risk in the result, so the score doesn\'t reward the result while they are present.</div></div>')
    return page(body, n, total)


# ---------- 5 your plan ----------

def plan_page(d: dict, n: int, total: int) -> str:
    r = d["result"]
    cards = []
    for i, f in enumerate((r.get("top_fixes") or [])[:3], start=1):
        pillar = PILLAR_NAME.get(METRIC[f["metric"]].pillar, "").upper()
        acts = "".join(f"<li>{e(a)}</li>" for a in f.get("actions") or [])
        cards.append(card(
            '<table><tr><td style="width:54px;padding:0;vertical-align:top">'
            f'<div class="disp" style="width:40px;height:40px;border-radius:12px;background:#0B1F3A;color:#FFFFFF;text-align:center;line-height:40px;font-weight:700;font-size:18px">{i}</div></td>'
            '<td style="padding:0;vertical-align:top">'
            f'<div class="disp" style="font-size:17px;font-weight:700;color:#0B1F3A">{e(f["name"])} <span style="font-size:11px;font-weight:600;color:#0E6B4F;letter-spacing:0.04em">· {e(pillar)}</span></div>'
            f'<ol style="margin:6px 0 0;padding-left:18px;font-size:12.5px;line-height:1.6">{acts}</ol></td></tr></table>'))
    retest = d.get("retest_date")
    body = (kicker("Your plan") + h2("Your top 3 fixes, step by step", "10px 0 20px") + "".join(cards) +
            ('<div style="margin-top:8px;padding:18px 20px;border-radius:14px;background:#E7F1ED">'
             + head_row('<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0E6B4F">Retest date</div>'
                        '<div style="margin-top:4px;font-size:13px;line-height:1.5;color:#0B1F3A">Apply these fixes, then take the test again with your new statement.</div>',
                        f'<span class="disp" style="font-size:24px;font-weight:700;letter-spacing:-0.025em;color:#0B1F3A">{e(long_date(retest))}</span>')
             + '</div>' if retest else ""))
    return page(body, n, total)


# ---------- 6 what managers are judged on (static, from the design) ----------

def judged_page(n: int, total: int) -> str:
    def row(num, title, text, pct, dark, num_colour):
        box = "background:#0B1F3A;color:#F5F6F4" if dark else "background:#FFFFFF;border:1px solid #DDE2E7"
        tc = "" if dark else "color:#0B1F3A;"
        text_style = "color:rgba(245,246,244,0.85)" if dark else ""
        return (f'<div style="margin-bottom:12px;padding:20px;border-radius:16px;{box}"><table><tr>'
                f'<td class="disp" style="width:80px;padding:0;font-size:40px;font-weight:700;letter-spacing:-0.04em;line-height:1;color:{num_colour}">{num}</td>'
                f'<td style="padding:0"><div class="disp" style="font-size:20px;font-weight:700;{tc}">{title}</div>'
                f'<div style="margin-top:4px;font-size:12.5px;line-height:1.5;{text_style}">{text}</div></td>'
                f'<td class="disp" style="width:88px;padding:0;font-size:26px;font-weight:700;{tc}text-align:right">{pct}</td></tr></table></div>')
    qs = ["What is the most this manager has ever lost, from peak to trough?", "Does every trade have a defined exit before it is opened?",
          "What happens to position size after a losing week?", "How long is the record, and how many trades is it built on?"]
    body = (kicker("How professional managers compare") + h2("What managers are judged on", "10px 0 8px") +
            '<p style="margin:0 0 26px;font-size:13px;line-height:1.55;color:#4C5A6E;width:60ch">An investor reads a record in a fixed order. Risk first, consistency second, returns last. Your score is weighted the same way.</p>'
            + row(1, "Risk first", "How much can they lose, and do they stick to their own limits? Risk control and discipline.", "45%", True, "#9FDCBE")
            + row(2, "Consistency second", "Is the result spread over many months and trades, or a few lucky days? Consistency and track record depth.", "35%", False, "#0E6B4F")
            + row(3, "Returns last", "Only measured against the risk taken to get them. Risk-adjusted return.", "20%", False, "#7C8AA0")
            + '<h3 class="disp" style="margin:30px 0 12px;font-size:18px;font-weight:700;color:#0B1F3A">Questions an investor asks before handing over capital</h3>'
            '<div style="border-top:1px solid #DDE2E7">'
            + "".join(f'<div style="padding:10px 0;border-bottom:1px solid #DDE2E7;font-size:13px">{q}</div>' for q in qs) + '</div>')
    return page(body, n, total, bg="#FAFAF8")


# ---------- 7 next step ----------

def display_link(url: str) -> str:
    return url.replace("https://", "").replace("http://", "").rstrip("/")


def next_page(d: dict, n: int, total: int) -> str:
    links = d.get("links") or {}
    when = (links.get("webinar_when") or "").strip()
    webinar = links.get("link_webinar") or ""
    room = links.get("link_managers_room") or ""
    beta = links.get("link_beta") or "https://betaapp.me"
    parts = [kicker("Next step"), h2("Where to go from here", "10px 0 22px")]
    if webinar:
        parts.append(
            '<div style="padding:24px;border-radius:16px;background:linear-gradient(162deg,#0E6B4F 0%,#0E4A44 50%,#0B1F3A 100%);color:#F5F6F4">'
            f'<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9FDCBE">Free webinar{" · " + e(when) if when else ""}</div>'
            '<div class="disp" style="margin-top:8px;font-size:24px;font-weight:700;letter-spacing:-0.025em;line-height:1.1">Your Money Management Journey Starts Here</div>'
            '<div style="margin-top:8px;font-size:13px;line-height:1.55;color:rgba(245,246,244,0.88)">From trading for friends to managing professionally, bring your score</div>'
            f'<a href="{e(webinar)}" style="display:block;margin-top:12px;font-size:13px;font-weight:700;color:#FFFFFF">{e(display_link(webinar))}</a></div>')
    tile = lambda label, title, url: (  # noqa: E731
        '<div style="padding:20px;border-radius:16px;border:1px solid #DDE2E7">'
        f'<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0E6B4F">{label}</div>'
        f'<div class="disp" style="margin-top:6px;font-size:18px;font-weight:700;color:#0B1F3A;line-height:1.15">{title}</div>'
        f'<a href="{e(url)}" style="display:block;margin-top:10px;font-size:12.5px;font-weight:600;color:#0B1F3A">{e(display_link(url))}</a></div>')
    tiles = ([tile("Telegram", "Join the Beta Managers Room", room)] if room else []) + [tile("Beta", "How traders manage money with Beta", beta)]
    cells = "".join(f'<td style="padding:0 {"6px" if i == 0 and len(tiles) == 2 else "0"} 0 {"6px" if i == 1 else "0"};vertical-align:top">{t}</td>' for i, t in enumerate(tiles))
    parts.append(f'<table style="margin-top:12px"><colgroup>{"<col style=\"width:50%\">" * len(tiles)}</colgroup><tr>{cells}</tr></table>')
    parts.append(
        '<div style="margin-top:24px;padding:22px;border-radius:16px;background:#E7F1ED"><table><tr>'
        '<td style="width:58px;padding:0;vertical-align:middle"><img src="beta-mark-dark.png" alt="Beta" style="height:40px;width:auto;display:block"></td>'
        '<td style="padding:0;vertical-align:middle"><div class="disp" style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#0B1F3A">Managed, never held.</div>'
        '<div style="margin-top:4px;font-size:12.5px;line-height:1.55">With Beta, client capital stays in the client\'s own broker account, in their name. The manager directs the trading through a real agreement.</div></td></tr></table></div>'
        '<div style="margin-top:24px;padding:18px 20px;border:1px solid #DDE2E7;border-radius:14px">'
        '<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#4C5A6E">Disclaimer</div>'
        f'<div style="margin-top:6px;font-size:12.5px;line-height:1.6;color:#1C2430">{DISCLAIMER}</div></div>')
    return page("".join(parts), n, total)


# ---------- assembly ----------

BASE_CSS = """
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; }
* { box-sizing: border-box; }
a { color: #0E6B4F; text-decoration: none; }
body { font-family: 'Inter', sans-serif; }
.disp { font-family: 'Inter Tight', 'Inter', sans-serif; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
td { padding: 0; }
.page { position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; }
.page:last-child { page-break-after: auto; }
.foot { position: absolute; left: 52px; right: 52px; bottom: 36px; }
"""


def page_list(d: dict) -> list[str]:
    starter = d["result"].get("score_type") == "starter"
    return ["cover", "starter", "judged", "next"] if starter else ["cover", "metrics", "coach", "flags", "plan", "judged", "next"]


def plan_page_number(d: dict) -> int:
    return page_list(d).index("starter" if d["result"].get("score_type") == "starter" else "plan") + 1


def build_html(d: dict) -> str:
    names = page_list(d)
    total = len(names)
    out = []
    for i, name in enumerate(names, start=1):
        if name == "cover":
            out.append(cover(d, total))
        elif name == "metrics":
            out.append(metrics_page(d, i, total))
        elif name == "starter":
            out.append(starter_page(d, i, total))
        elif name == "coach":
            out.append(coach_page(d, i, total))
        elif name == "flags":
            out.append(flags_page(d, i, total))
        elif name == "plan":
            out.append(plan_page(d, i, total))
        elif name == "judged":
            out.append(judged_page(i, total))
        else:
            out.append(next_page(d, i, total))
    fonts = (ASSETS / "fonts.css").read_text()
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Manager-Readiness Report</title>'
            f'<style>{fonts}{BASE_CSS}</style></head><body>{"".join(out)}</body></html>')


def render_pdf(d: dict) -> bytes:
    from weasyprint import HTML  # imported here: the scoring endpoints don't need it
    return HTML(string=build_html(d), base_url=str(ASSETS) + "/").write_pdf()
