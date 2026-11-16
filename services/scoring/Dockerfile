# Scoring service. Build context: repo root (it needs docs/advice-texts.md at runtime).
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    ADVICE_TEXTS_PATH=/app/docs/advice-texts.md
WORKDIR /app/services/scoring
COPY services/scoring/requirements.txt .
RUN pip install -r requirements.txt
# Explicit modes: the service runs as nobody, whatever the permissions in the checkout.
# (--chmod also applies to folders COPY creates, so /app/docs is made first.)
RUN mkdir -m 0755 /app/docs
COPY --chmod=0755 services/scoring/manager_test ./manager_test
COPY --chmod=0644 docs/advice-texts.md /app/docs/advice-texts.md
USER nobody
# Listens on $PORT, on :: when IPv6 is available (Railway private network), else 0.0.0.0.
CMD ["python", "-m", "manager_test.serve"]
