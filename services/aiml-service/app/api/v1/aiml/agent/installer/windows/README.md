# AI Competency Agent - Windows Installer

Complete production-ready installer for the AI Competency Agent on Windows.

## Overview

This installer packages the AI Competency Agent as a Windows Service that:
- Runs automatically on system boot
- Provides a WebSocket server on `ws://127.0.0.1:8889`
- Executes Python code locally using Jupyter kernels
- Requires no manual terminal commands

## Prerequisites

### For Building the Installer

1. **Windows 10/11** (64-bit)
2. **PowerShell 5.1 or higher**
3. **Administrator privileges**
4. **NSIS 3.x** installed at: `C:\Program Files (x86)\NSIS\`
   - Download from: https://nsis.sourceforge.io/Download
5. **Internet connection** (for downloading Python and NSSM)

### For Installing (End Users)

1. **Windows 10/11** (64-bit)
2. **Administrator privileges** (UAC prompt will appear)

## Building the Installer

### Step 1: Open PowerShell as Administrator

Right-click PowerShell and select "Run as Administrator"

### Step 2: Navigate to Installer Directory

```powershell
cd "C:\path\to\Aptor\services\aiml-service\app\api\v1\aiml\agent\installer\windows"
```

### Step 3: Run Build Script

```powershell
.\build.ps1
```

### Expected Output

```
========================================
  Building AI Competency Agent Installer
========================================

[*] Checking prerequisites...
[✓] Administrator privileges confirmed
[✓] NSIS found at: C:\Program Files (x86)\NSIS\makensis.exe
[✓] Agent source found
[*] Cleaning previous builds...
[✓] Build directories ready
[*] Downloading Python 3.11.8 embedded...
[✓] Downloaded Python 3.11.8 embedded successfully
[*] Extracting Python...
[✓] Extracted Python embedded successfully
[*] Configuring Python for pip...
[✓] Python configured for pip
[*] Downloading get-pip.py...
[✓] Downloaded get-pip.py successfully
[*] Installing pip...
[✓] pip installed successfully
[*] Downloading NSSM 2.24...
[✓] Downloaded NSSM 2.24 successfully
[*] Extracting NSSM...
[✓] NSSM extracted successfully
[*] Copying agent source files...
[✓] Agent source files copied
[*] Copying license file...
[✓] License file copied
[*] Creating check_status.bat...
[✓] check_status.bat created
[*] Building installer with NSIS...
[✓] NSIS build completed
[*] Preparing final installer...
[✓] Installer renamed to: AICompetencyAgent-Setup-v1.0.0.exe

========================================
✓ Build completed successfully!
========================================

Installer: dist\AICompetencyAgent-Setup-v1.0.0.exe
Size: 45.2 MB

Next steps:
1. Test installer on a clean Windows VM
2. Distribute to candidates
```

### Build Time

- First build: ~5-10 minutes (downloads Python and NSSM)
- Subsequent builds: ~2-3 minutes (uses cached downloads)

## Installation (For End Users)

### Step 1: Download Installer

Download `AICompetencyAgent-Setup-v1.0.0.exe`

### Step 2: Run Installer

**Option A: Double-click** (UAC prompt will appear)
- Double-click `AICompetencyAgent-Setup-v1.0.0.exe`
- Click "Yes" on UAC prompt
- Follow installation wizard

**Option B: Right-click → Run as Administrator**
- Right-click `AICompetencyAgent-Setup-v1.0.0.exe`
- Select "Run as Administrator"
- Click "Yes" on UAC prompt
- Follow installation wizard

### Step 3: Installation Process

The installer will:
1. Extract Python 3.11.8 embedded distribution
2. Install pip and Python dependencies
3. Install and register ipykernel
4. Copy agent source files
5. Install Windows Service using NSSM
6. Configure service to auto-start
7. Start the service

**Installation time:** ~2-3 minutes

### Step 4: Verify Installation

After installation completes, verify:

1. **Check Service Status:**
   - Open Services (`Win+R` → `services.msc`)
   - Find "Aptor AI Competency Agent"
   - Status should be "Running"
   - Startup type should be "Automatic"

2. **Check Port:**
   ```powershell
   netstat -an | findstr 8889
   ```
   Should show: `127.0.0.1:8889 ... LISTENING`

3. **Test WebSocket Connection:**
   - Open browser console (F12)
   - Run:
     ```javascript
     const ws = new WebSocket('ws://127.0.0.1:8889');
     ws.onopen = () => console.log('Connected!');
     ws.onerror = (e) => console.error('Error:', e);
     ```
   - Should connect successfully

4. **Use Status Checker:**
   - Start Menu → AI Competency Agent → Check Agent Status
   - Or run: `C:\Program Files\Aptor\Agent\check_status.bat`

## Installation Directory Structure

```
C:\Program Files\Aptor\Agent\
├── python\              # Python 3.11.8 embedded (64-bit)
│   ├── python.exe
│   ├── python311.dll
│   ├── Lib\
│   └── Scripts\
├── agent\               # Agent source code
│   ├── __main__.py
│   ├── server.py
│   ├── kernel_executor.py
│   ├── kernel_manager.py
│   ├── features\
│   └── requirements.txt
├── logs\                # Log files
│   ├── agent.log
│   └── agent_error.log
├── nssm.exe             # Service manager
├── check_status.bat     # Status checker
└── uninstall.exe        # Uninstaller
```

## Verification Tests

### Test 1: Service Status

```powershell
sc query AptorAIAgent
```

Expected output:
```
SERVICE_NAME: AptorAIAgent
        TYPE               : 10  WIN32_OWN_PROCESS
        STATE              : 4  RUNNING
        ...
