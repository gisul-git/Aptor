#!/bin/bash
#
# Post-install script for AI Competency Agent macOS package
#
# This script runs after the package files are installed and:
# 1. Creates necessary directories
# 2. Sets proper permissions
# 3. Installs LaunchAgent plist
# 4. Loads the LaunchAgent to start the service
#
# This script is called automatically by the .pkg installer.

set -e  # Exit on error

# Configuration
AGENT_NAME="aicompetency-agent"
AGENT_BIN="/usr/local/bin/${AGENT_NAME}"
AGENT_DIR="/usr/local/var/lib/${AGENT_NAME}"
LOG_DIR="/usr/local/var/log/${AGENT_NAME}"
PLIST_NAME="com.aicompetency.agent.plist"
PLIST_SOURCE="/usr/local/lib/${AGENT_NAME}/${PLIST_NAME}"
PLIST_DEST="${HOME}/Library/LaunchAgents/${PLIST_NAME}"

echo "AI Competency Agent - Post-installation setup"
echo "=============================================="

# Check if running as root (for system-wide install) or user (for user install)
if [ "$EUID" -eq 0 ]; then
    echo "Installing system-wide..."
    PLIST_DEST="/Library/LaunchAgents/${PLIST_NAME}"
    USER_HOME="/Users/$(stat -f '%Su' /dev/console)"
else
    echo "Installing for current user: $USER"
    USER_HOME="$HOME"
    PLIST_DEST="${HOME}/Library/LaunchAgents/${PLIST_NAME}"
fi

# Create directories
echo "Creating directories..."
mkdir -p "$AGENT_DIR"
mkdir -p "$LOG_DIR"
mkdir -p "$(dirname "$PLIST_DEST")"
mkdir -p "$AGENT_DIR/uploads"

# Set permissions
echo "Setting permissions..."
chmod 755 "$AGENT_BIN"
chmod 755 "$AGENT_DIR"
chmod 755 "$LOG_DIR"
chown -R "$USER" "$AGENT_DIR" "$LOG_DIR" 2>/dev/null || true

# Check if agent binary exists
if [ ! -f "$AGENT_BIN" ]; then
    echo "ERROR: Agent binary not found at $AGENT_BIN"
    exit 1
fi

# Stop existing service if running
echo "Stopping existing service (if running)..."
if [ -f "$PLIST_DEST" ]; then
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
    # Also try with full path
    launchctl unload -w "$PLIST_DEST" 2>/dev/null || true
fi

# Install LaunchAgent plist
echo "Installing LaunchAgent..."
if [ -f "$PLIST_SOURCE" ]; then
    # Copy from package location
    cp "$PLIST_SOURCE" "$PLIST_DEST"
elif [ -f "/tmp/${PLIST_NAME}" ]; then
    # Copy from temp location (if package extracted there)
    cp "/tmp/${PLIST_NAME}" "$PLIST_DEST"
else
    echo "WARNING: LaunchAgent plist not found. Service will not auto-start."
    echo "You can manually install the plist from the package."
fi

# Update plist with correct paths if needed
if [ -f "$PLIST_DEST" ]; then
    # Ensure the plist has correct binary path
    /usr/libexec/PlistBuddy -c "Set :ProgramArguments:0 $AGENT_BIN" "$PLIST_DEST" 2>/dev/null || true
    
    # Set correct log paths
    /usr/libexec/PlistBuddy -c "Set :StandardOutPath $LOG_DIR/agent.log" "$PLIST_DEST" 2>/dev/null || true
    /usr/libexec/PlistBuddy -c "Set :StandardErrorPath $LOG_DIR/agent.error.log" "$PLIST_DEST" 2>/dev/null || true
    
    # Set correct working directory
    /usr/libexec/PlistBuddy -c "Set :WorkingDirectory $AGENT_DIR" "$PLIST_DEST" 2>/dev/null || true
    
    chmod 644 "$PLIST_DEST"
    echo "LaunchAgent installed: $PLIST_DEST"
fi

# Load the LaunchAgent
echo "Loading LaunchAgent..."
if [ -f "$PLIST_DEST" ]; then
    launchctl load -w "$PLIST_DEST" 2>/dev/null || {
        echo "WARNING: Failed to load LaunchAgent automatically."
        echo "You may need to log out and log back in, or run:"
        echo "  launchctl load -w $PLIST_DEST"
    }
    
    # Give it a moment to start
    sleep 2
    
    # Check if it's running
    if launchctl list | grep -q "com.aicompetency.agent"; then
        echo "Service started successfully!"
    else
        echo "Service may take a moment to start. Check status with:"
        echo "  launchctl list | grep aicompetency"
    fi
else
    echo "WARNING: LaunchAgent plist not found. Service not started."
fi

echo ""
echo "Installation complete!"
echo "===================="
echo "Agent binary: $AGENT_BIN"
echo "Agent directory: $AGENT_DIR"
echo "Log directory: $LOG_DIR"
echo "LaunchAgent: $PLIST_DEST"
echo ""
echo "WebSocket server: ws://127.0.0.1:8889"
echo ""
echo "To check service status:"
echo "  launchctl list | grep aicompetency"
echo ""
echo "To view logs:"
echo "  tail -f $LOG_DIR/agent.log"
echo ""

exit 0
