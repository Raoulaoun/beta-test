import logging

from fastapi.testclient import TestClient

import synth
from manager_test.api import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["scoring_version"]


def test_score_raw_body():
    data = synth.to_xlsx(synth.disciplined())
    r = client.post("/score?evaluation_date=2026-11-10", content=data,
                    headers={"content-type": "application/octet-stream"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "full" and body["score"] >= 75
    assert body["evaluation_date"] == "2026-11-10"


def test_score_errors_have_codes():
    r = client.post("/score", content=b"hello")
    assert r.status_code == 422
    assert r.json() == {"error": "not_a_report", "message": "We couldn't read this file. Upload the statement exported from MT4 or MT5. The guide below shows how."}
    assert client.post("/score", content=synth.MT4_HTML).json()["error"] == "empty_report"


def test_mt4_statement_scores_through_the_api():
    r = client.post("/score?evaluation_date=2026-11-10", content=synth.to_mt4_html(synth.disciplined()))
    assert r.status_code == 200 and r.json()["account"]["platform"] == "MT4" and r.json()["score"] >= 75


def test_too_large():
    r = client.post("/score", content=b"x" * (10 * 1024 * 1024 + 1))
    assert r.status_code == 413 and r.json()["error"] == "file_too_large"


def test_api_never_logs_account_number(caplog):
    rep = synth.disciplined()
    caplog.set_level(logging.DEBUG)
    r = client.post("/score", content=synth.to_html(rep))
    assert rep.account not in caplog.text
    assert rep.account not in r.text


def test_health_fails_when_advice_texts_unreadable(monkeypatch, tmp_path):
    from manager_test import texts
    texts.load.cache_clear()
    monkeypatch.setenv("ADVICE_TEXTS_PATH", str(tmp_path / "missing.md"))
    try:
        r = client.get("/health")
        assert r.status_code == 503 and r.json()["error"] == "advice_texts_unreadable"
    finally:
        monkeypatch.delenv("ADVICE_TEXTS_PATH")
        texts.load.cache_clear()
    assert client.get("/health").status_code == 200