```

### Test 2: Port Listening

```powershell
netstat -an | findstr 8889
```

Expected output:
```
TCP    127.0.0.1:8889         0.0.0.0:0              LISTENING
```

### Test 3: WebSocket Connection

Open browser console and run:
```javascript
const ws = new WebSocket('ws://127.0.0.1:8889');
ws.onopen = () => {
    console.log('✓ Connected to agent!');
    ws.close();
};
ws.onerror = (e) => console.error('✗ Connection failed:', e);
```

### Test 4: Auto-Start on Boot

1. Restart computer
2. Wait for Windows to fully boot
3. Check service status (should be "Running")
4. Check port 8889 (should be listening)

## Troubleshooting

### Service Not Starting

**Symptoms:**
- Service status shows "Stopped"
- Port 8889 not listening

**Solutions:**

1. **Check Service Logs:**
   ```
   C:\Program Files\Aptor\Agent\logs\agent_error.log
   ```

2. **Check Windows Event Viewer:**
   - Open Event Viewer (`eventvwr.msc`)
   - Windows Logs → Application
   - Look for errors from "AptorAIAgent"

3. **Manually Start Service:**
   ```powershell
   net start AptorAIAgent
   ```

4. **Check Python Installation:**
   ```powershell
   cd "C:\Program Files\Aptor\Agent"
   .\python\python.exe --version
   ```
   Should show: `Python 3.11.8`

5. **Test Agent Manually:**
   ```powershell
   cd "C:\Program Files\Aptor\Agent\agent"
   ..\python\python.exe -m agent --host 127.0.0.1 --port 8889
   ```
   If this works, the issue is with the service configuration.

### Port Already in Use

**Symptoms:**
- Error: "Address already in use"
- Port 8889 shows as listening but not by our service

**Solutions:**

1. **Find process using port 8889:**
   ```powershell
   netstat -ano | findstr 8889
   ```
   Note the PID (last column)

2. **Kill the process:**
   ```powershell
   taskkill /PID <PID> /F
   ```

3. **Restart service:**
   ```powershell
   net stop AptorAIAgent
   net start AptorAIAgent
   ```

### Python Dependencies Missing

**Symptoms:**
- Service starts but WebSocket fails
- Errors about missing modules

**Solutions:**

1. **Reinstall dependencies:**
   ```powershell
   cd "C:\Program Files\Aptor\Agent"
   .\python\python.exe -m pip install -r agent\requirements.txt
   ```

2. **Reinstall ipykernel:**
   ```powershell
   .\python\python.exe -m pip install ipykernel
   .\python\python.exe -m ipykernel install --user --name python3 --display-name "Python 3"
   ```

3. **Restart service:**
   ```powershell
   net stop AptorAIAgent
   net start AptorAIAgent
   ```

### UAC Prompt Not Appearing

**Symptoms:**
- Installer fails with "Administrator rights required"

**Solutions:**

1. **Right-click installer → Run as Administrator**
2. **Disable UAC temporarily** (not recommended)
3. **Check if already running as admin:**
   ```powershell
   ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
   ```

## Uninstallation

### Method 1: Add/Remove Programs

1. Open Settings → Apps → Apps & features
2. Find "AI Competency Agent"
3. Click "Uninstall"
4. Follow uninstaller wizard

### Method 2: Uninstaller Executable

1. Navigate to: `C:\Program Files\Aptor\Agent\`
2. Double-click `uninstall.exe`
3. Follow uninstaller wizard

### Method 3: Command Line

```powershell
cd "C:\Program Files\Aptor\Agent"
.\uninstall.exe /S
```

### What Gets Removed

- Python embedded distribution
- Agent source files
- Log files
- Windows Service
- Start Menu shortcuts
- Registry entries

**Note:** User data and kernel installations are preserved (in user's AppData).

## Development

### Modifying the Installer

1. **Edit `installer.nsi`** for installer behavior
2. **Edit `build.ps1`** for build process
3. **Run `.\build.ps1`** to rebuild

### Adding Files to Installer

1. Add files to `build/` directory in `build.ps1`
2. Reference files in `installer.nsi` using `File` directive

### Changing Python Version

1. Edit `$PYTHON_VERSION` in `build.ps1`
2. Update `$PYTHON_EMBED_URL` if needed
3. Update `python311._pth` references in both scripts

### Changing Service Configuration

Edit NSSM configuration in `installer.nsi` Section "Core Installation", Step 13.

## File Reference

### Core Files

- **`installer.nsi`** - NSIS installer script
- **`build.ps1`** - PowerShell build script
- **`check_status.bat`** - Service status checker
- **`license.txt`** - End User License Agreement

### Generated Files (Build Process)

- **`build/`** - Temporary build directory
- **`dist/`** - Final installer output
- **`AICompetencyAgent-Setup-v1.0.0.exe`** - Final installer

## Support

For issues or questions:
- **Email:** support@aptor.com
- **Website:** https://aptor.com

## License

Copyright (c) 2024 Aptor. All rights reserved.

See `license.txt` for full license terms.
