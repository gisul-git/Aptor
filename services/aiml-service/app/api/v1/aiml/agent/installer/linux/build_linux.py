"""
Linux installer build script using PyInstaller.

This script builds a standalone Linux executable from the agent code.
The executable bundles Python and all dependencies, so no Python installation
is required on the target system.

Usage:
    python build_linux.py

Requirements:
    pip install pyinstaller
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

# Get the agent directory (parent of installer)
AGENT_DIR = Path(__file__).parent.parent.parent
INSTALLER_DIR = Path(__file__).parent
BUILD_DIR = INSTALLER_DIR / "build"
DIST_DIR = INSTALLER_DIR / "dist"

def clean_build():
    """Clean previous build artifacts."""
    print("Cleaning previous build...")
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    if (AGENT_DIR / "build").exists():
        shutil.rmtree(AGENT_DIR / "build")
    if (AGENT_DIR / "dist").exists():
        shutil.rmtree(AGENT_DIR / "dist")
    print("Clean complete.")

def build_executable():
    """Build the Linux executable using PyInstaller."""
    print("Building Linux executable...")
    
    # Change to agent directory for build
    os.chdir(AGENT_DIR)
    
    # PyInstaller command
    # --onefile: Create a single executable file
    # --console: Keep console (for service logging)
    # --name: Output executable name
    # --hidden-import: Explicitly include modules that PyInstaller might miss
    # --collect-all: Collect all submodules for packages
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--console",
        "--name", "aicompetency-agent",
        "--hidden-import", "agent",
        "--hidden-import", "agent.server",
        "--hidden-import", "agent.kernel_manager",
        "--hidden-import", "agent.kernel_executor",
        "--hidden-import", "agent.features.file_upload",
        "--hidden-import", "agent.features.restart_kernel",
        "--collect-all", "jupyter_client",
        "--collect-all", "ipykernel",
        "--collect-all", "zmq",
        "--collect-all", "websockets",
        "--collect-all", "nest_asyncio",
        "--add-data", f"{AGENT_DIR / 'features'}:features",
        "--distpath", str(DIST_DIR),
        "--workpath", str(BUILD_DIR),
        str(AGENT_DIR / "__main__.py")
    ]
    
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=AGENT_DIR)
    
    if result.returncode != 0:
        print("ERROR: PyInstaller build failed!")
        sys.exit(1)
    
    exe_path = DIST_DIR / "aicompetency-agent"
    print(f"Build complete! Executable: {exe_path}")
    return exe_path

def verify_executable(exe_path):
    """Verify the executable was created and make it executable."""
    if not exe_path.exists():
        print(f"ERROR: Executable not found at {exe_path}")
        sys.exit(1)
    
    # Make executable
    os.chmod(exe_path, 0o755)
    
    size_mb = exe_path.stat().st_size / (1024 * 1024)
    print(f"Executable size: {size_mb:.2f} MB")
    
    if size_mb < 10:
        print("WARNING: Executable seems too small. Dependencies might be missing.")
    elif size_mb > 500:
        print("WARNING: Executable seems very large. Consider optimization.")

def main():
    """Main build process."""
    print("=" * 60)
    print("AI Competency Agent - Linux Build Script")
    print("=" * 60)
    
    # Check PyInstaller is installed
    try:
        import PyInstaller
        print(f"PyInstaller version: {PyInstaller.__version__}")
    except ImportError:
        print("ERROR: PyInstaller not installed!")
        print("Install with: pip install pyinstaller")
        sys.exit(1)
    
    # Check we're on Linux (optional warning)
    if sys.platform not in ("linux", "linux2"):
        print("WARNING: This script is designed for Linux. Building anyway...")
    
    # Clean previous builds
    clean_build()
    
    # Build executable
    exe_path = build_executable()
    
    # Verify
    verify_executable(exe_path)
    
    print("=" * 60)
    print("Build successful!")
    print(f"Executable ready: {exe_path}")
    print("Next step: Run build_deb.sh to create .deb package")
    print("=" * 60)

if __name__ == "__main__":
    main()
