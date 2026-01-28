# Quick Start Guide - Building Installers

This guide walks you through building installers for each platform step-by-step.

## Prerequisites Checklist

Before building, ensure you have:

### All Platforms
- [ ] Python 3.10 or higher installed
- [ ] PyInstaller installed: `pip install pyinstaller`
- [ ] Agent dependencies installed: `pip install -r requirements.txt`

### Windows Only
- [ ] NSIS 3.x installed (download from https://nsis.sourceforge.io/)
- [ ] pywin32 installed: `pip install pywin32` (for Windows Service)

### macOS Only
- [ ] Xcode Command Line Tools: `xcode-select --install`
- [ ] macOS system (for building .pkg)

### Linux Only
- [ ] dpkg-deb (usually pre-installed on Debian/Ubuntu)
- [ ] fakeroot: `sudo apt-get install fakeroot` (recommended)

---

## Step-by-Step Build Process

### Step 1: Navigate to Agent Directory

```bash
cd Aptor/services/aiml-service/app/api/v1/aiml/agent
```

### Step 2: Install Agent Dependencies

```bash
pip install -r requirements.txt
pip install ipykernel
python -m ipykernel install --user --name python3 --display-name "Python 3"
```

### Step 3: Build for Your Platform

Choose your platform below:

---

## 🪟 Windows Build

### 3.1 Build Executable

```powershell
cd installer/windows
python build_windows.py
```

**Expected Output:**
- Creates `dist/aicompetency-agent.exe` (100-200 MB)
- Takes 5-10 minutes

### 3.2 Create Installer

```powershell
# Make sure NSIS is installed and in PATH
makensis installer.nsi
```

**Expected Output:**
- Creates `dist/AptorAIAgent-Setup.exe` (installer package)

### 3.3 Test Installation

1. Run `AptorAIAgent-Setup.exe` as Administrator
2. Follow installer wizard
3. Check Windows Services: `services.msc` → Look for "Aptor AI Competency Agent"
4. Test WebSocket: Open browser console and try connecting to `ws://127.0.0.1:8889`

---

## 🍎 macOS Build

### 3.1 Build Executable

```bash
cd installer/macos
python build_macos.py
```

**Expected Output:**
- Creates `dist/aicompetency-agent` (100-200 MB)
- Takes 5-10 minutes

### 3.2 Create Package

```bash
chmod +x build_pkg.sh
./build_pkg.sh
```

**Expected Output:**
- Creates `dist/AptorAIAgent-1.0.0.pkg`

### 3.3 Test Installation

1. Double-click `AptorAIAgent-1.0.0.pkg`
2. Follow installer wizard
3. Check service: `launchctl list | grep aicompetency`
4. View logs: `tail -f /usr/local/var/log/aicompetency-agent/agent.log`
5. Test WebSocket connection

---

## 🐧 Linux Build

### 3.1 Build Executable

```bash
cd installer/linux
python build_linux.py
```

**Expected Output:**
- Creates `dist/aicompetency-agent` (100-200 MB)
- Takes 5-10 minutes

### 3.2 Create Debian Package

```bash
chmod +x build_deb.sh
./build_deb.sh
```

**Expected Output:**
- Creates `dist/aicompetency-agent_1.0.0_amd64.deb`

### 3.3 Test Installation

```bash
# Install package
sudo dpkg -i dist/aicompetency-agent_1.0.0_amd64.deb

# Fix any dependency issues
sudo apt-get install -f

# Enable and start service (for current user)
systemctl --user enable aicompetency-agent.service
systemctl --user start aicompetency-agent.service

# Check status
systemctl --user status aicompetency-agent.service

# View logs
journalctl --user -u aicompetency-agent.service -f
```

---

## Testing Checklist

After building and installing, verify:

- [ ] ✅ Agent executable exists in expected location
- [ ] ✅ Service is installed and running
- [ ] ✅ Service starts automatically on boot/login
- [ ] ✅ WebSocket server accessible at `ws://127.0.0.1:8889`
- [ ] ✅ Can execute Python code via WebSocket
- [ ] ✅ Logs are being written
- [ ] ✅ Service restarts after manual crash
- [ ] ✅ Uninstaller works correctly

---

## Troubleshooting

### Build Fails

**Issue:** PyInstaller can't find modules
- **Fix:** Ensure all dependencies are installed: `pip install -r requirements.txt`

**Issue:** Executable too small (< 10 MB)
- **Fix:** Check PyInstaller output for missing modules, add `--hidden-import` flags

**Issue:** Executable crashes on startup
- **Fix:** Test agent manually first: `python -m agent --host 127.0.0.1 --port 8889`

### Service Won't Start

**Windows:**
- Check Event Viewer for errors
- Verify executable path in service configuration
- Run `install_service.ps1` manually as Administrator

**macOS:**
- Check logs: `tail -f /usr/local/var/log/aicompetency-agent/agent.error.log`
- Verify LaunchAgent: `launchctl list | grep aicompetency`
- Check permissions: `ls -la /usr/local/bin/aicompetency-agent`

**Linux:**
- Check service status: `systemctl --user status aicompetency-agent.service`
- View logs: `journalctl --user -u aicompetency-agent.service -n 50`
- Verify executable: `ls -la /usr/bin/aicompetency-agent`

### WebSocket Connection Fails

- Verify agent is running: Check service status
- Test connection: Use browser console or WebSocket client
- Check firewall: Windows Firewall may block port 8889
- Verify port: `netstat -an | grep 8889` (Linux/macOS) or `netstat -an | findstr 8889` (Windows)

---

## Next Steps After Successful Build

1. **Test on Clean VMs** - Test each installer on a fresh OS installation
2. **Create Distribution Package** - Zip installers with README for candidates
3. **Document Installation** - Create user-facing installation guide
4. **Set Up CI/CD** - Automate builds in your CI pipeline
5. **Version Management** - Update version numbers before releases

---

## Need Help?

- Check `README.md` for detailed documentation
- Review build script output for errors
- Test agent manually before building: `python -m agent`
- Check service logs for runtime errors
