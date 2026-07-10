#!/usr/bin/env bash
# Start Optikos with the BACKEND running as root so macOS reveals real WiFi
# network names (SSIDs) + BSSIDs via the CoreWLAN active scan. The frontend
# runs as your normal user.
#
# Why root? On modern macOS, SSID names are location-gated and get redacted to
# "<redacted>" for unprivileged processes. Running the scan as root bypasses
# that. Only the read-only WiFi backend is elevated — nothing is modified.
#
# Usage:  ./run-sudo.sh      (you'll be asked for your password once)
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if [ ! -d ".venv" ]; then
  echo "==> Creating Python venv"
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
echo "==> Installing backend deps"
pip install -q -r backend/requirements.txt

echo "==> Requesting sudo (needed so the WiFi scan can read real SSID names)"
sudo -v

VENV_PY="$ROOT/.venv/bin/python"

echo "==> Starting backend (as root) on http://127.0.0.1:8000"
sudo "$VENV_PY" -m uvicorn app.main:app \
  --app-dir "$ROOT/backend" \
  --host 127.0.0.1 --port 8000 --log-level warning &
BACKEND_PID=$!

echo -n "==> Waiting for backend to be ready"
for _ in $(seq 1 40); do
  if curl -sf http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    echo " — ready."
    break
  fi
  echo -n "."
  sleep 0.5
done

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
  # Backend runs as root, so it must be killed with sudo.
  sudo kill "$BACKEND_PID" 2>/dev/null || true
  kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo ""
echo "  Optikos (privileged scan) — open http://localhost:5173"
echo "  Check the top-right 'scan' pill: 'corewlan (names available)' = real names."
echo "  (Ctrl+C to stop)"
echo ""
wait
