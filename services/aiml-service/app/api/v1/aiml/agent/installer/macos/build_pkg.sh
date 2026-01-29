#!/bin/bash
#
# Build script for macOS .pkg installer
#
# This script creates a macOS installer package (.pkg) that:
# 1. Installs the agent executable to /usr/local/bin
# 2. Installs LaunchAgent plist for auto-start
# 3. Creates necessary directories
# 4. Sets up logging
#
# Usage:
#   ./build_pkg.sh
#
# Requirements:
#   - macOS (for building)
#   - Agent executable built (run build_macos.py first)
#   - Xcode Command Line Tools (for pkgbuild/productbuild)

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
INSTALLER_DIR="$SCRIPT_DIR"
BUILD_DIR="$INSTALLER_DIR/build"
DIST_DIR="$INSTALLER_DIR/dist"
PKG_NAME="AptorAIAgent"
VERSION="1.0.0"

echo "=========================================="
echo "AI Competency Agent - macOS Package Builder"
echo "=========================================="
echo ""

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "ERROR: This script must be run on macOS"
    exit 1
fi

# Check if agent executable exists
AGENT_EXE="$DIST_DIR/aicompetency-agent"
if [ ! -f "$AGENT_EXE" ]; then
    echo "ERROR: Agent executable not found: $AGENT_EXE"
    echo "Please run build_macos.py first to build the executable"
    exit 1
fi

echo "Agent executable: $AGENT_EXE"
echo ""

# Create package root
PKG_ROOT="$BUILD_DIR/pkgroot"
echo "Creating package root..."
rm -rf "$PKG_ROOT"
mkdir -p "$PKG_ROOT/usr/local/bin"
mkdir -p "$PKG_ROOT/usr/local/lib/$PKG_NAME"
mkdir -p "$PKG_ROOT/usr/local/var/lib/$PKG_NAME"
mkdir -p "$PKG_ROOT/usr/local/var/log/$PKG_NAME"
mkdir -p "$PKG_ROOT/usr/local/var/lib/$PKG_NAME/uploads"

# Copy agent executable
echo "Copying agent executable..."
cp "$AGENT_EXE" "$PKG_ROOT/usr/local/bin/aicompetency-agent"
chmod 755 "$PKG_ROOT/usr/local/bin/aicompetency-agent"

# Copy LaunchAgent plist
echo "Copying LaunchAgent plist..."
cp "$INSTALLER_DIR/com.aicompetency.agent.plist" "$PKG_ROOT/usr/local/lib/$PKG_NAME/"

# Copy postinstall script
echo "Copying postinstall script..."
cp "$INSTALLER_DIR/postinstall.sh" "$PKG_ROOT/usr/local/lib/$PKG_NAME/"
chmod 755 "$PKG_ROOT/usr/local/lib/$PKG_NAME/postinstall.sh"

# Create component package
echo "Building component package..."
COMPONENT_PKG="$BUILD_DIR/${PKG_NAME}.pkg"
pkgbuild \
    --root "$PKG_ROOT" \
    --identifier "com.aicompetency.agent" \
    --version "$VERSION" \
    --install-location "/" \
    --scripts "$INSTALLER_DIR" \
    "$COMPONENT_PKG"

if [ ! -f "$COMPONENT_PKG" ]; then
    echo "ERROR: Component package build failed"
    exit 1
fi

echo "Component package created: $COMPONENT_PKG"
echo ""

# Create distribution package (optional - for App Store style installer)
echo "Building distribution package..."
DISTRIBUTION_XML="$BUILD_DIR/distribution.xml"

cat > "$DISTRIBUTION_XML" << EOF
<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="1">
    <title>AI Competency Agent</title>
    <organization>com.aicompetency</organization>
    <domains enable_localSystem="true"/>
    <options customize="never" require-scripts="false" rootVolumeOnly="true"/>
    <welcome file="welcome.txt"/>
    <license file="license.txt"/>
    <pkg-ref id="com.aicompetency.agent"/>
    <options customize="never" require-scripts="false"/>
    <choices-outline>
        <line choice="com.aicompetency.agent"/>
    </choices-outline>
    <choice id="com.aicompetency.agent" visible="false">
        <pkg-ref id="com.aicompetency.agent"/>
    </choice>
    <pkg-ref id="com.aicompetency.agent" version="$VERSION" onConclusion="none">${PKG_NAME}.pkg</pkg-ref>
</installer-gui-script>
EOF

# Build final package
FINAL_PKG="$DIST_DIR/${PKG_NAME}-${VERSION}.pkg"
mkdir -p "$DIST_DIR"

productbuild \
    --distribution "$DISTRIBUTION_XML" \
    --package-path "$BUILD_DIR" \
    --resources "$INSTALLER_DIR" \
    "$FINAL_PKG"

if [ ! -f "$FINAL_PKG" ]; then
    echo "WARNING: Distribution package build failed, using component package"
    FINAL_PKG="$COMPONENT_PKG"
fi

# Get package size
PKG_SIZE=$(du -h "$FINAL_PKG" | cut -f1)

echo ""
echo "=========================================="
echo "Package build complete!"
echo "=========================================="
echo "Package: $FINAL_PKG"
echo "Size: $PKG_SIZE"
echo ""
echo "To install, double-click the .pkg file or run:"
echo "  sudo installer -pkg \"$FINAL_PKG\" -target /"
echo ""

exit 0
