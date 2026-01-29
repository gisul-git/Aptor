#!/bin/bash
#
# postinstall.sh - macOS post-install script for AI Competency Agent
#
# Responsibilities:
# - Ensure pip is available (ensurepip)
# - Install agent dependencies from requirements.txt (if present)
# - Register ipykernel (best-effort)
# - Install LaunchAgent plist into ~/Library/LaunchAgents
# - Set proper permissions
# - Load LaunchAgent and start the agent
# - Optionally verify port 8889 is listening

set -euo pipefail

AGENT_APP="/Applications/AptorAgent"
PYTHON_BIN="$AGENT_APP/python/bin/python3"
AGENT_DIR="$AGENT_APP/agent"
LAUNCH_AGENT_DEST="$HOME/Library/LaunchAgents/com.aptor.aiagent.plist"
LOG_DIR="$HOME/Library/Logs/AptorAgent"

echo "[postinstall] Ensuring log directory exists..."
mkdir -p "$LOG_DIR"

if [ ! -x "$PYTHON_BIN" ]; then
  echo "[postinstall] ERROR: Python binary not found at $PYTHON_BIN"
  exit 1
fi

echo "[postinstall] Ensuring pip is installed..."
set +e
"$PYTHON_BIN" -m ensurepip --upgrade 2>/dev/null
ENSUREPIP_RC=$?
set -e
if [ $ENSUREPIP_RC -ne 0 ]; then
  echo "[postinstall] Warning: ensurepip failed or is unavailable; pip may already be present."
fi

if [ -f "$AGENT_DIR/requirements.txt" ]; then
  echo "[postinstall] Installing Python dependencies from requirements.txt..."
  "$PYTHON_BIN" -m pip install --upgrade pip setuptools wheel
  "$PYTHON_BIN" -m pip install -r "$AGENT_DIR/requirements.txt"
else
  echo "[postinstall] No requirements.txt found at $AGENT_DIR/requirements.txt; skipping dependency install."
fi

echo "[postinstall] Attempting to register ipykernel (best-effort)..."
set +e
"$PYTHON_BIN" -m ipykernel install --user --name "aicompetency-agent" --display-name "AI Competency Agent" 2>/dev/null
set -e

echo "[postinstall] Installing LaunchAgent plist..."
if [ -f "$AGENT_APP/com.aptor.aiagent.plist" ]; then
  mkdir -p "$(dirname "$LAUNCH_AGENT_DEST")"
  cp "$AGENT_APP/com.aptor.aiagent.plist" "$LAUNCH_AGENT_DEST"
  chmod 644 "$LAUNCH_AGENT_DEST"
else
  echo "[postinstall] ERROR: com.aptor.aiagent.plist not found in $AGENT_APP"
  exit 1
fi

echo "[postinstall] Loading LaunchAgent..."
set +e
launchctl unload "$LAUNCH_AGENT_DEST" 2>/dev/null
set -e
launchctl load "$LAUNCH_AGENT_DEST"

echo "[postinstall] Waiting a few seconds for agent to start..."
sleep 5

echo "[postinstall] Verifying that port 8889 is listening..."
set +e
if command -v lsof >/dev/null 2>&1; then
  lsof -i tcp:8889 | grep LISTEN >/dev/null 2>&1
  RC=$?
else
  # Fallback to netstat (legacy)
  netstat -an | grep "\.8889 " | grep LISTEN >/dev/null 2>&1
  RC=$?
fi
set -e

if [ ${RC:-1} -eq 0 ]; then
  echo "[postinstall] SUCCESS: AI Competency Agent is listening on ws://127.0.0.1:8889"
else
  echo "[postinstall] WARNING: Port 8889 is not listening yet. The agent may still be starting or may have failed."
  echo "[postinstall] Check logs in $LOG_DIR for details."
fi

exit 0

