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
    assert body["status"] == "scored" and body["score"] >= 75
    assert body["evaluation_date"] == "2026-11-10"


def test_score_errors_have_codes():
    r = client.post("/score", content=synth.MT4_HTML)
    assert r.status_code == 422
    assert r.json() == {"error": "mt4_file", "message": "This looks like an MT4 file, we only support MT5 for now"}
    assert client.post("/score", content=b"hello").json()["error"] == "not_a_report"


def test_too_large():
    r = client.post("/score", content=b"x" * (10 * 1024 * 1024 + 1))
    assert r.status_code == 413 and r.json()["error"] == "file_too_large"


def test_api_never_logs_account_number(caplog):
    rep = synth.disciplined()
    caplog.set_level(logging.DEBUG)
    r = client.post("/score", content=synth.to_html(rep))
    assert rep.account not in caplog.text
    assert rep.account not in r.text
