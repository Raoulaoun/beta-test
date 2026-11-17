"""Trading-account fingerprint: HMAC of number + server; the number is never kept."""

import hashlib
import hmac
import json
from datetime import date

import pytest

import synth
from manager_test import evaluate
from manager_test.fingerprint import ENV, account_fingerprint

EVAL = date(2026, 11, 10)


@pytest.fixture
def secret(monkeypatch):
    monkeypatch.setenv(ENV, "test-secret-not-for-production")
    return "test-secret-not-for-production"


def test_no_secret_no_fingerprint(monkeypatch):
    monkeypatch.delenv(ENV, raising=False)
    assert account_fingerprint("51234567", "Example-Live") is None
    assert evaluate(synth.to_xlsx(synth.disciplined()), EVAL)["account"]["fingerprint"] is None


def test_fingerprint_is_hmac_sha256_of_number_and_server(secret):
    expected = hmac.new(secret.encode(), b"51234567|example-live", hashlib.sha256).hexdigest()
    assert account_fingerprint("51234567", "Example-Live") == expected
    assert account_fingerprint("51234567", "  example-LIVE ") == expected  # case/space-insensitive server


def test_fingerprint_separates_accounts_and_servers(secret):
    a = account_fingerprint("51234567", "Example-Live")
    assert a != account_fingerprint("51234568", "Example-Live")
    assert a != account_fingerprint("51234567", "Other-Live")


@pytest.mark.parametrize("fmt", ["xlsx", "html", "mt4"])
def test_same_account_same_fingerprint_across_uploads(secret, fmt):
    to = {"xlsx": synth.to_xlsx, "html": synth.to_html, "mt4": synth.to_mt4_html}[fmt]
    rep = synth.disciplined()
    r1, r2 = evaluate(to(rep), EVAL), evaluate(to(synth.short_history()), EVAL)
    assert r1["account"]["fingerprint"] and r1["account"]["fingerprint"] == r2["account"]["fingerprint"]
    blob = json.dumps(r1)
    assert rep.account not in blob and rep.account[1:] not in blob


def test_mt4_fingerprint_uses_the_broker_name(secret):
    rep = synth.disciplined()
    mt4 = evaluate(synth.to_mt4_html(rep), EVAL)["account"]["fingerprint"]
    assert mt4 == account_fingerprint(rep.account, rep.company)


def test_evaluate_statement_scores_a_parsed_statement():
    from manager_test import evaluate_statement
    from manager_test.parse import parse_statement
    data = synth.to_xlsx(synth.disciplined())
    a = evaluate(data, EVAL)
    b = evaluate_statement(parse_statement(data), EVAL)
    assert a == b and a["source"] == "upload"
