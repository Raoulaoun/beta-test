"""PDF report: pages, content from the stored result only, no account digits, the endpoint."""

import pytest
from fastapi.testclient import TestClient

import synth
from manager_test import evaluate
from manager_test.api import app
from manager_test.pdf import build_html, full_marks, render_pdf
from manager_test.score import METRICS

LINKS = {"link_webinar": "https://betaapp.me/managers/webinar", "link_managers_room": "https://t.me/betamanagers",
         "link_beta": "https://betaapp.me", "webinar_when": "Thursday 26 November · 8:00 PM Beirut"}


def report(rep, **kw):
    r = evaluate(synth.to_xlsx(rep))
    f = (r.get("coach") or {}).get("findings", [])
    return {"result": r, "name": "Karim Haddad", "retest_date": "2027-01-15", "links": LINKS,
            "coach": {"working": [x for x in f if x["polarity"] == "working"], "costing": [x for x in f if x["polarity"] == "costing"]}, **kw}


def pages(d: dict) -> int:
    from weasyprint import HTML
    from manager_test.pdf import ASSETS
    return len(HTML(string=build_html(d), base_url=str(ASSETS) + "/").render().pages)


@pytest.fixture(scope="module")
def gambler():
    return report(synth.martingale_gambler())


def test_seven_pages_and_every_metric(gambler):
    html = build_html(gambler)
    assert html.count('class="page"') == 7
    for m in METRICS:
        assert m.advice_name in html, m.key
    assert "The Manager Test by Beta · 7 of 7" in html
    assert html.count("educational purposes only") >= 7, "disclaimer on every page"


def test_found_flags_use_the_approved_explanations(gambler):
    html = build_html(gambler)
    explanation = next(f["text"] for f in gambler["result"]["red_flags"] if f["code"] == "martingale")
    assert explanation.replace("'", "&#x27;") in html
    assert ">Found<" in html


def test_no_account_digits_and_no_professional_range_column(gambler):
    html = build_html(gambler)
    assert "Pro managers" not in html and "professional range" not in html
    assert "51234567" not in html and "•••" not in html
    assert "MT5 · Live" in html


def test_webinar_date_and_links_from_settings(gambler):
    html = build_html(gambler)
    assert "Free webinar · Thursday 26 November · 8:00 PM Beirut" in html
    assert "t.me/betamanagers" in html
    no_date = build_html({**gambler, "links": {**LINKS, "webinar_when": ""}})
    assert "Free webinar<" in no_date


def test_full_marks_in_words():
    assert full_marks("max_drawdown") == "10.0% or less"
    assert full_marks("profit_factor") == "1.80 or more"
    assert full_marks("adding_to_losers") == "0%"


def test_starter_read_gets_four_pages():
    d = report(synth.few_trades(3))
    assert build_html(d).count('class="page"') == 4 and pages(d) == 4


def test_renders_quickly_to_a_seven_page_pdf(gambler):
    import time
    t = time.time()
    pdf = render_pdf(gambler)
    assert pdf[:5] == b"%PDF-"
    assert time.time() - t < 10
    assert pages(gambler) == 7, "no page overflows"


def test_endpoint(gambler):
    c = TestClient(app)
    res = c.post("/pdf", json=gambler)
    assert res.status_code == 200 and res.headers["content-type"] == "application/pdf" and res.content[:5] == b"%PDF-"
    assert c.post("/pdf", content=b"not json").status_code == 422
    assert c.post("/pdf", json={"nope": 1}).status_code == 422
    assert c.post("/pdf", content=b"x" * 1_000_001).status_code == 413
