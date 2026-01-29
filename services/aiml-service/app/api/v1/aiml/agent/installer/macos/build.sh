#!/usr/bin/env bash
#
# build.sh - Build macOS .pkg installer for the AI Competency Agent
#
# Responsibilities:
# - Download Python 3.11 universal2 installer from python.org
# - Extract a relocatable Python into build/pkgroot/Applications/AptorAgent/python/
# - Copy agent source into build/pkgroot/Applications/AptorAgent/agent/
# - Copy LaunchAgent plist and license
# - Create a component package with pkgbuild
# - Create a product archive with productbuild
# - Output: dist/AICompetencyAgent-v1.0.0.pkg
#
# Requirements:
# - Run on macOS 11+ (Big Sur or later)
# - Xcode Command Line Tools installed (for pkgbuild/productbuild/pkgutil)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLER_DIR="$SCRIPT_DIR"
AGENT_ROOT="$SCRIPT_DIR/../.."          # points to .../agent
BUILD_DIR="$INSTALLER_DIR/build"
DIST_DIR="$INSTALLER_DIR/dist"
PKGROOT="$BUILD_DIR/pkgroot"

PYTHON_VERSION="3.11.8"
PYTHON_PKG_NAME="python-${PYTHON_VERSION}-macos11.pkg"
PYTHON_URL="https://www.python.org/ftp/python/${PYTHON_VERSION}/${PYTHON_PKG_NAME}"

APP_NAME="AI Competency Agent"
IDENTIFIER="com.aptor.aiagent"
VERSION="1.0.0"

APP_ROOT="$PKGROOT/Applications"
APP_DIR="$APP_ROOT/AptorAgent"
PYTHON_DIR="$APP_DIR/python"
AGENT_DIR="$APP_DIR/agent"

COMPONENT_PKG="$BUILD_DIR/AICompetencyAgent-component.pkg"
PRODUCT_PKG="$DIST_DIR/AICompetencyAgent-v${VERSION}.pkg"

info()  { printf "\033[1;34m[INFO]\033[0m %s\n" "$*"; }
warn()  { printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }
error() { printf "\033[1;31m[ERROR]\033[0m %s\n" "$*" >&2; }

ensure_tools() {
  info "Checking required tools..."
  for tool in curl pkgbuild productbuild pkgutil rsync; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      error "Required tool '$tool' is not installed. Install Xcode Command Line Tools (xcode-select --install) and retry."
      exit 1
    fi
  done
}

prepare_dirs() {
  info "Preparing build directories..."
  rm -rf "$BUILD_DIR" "$DIST_DIR"
  mkdir -p "$BUILD_DIR" "$DIST_DIR" "$PKGROOT" "$APP_DIR"
}

download_python() {
  info "Downloading Python ${PYTHON_VERSION} installer from python.org..."
  local dest_pkg="$BUILD_DIR/$PYTHON_PKG_NAME"

  if [[ -f "$dest_pkg" ]]; then
    info "Python installer already present at $dest_pkg, skipping download."
    return
  fi

  curl -L "$PYTHON_URL" -o "$dest_pkg"
  info "Downloaded Python installer to $dest_pkg"
}

extract_python() {
  info "Extracting Python into application bundle..."
  local src_pkg="$BUILD_DIR/$PYTHON_PKG_NAME"
  local expanded_dir="$BUILD_DIR/python-expanded"

  rm -rf "$expanded_dir" "$PYTHON_DIR"
  mkdir -p "$expanded_dir" "$PYTHON_DIR"

  # Expand the python.org pkg
  pkgutil --expand-full "$src_pkg" "$expanded_dir"

  # Locate Python.framework (universal2)
  local framework_path
  framework_path="$(find "$expanded_dir" -type d -name "Python.framework" | head -n 1 || true)"
  if [[ -n "$framework_path" ]]; then
    info "Found Python.framework at: $framework_path"
    mkdir -p "$PYTHON_DIR/Frameworks"
    cp -R "$framework_path" "$PYTHON_DIR/Frameworks/"
  else
    warn "Could not find Python.framework in expanded pkg. You may need to adjust extract_python()."
  fi

  # Locate python3 binary
  local python_bin
  python_bin="$(find "$expanded_dir" -type f -name "python3" | head -n 1 || true)"
  if [[ -n "$python_bin" ]]; then
    mkdir -p "$PYTHON_DIR/bin"
    cp "$python_bin" "$PYTHON_DIR/bin/python3"
    chmod +x "$PYTHON_DIR/bin/python3"
    info "Copied python3 to $PYTHON_DIR/bin/python3"
  else
    warn "Could not find python3 binary in expanded pkg. Ensure Python ${PYTHON_VERSION} installer layout matches expectations."
  fi
}

copy_agent_sources() {
  info "Copying agent sources into application bundle..."
  rm -rf "$AGENT_DIR"
  mkdir -p "$AGENT_DIR"

  rsync -av --delete \
    --exclude "installer/" \
    --exclude "__pycache__/" \
    --exclude ".pytest_cache/" \
    --exclude ".mypy_cache/" \
    --exclude "*.pyc" \
    "$AGENT_ROOT/" "$AGENT_DIR/"

  if [[ -f "$AGENT_ROOT/requirements.txt" ]]; then
    cp "$AGENT_ROOT/requirements.txt" "$AGENT_DIR/requirements.txt"
  else
    warn "No requirements.txt found at $AGENT_ROOT/requirements.txt; skipping."
  fi

  # Copy LaunchAgent template into app bundle so postinstall can deploy it
  if [[ -f "$INSTALLER_DIR/com.aptor.aiagent.plist" ]]; then
    cp "$INSTALLER_DIR/com.aptor.aiagent.plist" "$APP_DIR/com.aptor.aiagent.plist"
  else
    warn "LaunchAgent plist com.aptor.aiagent.plist not found in $INSTALLER_DIR; postinstall will fail if missing."
  fi
}

copy_license() {
  local win_license="$INSTALLER_DIR/../windows/license.txt"
  if [[ -f "$win_license" ]]; then
    info "Copying license.txt into resources..."
    mkdir -p "$INSTALLER_DIR/resources"
    cp "$win_license" "$INSTALLER_DIR/resources/license.txt"
  else
    warn "Windows license.txt not found at $win_license; Distribution.xml will reference a placeholder."
  fi
}

build_component_pkg() {
  info "Building component package with pkgbuild..."

  pkgbuild \
    --root "$PKGROOT" \
    --identifier "$IDENTIFIER" \
    --version "$VERSION" \
    --scripts "$INSTALLER_DIR/scripts" \
    "$COMPONENT_PKG"

  info "Component package created at $COMPONENT_PKG"
}

build_product_pkg() {
  info "Building product archive with productbuild..."

  productbuild \
    --distribution "$INSTALLER_DIR/resources/Distribution.xml" \
    --package-path "$BUILD_DIR" \
    --resources "$INSTALLER_DIR/resources" \
    "$PRODUCT_PKG"

  info "Final installer created at $PRODUCT_PKG"
}

main() {
  info "Building ${APP_NAME} macOS installer..."
  ensure_tools
  prepare_dirs
  download_python
  extract_python
  copy_agent_sources
  copy_license
  build_component_pkg
  build_product_pkg
  info "Build completed successfully."
}

main "$@"

