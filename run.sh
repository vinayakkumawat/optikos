#!/usr/bin/env bash
# Start the Optikos backend (FastAPI) and frontend (Vite) together.
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# --- backend ---------------------------------------------------------------
if [ ! -d ".venv" ]; then
  echo "==> Creating Python venv"
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
echo "==> Installing backend deps"
pip install -q -r backend/requirements.txt

echo "==> Starting backend on http://127.0.0.1:8000"
(cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level warning) &
BACKEND_PID=$!

# Wait for the backend to answer its health check before starting the frontend,
# so the dashboard never tries to connect to a not-yet-listening server.
echo -n "==> Waiting for backend to be ready"
for _ in $(seq 1 40); do
  if curl -sf http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    echo " — ready."
    break
  fi
  # Bail out early if the backend process died (e.g. port already in use).
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo ""
    echo "!! Backend failed to start. Is port 8000 already in use?"
    echo "   Check with: lsof -nP -iTCP:8000 -sTCP:LISTEN"
    exit 1
  fi
  echo -n "."
  sleep 0.5
done

# --- frontend --------------------------------------------------------------
if [ ! -d "frontend/node_modules" ]; then
  echo "==> Installing frontend deps"
  (cd frontend && npm install)
fi

echo "==> Starting frontend on http://localhost:5173"
(cd frontend && npm run dev) &
FRONTEND_PID=$!

cleanup() {
  echo ""
  echo "==> Shutting down"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo ""
echo "  Optikos is starting — open http://localhost:5173"
echo "  (Ctrl+C to stop)"
echo ""
wait
