#!/bin/sh
set -e

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"
WORKERS="${UVICORN_WORKERS:-2}"
KEEP_ALIVE="${UVICORN_TIMEOUT_KEEP_ALIVE:-30}"

exec uvicorn app.main:app \
  --host "$HOST" \
  --port "$PORT" \
  --workers "$WORKERS" \
  --proxy-headers \
  --timeout-keep-alive "$KEEP_ALIVE"
