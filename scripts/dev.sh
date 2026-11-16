#!/usr/bin/env bash
# Run the scoring service (port 8000) and the web app (port 3000) together.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
(cd "$ROOT/services/scoring" && python3 -m uvicorn manager_test.api:app --port 8000 --no-access-log) &
SCORING=$!
trap 'kill $SCORING 2>/dev/null' EXIT
cd "$ROOT/apps/web" && SCORING_URL=http://127.0.0.1:8000 npx next dev -p 3000
