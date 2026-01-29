# AI Competency Agent - Installer Build System

This directory contains production-grade installer build scripts and configurations for the AI Competency Agent across Windows, macOS, and Linux.

## Directory Structure

```
installer/
├── windows/          # Windows installer files
│   ├── build_windows.py      # PyInstaller build script
│   ├── installer.nsi         # NSIS installer script
│   ├── agent_service.py      # Windows Service wrapper
│   └── install_service.ps1   # PowerShell service installer
│
├── macos/            # macOS installer files
│   ├── build_macos.py                # PyInstaller build script
│   ├── com.aicompetency.agent.plist  # LaunchAgent configuration
│   ├── postinstall.sh                # Post-install script
│   └── build_pkg.sh                  # Package builder script
│
└── linux/            # Linux installer files
    ├── build_linux.py                # PyInstaller build script
    ├── aicompetency-agent.service     # systemd service file
    ├── DEBIAN/
    │   ├── control                    # Debian package metadata
    │   └── postinst                   # Post-install script
    └── build_deb.sh                   # Debian package builder
```

## Overview

The installer system creates standalone installers that:

1. **Bundle Python and dependencies** - No Python installation required on target system
2. **Install as background service** - Runs automatically on system boot/login
3. **Require zero terminal usage** - Fully automated installation
4. **Auto-restart on failure** - Service automatically restarts if it crashes
5. **Expose WebSocket server** - Available at `ws://127.0.0.1:8889`

## Build Process

### Prerequisites

All platforms require:
- Python 3.10+ with PyInstaller: `pip install pyinstaller`

Platform-specific requirements:

**Windows:**
- NSIS 3.x (for creating .exe installer)
- pywin32: `pip install pywin32` (for Windows Service)
- PowerShell (for service installation)

**macOS:**
- Xcode Command Line Tools: `xcode-select --install`
- pkgbuild and productbuild (included with Xcode)

**Linux:**
- dpkg-deb (usually pre-installed on Debian/Ubuntu)
- fakeroot (recommended): `sudo apt-get install fakeroot`
- systemd (for service management)

### Build Steps

#### Windows

1. Build executable:
   ```bash
   cd installer/windows
   python build_windows.py
   ```

2. Create installer:
   ```bash
   makensis installer.nsi
   ```
   Output: `dist/AptorAIAgent-Setup.exe`

#### macOS

1. Build executable:
   ```bash
   cd installer/macos
   python build_macos.py
   ```

2. Create package:
   ```bash
   ./build_pkg.sh
   ```
   Output: `dist/AptorAIAgent-1.0.0.pkg`

#### Linux

1. Build executable:
   ```bash
   cd installer/linux
   python build_linux.py
   ```

2. Create Debian package:
   ```bash
   ./build_deb.sh
   ```
   Output: `dist/aicompetency-agent_1.0.0_amd64.deb`

## Installation

### Windows

1. Run `AptorAIAgent-Setup.exe`
2. Follow the installer wizard
3. Service installs and starts automatically
4. Agent available at `ws://127.0.0.1:8889`

**Manual service management:**
```powershell
# Start service
Start-Service -Name AptorAIAgent

# Stop service
Stop-Service -Name AptorAIAgent

# Check status
Get-Service -Name AptorAIAgent
```

### macOS

1. Double-click `AptorAIAgent-1.0.0.pkg`
2. Follow the installer wizard
3. Agent starts automatically on login
4. Agent available at `ws://127.0.0.1:8889`

**Manual service management:**
```bash
# Check status
launchctl list | grep aicompetency

# Start service
launchctl load -w ~/Library/LaunchAgents/com.aicompetency.agent.plist

# Stop service
launchctl unload ~/Library/LaunchAgents/com.aicompetency.agent.plist

# View logs
tail -f /usr/local/var/log/aicompetency-agent/agent.log
```

### Linux

1. Install package:
   ```bash
   sudo dpkg -i aicompetency-agent_1.0.0_amd64.deb
   ```

2. Enable and start service (for each user):
   ```bash
   systemctl --user enable aicompetency-agent.service
   systemctl --user start aicompetency-agent.service
   ```

3. Agent available at `ws://127.0.0.1:8889`

**Manual service management:**
```bash
# Check status
systemctl --user status aicompetency-agent.service

# Start service
systemctl --user start aicompetency-agent.service

# Stop service
systemctl --user stop aicompetency-agent.service

# View logs
journalctl --user -u aicompetency-agent.service -f
```

## Service Details

### Windows Service
- **Service Name:** `AptorAIAgent`
- **Display Name:** Aptor AI Competency Agent
- **Start Type:** Automatic (starts on boot)
- **Logs:** `C:\ProgramData\Aptor\Agent\logs\agent_service.log`

### macOS LaunchAgent
- **Label:** `com.aicompetency.agent`
- **Location:** `~/Library/LaunchAgents/com.aicompetency.agent.plist`
- **Start Type:** Automatic (starts on login)
- **Logs:** `/usr/local/var/log/aicompetency-agent/agent.log`

### Linux systemd Service
- **Service Name:** `aicompetency-agent.service`
- **Type:** User service (per-user)
- **Start Type:** Enabled (starts on login)
- **Logs:** `journalctl --user -u aicompetency-agent.service`

## Troubleshooting

### Windows

**Service won't start:**
- Check Windows Event Viewer for errors
- Verify executable exists: `C:\Program Files\Aptor\Agent\aicompetency-agent.exe`
- Check firewall rules: `netsh advfirewall firewall show rule name="Aptor AI Agent"`

**Service installation fails:**
- Ensure running as Administrator
- Install pywin32: `pip install pywin32`
- Run service installation manually: `.\install_service.ps1`

### macOS

**Service won't start:**
- Check logs: `tail -f /usr/local/var/log/aicompetency-agent/agent.error.log`
- Verify executable: `ls -la /usr/local/bin/aicompetency-agent`
- Check LaunchAgent: `launchctl list | grep aicompetency`

**Permission errors:**
- Ensure executable has execute permission: `chmod +x /usr/local/bin/aicompetency-agent`
- Check directory permissions: `ls -la /usr/local/var/lib/aicompetency-agent`

### Linux

**Service won't start:**
- Check service status: `systemctl --user status aicompetency-agent.service`
- View logs: `journalctl --user -u aicompetency-agent.service -n 50`
- Verify executable: `ls -la /usr/bin/aicompetency-agent`

**Permission errors:**
- Ensure executable has execute permission: `sudo chmod +x /usr/bin/aicompetency-agent`
- Check directory permissions: `ls -la /var/lib/aicompetency-agent`

## Development Notes

### Modifying Installers

- **Windows:** Edit `installer.nsi` for installer UI changes, `agent_service.py` for service behavior
- **macOS:** Edit `com.aicompetency.agent.plist` for LaunchAgent config, `postinstall.sh` for install steps
- **Linux:** Edit `aicompetency-agent.service` for systemd config, `DEBIAN/postinst` for install steps

### Testing

Before releasing, test on:
- Clean Windows 10/11 VM
- Clean macOS VM (latest version)
- Clean Ubuntu 20.04+ VM

Verify:
- [ ] Installer runs without errors
- [ ] Service starts automatically
- [ ] Service survives reboot
- [ ] Service restarts after crash
- [ ] WebSocket accessible at `ws://127.0.0.1:8889`
- [ ] Code execution works
- [ ] Uninstaller removes everything

## License

See main project license file.
