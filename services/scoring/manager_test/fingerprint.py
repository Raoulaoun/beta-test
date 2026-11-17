"""Pseudonymous trading-account fingerprint.

HMAC-SHA256 of the account number and broker server, keyed with a secret that lives
outside the database (ACCOUNT_FINGERPRINT_SECRET). It lets results from the same trading
account be grouped without ever storing the number. Without the secret it can't be
reversed or recomputed. If the secret isn't set, no fingerprint is produced.
"""

import hashlib
import hmac
import os
import re

ENV = "ACCOUNT_FINGERPRINT_SECRET"


def account_fingerprint(account_number: str | None, server: str | None) -> str | None:
    secret = os.environ.get(ENV)
    digits = re.sub(r"\D", "", account_number or "")
    if not secret or not digits:
        return None
    server_key = " ".join((server or "").lower().split())
    msg = f"{digits}|{server_key}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def enabled() -> bool:
    return bool(os.environ.get(ENV))
