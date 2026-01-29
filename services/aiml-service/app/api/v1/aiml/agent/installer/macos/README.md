## AI Competency Agent – macOS Installer

This directory contains the macOS packaging scripts for the **AI Competency Agent**, which runs a local Python/Jupyter kernel and exposes a WebSocket endpoint at `ws://127.0.0.1:8889` for your cloud‑hosted notebook UI.

The installer builds a signed‑ready `.pkg` that:
- Installs the agent and a Python 3.11 runtime into `/Applications/AptorAgent/`
- Registers a user‑level LaunchAgent (`com.aptor.aiagent`)
- Starts the agent automatically on user login

---

### Directory Structure

- `build.sh` – main build script that produces the `.pkg`
- `com.aptor.aiagent.plist` – LaunchAgent definition for auto‑start
- `scripts/`
  - `preinstall.sh` – stops/unloads any existing agent and prepares directories
  - `postinstall.sh` – installs Python deps, registers ipykernel, installs + loads LaunchAgent
- `resources/`
  - `Distribution.xml` – product definition used by `productbuild`
  - `license.txt` – copied from the Windows installer (if present)

---

### Prerequisites

- macOS **11.0 Big Sur or later**
- Xcode Command Line Tools:

```bash
xcode-select --install
```

- Internet access (to download Python 3.11 from `python.org`)

---

### Build Instructions

Run the following on a macOS 11+ machine:

```bash
cd path/to/Aptor/services/aiml-service/app/api/v1/aiml/agent/installer/macos
chmod +x build.sh scripts/preinstall.sh scripts/postinstall.sh
./build.sh
```

What `build.sh` does:
- Cleans and recreates `build/` and `dist/`
- Downloads `python-3.11.8-macos11.pkg` from python.org
- Expands the pkg and copies a relocatable Python runtime into:
  - `/Applications/AptorAgent/python` (inside the pkg root)
- Copies the agent source tree (same as Windows) into:
  - `/Applications/AptorAgent/agent`
- Copies `com.aptor.aiagent.plist` and `license.txt` into the bundle
- Uses `pkgbuild` to create `AICompetencyAgent-component.pkg`
- Uses `productbuild` with `resources/Distribution.xml` to create:
  - `dist/AICompetencyAgent-v1.0.0.pkg`

---

### Installation Instructions

1. On macOS, double‑click:
   - `dist/AICompetencyAgent-v1.0.0.pkg`
2. Follow the installer prompts.
3. The installer will:
   - Place files under `/Applications/AptorAgent/`
   - Install a LaunchAgent at `~/Library/LaunchAgents/com.aptor.aiagent.plist`
   - Start the agent in the background

---

### Verification

After installation, verify:

- **LaunchAgent loaded**:

```bash
launchctl list | grep com.aptor.aiagent
```

- **Agent listening on port 8889**:

```bash
lsof -i tcp:8889
# or:
netstat -an | grep '\.8889 ' | grep LISTEN
```

- **Logs**:

```bash
ls -l ~/Library/Logs/AptorAgent
tail -n 50 ~/Library/Logs/AptorAgent/agent.log
tail -n 50 ~/Library/Logs/AptorAgent/agent_error.log
```

Your browser‑based notebook UI should be able to connect to:

```text
ws://127.0.0.1:8889
```

---

### Troubleshooting

- **Agent not starting**
  - Check LaunchAgent:
    ```bash
    launchctl list | grep com.aptor.aiagent
    ```
  - Reload the LaunchAgent:
    ```bash
    launchctl unload ~/Library/LaunchAgents/com.aptor.aiagent.plist
    launchctl load   ~/Library/LaunchAgents/com.aptor.aiagent.plist
    ```
  - Check logs in `~/Library/Logs/AptorAgent/` for Python errors.

- **Port 8889 not listening**
  - Confirm the agent process is running:
    ```bash
    ps aux | grep '[p]ython3 -m agent'
    ```
  - Recheck logs for tracebacks or import errors.

- **Permission issues**
  - Ensure `preinstall.sh` and `postinstall.sh` are executable:
    ```bash
    chmod +x scripts/preinstall.sh scripts/postinstall.sh
    ```
  - For development, you can run the agent manually:
    ```bash
    cd /Applications/AptorAgent
    ./python/bin/python3 -m agent --host 127.0.0.1 --port 8889
    ```

---

### Code Signing & Notarization (Production)

For real macOS distribution you should:

1. Obtain an Apple Developer ID Application certificate.
2. Sign the component package:

```bash
productsign --sign "Developer ID Installer: Your Company (TEAMID)" \
  dist/AICompetencyAgent-v1.0.0.pkg \
  dist/AICompetencyAgent-signed.pkg
```

3. Notarize the signed package with Apple (using `xcrun notarytool` or `altool`).
4. Staple the ticket:

```bash
xcrun stapler staple dist/AICompetencyAgent-signed.pkg
```

Ship the **signed and notarized** `.pkg` to end users.

---

### Uninstallation

To completely remove the AI Competency Agent from macOS:

```bash
# Unload LaunchAgent
launchctl unload ~/Library/LaunchAgents/com.aptor.aiagent.plist 2>/dev/null || true

# Remove LaunchAgent plist
rm -f ~/Library/LaunchAgents/com.aptor.aiagent.plist

# Remove application bundle
sudo rm -rf /Applications/AptorAgent

# Optionally remove logs
rm -rf ~/Library/Logs/AptorAgent
```

After this, port `8889` should no longer be in use and the agent should no longer start on login.

