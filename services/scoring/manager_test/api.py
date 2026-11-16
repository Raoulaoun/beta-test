"""Stateless HTTP API. The upload is read into memory, scored and dropped.

The file is sent as the raw request body (application/octet-stream), not as
multipart: Starlette spools multipart uploads over 1 MB to a temp file on disk,
which the privacy rule forbids. Request bodies and statement contents are never
logged. Errors return a stable code that the web app maps to approved copy.
"""

from datetime import date

from fastapi import FastAPI, Query, Request
from fastapi.responses import JSONResponse

from .engine import evaluate
from .errors import FileTooLarge, StatementError
from .parse.grid import MAX_BYTES
from .version import SCORING_VERSION

app = FastAPI(title="Manager Test scoring", docs_url=None, redoc_url=None, openapi_url=None)


def _error(exc: StatementError) -> JSONResponse:
    status = 413 if isinstance(exc, FileTooLarge) else 422
    return JSONResponse(status_code=status, content={"error": exc.code, "message": exc.message})


@app.get("/health")
def health() -> dict:
    return {"ok": True, "scoring_version": SCORING_VERSION}


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
