#!/bin/bash
#
# Build script for Debian .deb package
#
# This script creates a Debian package (.deb) that:
# 1. Installs the agent executable to /usr/bin
# 2. Installs systemd user service for auto-start
# 3. Creates necessary directories
# 4. Sets up logging
#
# Usage:
#   ./build_deb.sh
#
# Requirements:
#   - Linux (Debian/Ubuntu for building)
#   - Agent executable built (run build_linux.py first)
#   - dpkg-deb or dpkg-buildpackage
#   - fakeroot (for building without root)

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
INSTALLER_DIR="$SCRIPT_DIR"
BUILD_DIR="$INSTALLER_DIR/build"
DIST_DIR="$INSTALLER_DIR/dist"
PKG_NAME="aicompetency-agent"
VERSION="1.0.0"
ARCH="amd64"

echo "=========================================="
echo "AI Competency Agent - Debian Package Builder"
echo "=========================================="
echo ""

# Check if we're on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "WARNING: This script is designed for Linux. Continuing anyway..."
fi

# Check if agent executable exists
AGENT_EXE="$DIST_DIR/aicompetency-agent"
if [ ! -f "$AGENT_EXE" ]; then
    echo "ERROR: Agent executable not found: $AGENT_EXE"
    echo "Please run build_linux.py first to build the executable"
    exit 1
fi

echo "Agent executable: $AGENT_EXE"
echo ""

# Create package directory structure
PKG_ROOT="$BUILD_DIR/${PKG_NAME}_${VERSION}_${ARCH}"
echo "Creating package structure..."
rm -rf "$PKG_ROOT"
mkdir -p "$PKG_ROOT/usr/bin"
mkdir -p "$PKG_ROOT/usr/lib/systemd/user"
mkdir -p "$PKG_ROOT/var/lib/${PKG_NAME}"
mkdir -p "$PKG_ROOT/var/lib/${PKG_NAME}/uploads"
mkdir -p "$PKG_ROOT/var/log/${PKG_NAME}"
mkdir -p "$PKG_ROOT/DEBIAN"

# Copy agent executable
echo "Copying agent executable..."
cp "$AGENT_EXE" "$PKG_ROOT/usr/bin/${PKG_NAME}"
chmod 755 "$PKG_ROOT/usr/bin/${PKG_NAME}"

# Copy systemd service file
echo "Copying systemd service file..."
cp "$INSTALLER_DIR/${PKG_NAME}.service" "$PKG_ROOT/usr/lib/systemd/user/"

# Copy DEBIAN control files
echo "Copying DEBIAN control files..."
cp "$INSTALLER_DIR/DEBIAN/control" "$PKG_ROOT/DEBIAN/"
cp "$INSTALLER_DIR/DEBIAN/postinst" "$PKG_ROOT/DEBIAN/"
chmod 755 "$PKG_ROOT/DEBIAN/postinst"

# Create DEBIAN/conffiles (if needed)
# echo "/etc/aicompetency-agent/config.json" > "$PKG_ROOT/DEBIAN/conffiles" 2>/dev/null || true

# Calculate installed size
INSTALLED_SIZE=$(du -sk "$PKG_ROOT" | cut -f1)
sed -i "s/^Installed-Size:.*/Installed-Size: $INSTALLED_SIZE/" "$PKG_ROOT/DEBIAN/control"

# Build the .deb package
echo "Building Debian package..."
DEB_FILE="${PKG_NAME}_${VERSION}_${ARCH}.deb"
mkdir -p "$DIST_DIR"

# Use fakeroot if available, otherwise use dpkg-deb directly (requires root)
if command -v fakeroot &> /dev/null; then
    echo "Using fakeroot to build package..."
    fakeroot dpkg-deb --build "$PKG_ROOT" "$DIST_DIR/$DEB_FILE"
else
    echo "WARNING: fakeroot not found. Building as root (may require sudo)..."
    dpkg-deb --build "$PKG_ROOT" "$DIST_DIR/$DEB_FILE"
fi

if [ ! -f "$DIST_DIR/$DEB_FILE" ]; then
    echo "ERROR: Package build failed"
    exit 1
fi

# Get package size and info
PKG_SIZE=$(du -h "$DIST_DIR/$DEB_FILE" | cut -f1)
PKG_INFO=$(dpkg-deb -I "$DIST_DIR/$DEB_FILE" 2>/dev/null || echo "Package info unavailable")

echo ""
echo "=========================================="
echo "Package build complete!"
echo "=========================================="
echo "Package: $DIST_DIR/$DEB_FILE"
echo "Size: $PKG_SIZE"
echo ""
echo "Package Information:"
echo "$PKG_INFO" | head -10
echo ""
echo "To install, run:"
echo "  sudo dpkg -i $DIST_DIR/$DEB_FILE"
echo ""
echo "If there are dependency issues, run:"
echo "  sudo apt-get install -f"
echo ""

exit 0
