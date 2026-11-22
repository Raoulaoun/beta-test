"""Stateless HTTP API. The upload is read into memory, scored and dropped.

The file is sent as the raw request body (application/octet-stream), not as
multipart: Starlette spools multipart uploads over 1 MB to a temp file on disk,
which the privacy rule forbids. Request bodies and statement contents are never
logged. Errors return a stable code that the web app maps to approved copy.
"""

from datetime import date

from fastapi import FastAPI, Query, Request
from fastapi.responses import JSONResponse, Response

from . import fingerprint, texts
from .engine import evaluate
from .errors import FileTooLarge, StatementError
from .parse.grid import MAX_BYTES
from .version import SCORING_VERSION

PDF_MAX_BYTES = 1_000_000  # a stored result and its notes: a few kilobytes

app = FastAPI(title="Manager Test scoring", docs_url=None, redoc_url=None, openapi_url=None)


def _error(exc: StatementError) -> JSONResponse:
    status = 413 if isinstance(exc, FileTooLarge) else 422
    return JSONResponse(status_code=status, content={"error": exc.code, "message": exc.message})


@app.get("/health")
def health():
    # Also proves the approved copy is readable: without it every score would fail,
    # so a deploy that can't read it must fail its health check instead.
    try:
        t = texts.load()
        ready = bool(t["advice"] and t["headlines"] and t["panel"] and t["red_flags"])
    except OSError:
        ready = False
    if not ready:
        return JSONResponse(status_code=503, content={"ok": False, "error": "advice_texts_unreadable"})
    return {"ok": True, "scoring_version": SCORING_VERSION, "fingerprint": fingerprint.enabled()}


@app.post("/score")
async def score(request: Request, evaluation_date: date | None = Query(None)):
    buf = bytearray()
    async for chunk in request.stream():
        buf.extend(chunk)
        if len(buf) > MAX_BYTES:
            return _error(FileTooLarge())
    try:
        return evaluate(bytes(buf), evaluation_date)
    except StatementError as exc:
        return _error(exc)
    except Exception:
        # Never echo internals: they could carry statement content.
        return JSONResponse(status_code=500, content={"error": "scoring_failed"})
    finally:
        buf.clear()


@app.post("/pdf")
async def pdf(request: Request):
    """The PDF report from a stored result (JSON: result, name, coach, links, retest_date).
    Rendered in memory and returned; nothing is kept."""
    body = await request.body()
    if len(body) > PDF_MAX_BYTES:
        return JSONResponse(status_code=413, content={"error": "too_large"})
    try:
        import json
        data = json.loads(body)
        if not isinstance(data, dict) or not isinstance(data.get("result"), dict):
            return JSONResponse(status_code=422, content={"error": "bad_request"})
        from .pdf import render_pdf
        return Response(content=render_pdf(data), media_type="application/pdf")
    except (ValueError, KeyError, TypeError):
        return JSONResponse(status_code=422, content={"error": "bad_request"})
    except Exception:
        return JSONResponse(status_code=500, content={"error": "pdf_failed"})
