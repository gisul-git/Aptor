#!/bin/bash
#
# preinstall.sh - macOS pre-install script for AI Competency Agent
#
# Responsibilities:
# - Stop any running agent process
# - Unload existing LaunchAgent (if present)
# - Remove previous /Applications/AptorAgent installation (if present)
# - Create application and log directories

set -euo pipefail

AGENT_APP="/Applications/AptorAgent"
LAUNCH_AGENT_PLIST="$HOME/Library/LaunchAgents/com.aptor.aiagent.plist"
LOG_DIR="$HOME/Library/Logs/AptorAgent"

echo "[preinstall] Unloading existing LaunchAgent (if any)..."
if [ -f "$LAUNCH_AGENT_PLIST" ]; then
  launchctl unload "$LAUNCH_AGENT_PLIST" 2>/dev/null || true
fi

echo "[preinstall] Stopping any running agent processes..."
pkill -f "python3 -m agent" 2>/dev/null || true

echo "[preinstall] Removing previous installation at $AGENT_APP (if any)..."
rm -rf "$AGENT_APP"

echo "[preinstall] Creating application directory..."
mkdir -p "$AGENT_APP"

echo "[preinstall] Creating log directory..."
mkdir -p "$LOG_DIR"

exit 0

