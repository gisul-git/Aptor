; ============================================================================
; NSIS Installer Script for AI Competency Agent
; ============================================================================
; This installer:
; 1. Embeds Python 3.11.8 (64-bit)
; 2. Installs pip and Python dependencies
; 3. Installs ipykernel
; 4. Copies agent source code
; 5. Creates Windows Service using NSSM
; 6. Configures service to auto-start on boot
; 7. Provides uninstaller
;
; Build Requirements:
;   - NSIS 3.x installed
;   - Run build.ps1 to prepare files before building
;
; ============================================================================

;--------------------------------
; Includes
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "WinVer.nsh"

; Build directory (passed from build.ps1 via /DBUILD_DIR=...), with fallback for manual builds
!ifndef BUILD_DIR
  !define BUILD_DIR "build"
!endif

; Retry parameters for antivirus-blocked files
!define INSTALL_RETRY_COUNT 5
!define INSTALL_RETRY_DELAY 2000

;--------------------------------
; General Configuration

; CRITICAL: Request admin privileges - MUST be at the top
RequestExecutionLevel admin
Unicode True

; Product Information
Name "AI Competency Agent"
OutFile "${BUILD_DIR}\AICompetencyAgent-Setup.exe"
InstallDir "$PROGRAMFILES64\Aptor\Agent"

; Version Information
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "AI Competency Agent"
VIAddVersionKey "CompanyName" "Aptor"
VIAddVersionKey "FileDescription" "AI Competency Agent Installer"
VIAddVersionKey "FileVersion" "1.0.0"
VIAddVersionKey "ProductVersion" "1.0.0"
VIAddVersionKey "LegalCopyright" "Copyright (c) 2024 Aptor"
VIAddVersionKey "CompanyWebsite" "https://aptor.com"

;--------------------------------
; Variables
Var PythonExe
Var NSSMExe
Var ServiceInstalled

;--------------------------------
; Interface Settings
!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"

;--------------------------------
; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${BUILD_DIR}\license.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

; Finish page with option to check status
!define MUI_FINISHPAGE_SHOWREADME "$INSTDIR\check_status.bat"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Check Agent Status"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

;--------------------------------
; Languages
!insertmacro MUI_LANGUAGE "English"

;--------------------------------
; Functions

; Check for administrator rights on initialization
Function .onInit
    ; Check if running as administrator
    UserInfo::GetAccountType
    pop $0
    ${If} $0 != "admin"
        MessageBox MB_ICONSTOP|MB_OK \
            "Administrator rights required!$\n$\nPlease right-click the installer and select 'Run as Administrator'.$\n$\nThe installer will now exit." \
            /SD IDOK
        SetErrorLevel 740 ; ERROR_ELEVATION_REQUIRED
        Quit
    ${EndIf}
    
    ; Set paths
    StrCpy $PythonExe "$INSTDIR\python\python.exe"
    StrCpy $NSSMExe "$INSTDIR\nssm.exe"
    
    ; Check if already installed
    IfFileExists "$INSTDIR\uninstall.exe" 0 +3
        MessageBox MB_YESNO|MB_ICONQUESTION \
            "AI Competency Agent is already installed.$\n$\nDo you want to uninstall the existing version first?" \
            IDYES uninstall_existing IDNO cancel_install
    
    uninstall_existing:
        ExecWait '"$INSTDIR\uninstall.exe" /S _?=$INSTDIR'
        Sleep 2000
        Goto continue_install
    
    cancel_install:
        Abort
    
    continue_install:
FunctionEnd

;--------------------------------
; Installer Sections

Section "Core Installation" SecCore
    SectionIn RO ; Read-only (required)
    
    SetOutPath "$INSTDIR"
    
    ; ========================================
    ; Step 1: Copy Python Embedded Distribution
    ; ========================================
    DetailPrint "Installing Python 3.11.8..."
    SetOverwrite on
    ; Set output to installation root so the 'python' directory is created directly under $INSTDIR
    SetOutPath "$INSTDIR"
    SetErrorLevel 0
    
    ; Extract Python with error continuation - if antivirus blocks, NSIS will skip and continue
    File /nonfatal /r "${BUILD_DIR}\python"
    
    ; Check if critical files extracted
    IfFileExists "$INSTDIR\python\python.exe" 0 python_fail
    IfFileExists "$INSTDIR\python\python311.dll" 0 python_fail
    Goto python_success
    
python_fail:
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Python installation failed.$\n$\nPlease temporarily disable antivirus and click Retry." IDRETRY retry_python
    Abort "Installation cancelled"
    
retry_python:
    RMDir /r "$INSTDIR\python"
    SetOutPath "$INSTDIR"
    File /r "${BUILD_DIR}\python"
    
python_success:
    
    ; ========================================
    ; Step 2: Configure Python for pip
    ; ========================================
    DetailPrint "Configuring Python for pip..."
    ; Write python311._pth with .. programmatically during installation
    FileOpen $0 "$INSTDIR\python\python311._pth" w
    FileWrite $0 "python311.zip$\r$\n"
    FileWrite $0 ".\$\r$\n"
    FileWrite $0 "# Uncomment to run site.main() automatically$\r$\n"
    FileWrite $0 "import site$\r$\n"
    FileWrite $0 "..$\r$\n"
    FileClose $0
    
    ; ========================================
    ; Step 3: Install pip
    ; ========================================
    DetailPrint "Installing pip..."
    ; get-pip.py should already have been copied into $INSTDIR\python by the File command above
    IfFileExists "$INSTDIR\python\get-pip.py" 0 pip_not_found
        nsExec::ExecToLog '"$PythonExe" "$INSTDIR\python\get-pip.py" --no-warn-script-location'
        Pop $0
        ${If} $0 != "0"
            MessageBox MB_OK|MB_ICONSTOP "Failed to install pip. Exit code: $0"
            Abort
        ${EndIf}
        Goto pip_done
    
    pip_not_found:
        MessageBox MB_OK|MB_ICONSTOP "get-pip.py was not found in the installed Python directory.$\n$\nPlease re-run the installer or contact support."
        Abort
    
    pip_done:
    
    ; ========================================
    ; Step 4: Copy Agent Source Files
    ; ========================================
    DetailPrint "Copying agent source files..."
    SetOverwrite on
    ; Set output to installation root so the 'agent' directory is created directly under $INSTDIR
    SetOutPath "$INSTDIR"
    SetErrorLevel 0
    
    ; Extract agent files - if antivirus blocks, NSIS will skip and continue
    File /nonfatal /r "${BUILD_DIR}\agent"
    
    ; Check if critical files extracted
    IfFileExists "$INSTDIR\agent\__main__.py" 0 agent_fail
    IfFileExists "$INSTDIR\agent\server.py" 0 agent_fail
    Goto agent_success
    
agent_fail:
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Agent installation failed.$\n$\nPlease temporarily disable antivirus and click Retry." IDRETRY retry_agent
    Abort "Installation cancelled"
    
retry_agent:
    RMDir /r "$INSTDIR\agent"
    SetOutPath "$INSTDIR"
    File /r "${BUILD_DIR}\agent"
    
agent_success:
    
    ; ========================================
    ; Step 5: Install Python Dependencies
    ; ========================================
    DetailPrint "Installing Python dependencies..."
    nsExec::ExecToLog '"$PythonExe" -m pip install --no-warn-script-location -r "$INSTDIR\agent\requirements.txt"'
    Pop $0
    ${If} $0 != "0"
        MessageBox MB_OK|MB_ICONEXCLAMATION "Warning: Some dependencies may have failed to install.$\n$\nExit code: $0$\n$\nThe agent may still work, but some features might be unavailable."
    ${EndIf}
    
    ; ========================================
    ; Step 6: Install ipykernel
    ; ========================================
    DetailPrint "Installing ipykernel..."
    nsExec::ExecToLog '"$PythonExe" -m pip install --no-warn-script-location ipykernel'
    Pop $0
    ${If} $0 != "0"
        MessageBox MB_OK|MB_ICONSTOP "Failed to install ipykernel. Exit code: $0"
        Abort
    ${EndIf}
    
    DetailPrint "Registering ipykernel..."
    nsExec::ExecToLog '"$PythonExe" -m ipykernel install --user --name python3 --display-name "Python 3"'
    Pop $0
    ${If} $0 != "0"
        MessageBox MB_OK|MB_ICONEXCLAMATION "Warning: Failed to register ipykernel.$\n$\nExit code: $0$\n$\nThe agent may still work, but kernel execution might fail."
    ${EndIf}
    
    ; ========================================
    ; Step 7: Copy NSSM
    ; ========================================
    DetailPrint "Installing NSSM service manager..."
    SetOutPath "$INSTDIR"
    File "${BUILD_DIR}\nssm.exe"

    ; Wait briefly to ensure file is fully written to disk
    Sleep 1000

    ; Verify NSSM was copied before using it
    ${If} ${FileExists} "$INSTDIR\nssm.exe"
        DetailPrint "NSSM installed at: $INSTDIR\nssm.exe"
    ${Else}
        MessageBox MB_OK|MB_ICONSTOP "Failed to copy NSSM to: $INSTDIR\nssm.exe$\n$\nInstallation cannot continue."
        Abort
    ${EndIf}
    
    ; ========================================
    ; Step 8: Create Logs Directory
    ; ========================================
    DetailPrint "Creating logs directory..."
    CreateDirectory "$INSTDIR\logs"
    
    ; ========================================
    ; Step 9: Copy Helper Scripts
    ; ========================================
    DetailPrint "Installing helper scripts..."
    File "${BUILD_DIR}\check_status.bat"
    
    ; ========================================
    ; Step 10: Stop Existing Service (if upgrading)
    ; ========================================
    DetailPrint "Checking for existing service..."
    nsExec::ExecToStack '"$INSTDIR\nssm.exe" status AptorAIAgent'
    Pop $0 ; exit code
    Pop $1 ; output
    DetailPrint "NSSM status exit code: $0"
    DetailPrint "NSSM status output: $1"
    ${If} $0 == 0
        DetailPrint "Stopping existing service..."
        nsExec::ExecToStack '"$INSTDIR\nssm.exe" stop AptorAIAgent'
        Pop $0
        Pop $1
        DetailPrint "NSSM stop exit code: $0"
        DetailPrint "NSSM stop output: $1"
        Sleep 2000
    ${EndIf}
    
    ; ========================================
    ; Step 11: Remove Existing Service (if upgrading)
    ; ========================================
    DetailPrint "Removing any existing service (if present)..."
    nsExec::ExecToStack '"$INSTDIR\nssm.exe" remove AptorAIAgent confirm'
    Pop $0
    Pop $1
    DetailPrint "NSSM remove exit code: $0"
    DetailPrint "NSSM remove output: $1"
    Sleep 1000
    
    ; ========================================
    ; Step 12: Install Windows Service with NSSM
    ; ========================================
    DetailPrint "Installing Windows Service..."

    ; Install the service (we already verified NSSM earlier when copying it)
    DetailPrint "Creating Windows service..."
    nsExec::ExecToStack '"$INSTDIR\nssm.exe" install AptorAIAgent "$INSTDIR\python\python.exe" "-m" "agent" "--host" "127.0.0.1" "--port" "8889"'
    Pop $0  ; Exit code
    Pop $1  ; Output
    DetailPrint "NSSM install exit code: $0"
    DetailPrint "NSSM install output: $1"
    ${If} $0 != 0
        ${AndIf} $0 != 5 ; Error 5 = service already exists (acceptable in some cases)
            MessageBox MB_OK|MB_ICONEXCLAMATION "Failed to create service.$\n$\nExit code: $0$\nOutput: $1$\n$\nInstaller will continue, but you may need to start/configure the service manually."
    ${EndIf}
    
    ; ========================================
    ; Step 13: Configure Service Parameters
    ; ========================================
    DetailPrint "Configuring service parameters..."
    
    ; Set working directory to installation root so Python can resolve the 'agent' package
    nsExec::ExecToStack '"$INSTDIR\nssm.exe" set AptorAIAgent AppDirectory "$INSTDIR"'
    Pop $0
    Pop $1
    
    ; Set display name and description
    nsExec::ExecToStack '"$INSTDIR\nssm.exe" set AptorAIAgent DisplayName "Aptor AI Competency Agent"'
    Pop $0
    Pop $1
    nsExec::ExecToStack '"$INSTDIR\nssm.exe" set AptorAIAgent Description "Local Python kernel for AI Competency Platform"'
    Pop $0
    Pop $1
    
    ; Set startup type to automatic
    nsExec::ExecToStack '"$INSTDIR\nssm.exe" set AptorAIAgent Start SERVICE_AUTO_START'
    Pop $0
    Pop $1
    
    ; Configure logging
    nsExec::ExecToStack '"$INSTDIR\nssm.exe" set AptorAIAgent AppStdout "$INSTDIR\logs\agent.log"'
    Pop $0
    Pop $1
    nsExec::ExecToStack '"$INSTDIR\nssm.exe" set AptorAIAgent AppStderr "$INSTDIR\logs\agent_error.log"'
    Pop $0
    Pop $1
    nsExec::ExecToStack '"$INSTDIR\nssm.exe" set AptorAIAgent AppRotateFiles 1'
    Pop $0
    Pop $1
    nsExec::ExecToStack '"$INSTDIR\nssm.exe" set AptorAIAgent AppRotateOnline 1'
    Pop $0
    Pop $1
    nsExec::ExecToStack '"$INSTDIR\nssm.exe" set AptorAIAgent AppRotateBytes 10485760'
    Pop $0
    Pop $1
    
    ; Configure restart on failure
    nsExec::ExecToStack '"$INSTDIR\nssm.exe" set AptorAIAgent AppExit Default Restart'
    Pop $0
    Pop $1
    nsExec::ExecToStack '"$INSTDIR\nssm.exe" set AptorAIAgent AppRestartDelay 5000'
    Pop $0
    Pop $1
    
    ; Set environment variables
    ; PYTHONPATH must include $INSTDIR so Python can import 'agent' as a module
    ; PYTHONUNBUFFERED ensures real-time output in logs
    ; NSSM AppEnvironmentExtra accepts newline-separated key=value pairs
    nsExec::ExecToStack '"$INSTDIR\nssm.exe" set AptorAIAgent AppEnvironmentExtra "PYTHONUNBUFFERED=1$\r$\nPYTHONPATH=$INSTDIR"'
    Pop $0
    Pop $1
    
    ; Configure service to run as LocalService account
    ; This allows the service to spawn child processes (Jupyter kernels) without SID mapping errors
    DetailPrint "Configuring service account..."
    nsExec::ExecToStack '"$INSTDIR\nssm.exe" set AptorAIAgent ObjectName "NT AUTHORITY\LocalService" ""'
    Pop $0
    Pop $1
    DetailPrint "Service account configuration exit code: $0"
    ${If} $0 != 0
        DetailPrint "Warning: Failed to set LocalService account (exit code: $0)"
        DetailPrint "Service will run as SYSTEM (may have process spawning limitations)"
    ${Else}
        DetailPrint "Service configured to run as LocalService"
    ${EndIf}
    
    ; ========================================
    ; Step 14: Start the Service
    ; ========================================
    DetailPrint "Starting Windows Service..."
    nsExec::ExecToStack '"$INSTDIR\nssm.exe" start AptorAIAgent'
    Pop $0  ; exit code
    Pop $1  ; output
    DetailPrint "Service start exit code: $0"
    DetailPrint "Service start output: $1"
    ${If} $0 != 0
        MessageBox MB_OK|MB_ICONEXCLAMATION \
            "Service created but failed to start.$\n$\nExit code: $0$\nOutput: $1$\n$\nYou can start it manually:$\n1. Open Services (services.msc)$\n2. Find 'Aptor AI Competency Agent'$\n3. Click 'Start'"
        StrCpy $ServiceInstalled "0"
    ${Else}
        StrCpy $ServiceInstalled "1"
        DetailPrint "Service started successfully!"
    ${EndIf}
    
    ; ========================================
    ; Step 15: Create Uninstaller
    ; ========================================
    DetailPrint "Creating uninstaller..."
    WriteUninstaller "$INSTDIR\uninstall.exe"
    
    ; ========================================
    ; Step 16: Register in Add/Remove Programs
    ; ========================================
    DetailPrint "Registering in Add/Remove Programs..."
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AptorAIAgent" \
        "DisplayName" "AI Competency Agent"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AptorAIAgent" \
        "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AptorAIAgent" \
        "Publisher" "Aptor"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AptorAIAgent" \
        "DisplayVersion" "1.0.0"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AptorAIAgent" \
        "HelpLink" "support@aptor.com"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AptorAIAgent" \
        "URLInfoAbout" "https://aptor.com"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AptorAIAgent" \
        "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AptorAIAgent" \
        "NoRepair" 1
    
    ; ========================================
    ; Step 17: Create Start Menu Shortcuts
    ; ========================================
    DetailPrint "Creating Start Menu shortcuts..."
    CreateDirectory "$SMPROGRAMS\AI Competency Agent"
    CreateShortcut "$SMPROGRAMS\AI Competency Agent\Check Agent Status.lnk" \
        "$INSTDIR\check_status.bat"
    CreateShortcut "$SMPROGRAMS\AI Competency Agent\View Logs.lnk" \
        "$INSTDIR\logs"
    CreateShortcut "$SMPROGRAMS\AI Competency Agent\Uninstall.lnk" \
        "$INSTDIR\uninstall.exe"
    
    DetailPrint "Installation completed successfully!"
SectionEnd

;--------------------------------
; Uninstaller Section

Section "Uninstall"
    ; Stop service
    DetailPrint "Stopping AI Competency Agent service..."
    IfFileExists "$INSTDIR\nssm.exe" 0 skip_stop
        nsExec::ExecToLog '"$INSTDIR\nssm.exe" stop AptorAIAgent'
        Pop $0
        Sleep 3000
    skip_stop:
    
    ; Remove service
    DetailPrint "Removing Windows Service..."
    IfFileExists "$INSTDIR\nssm.exe" 0 skip_remove
        nsExec::ExecToLog '"$INSTDIR\nssm.exe" remove AptorAIAgent confirm'
        Pop $0
        Sleep 1000
    skip_remove:
    
    ; Remove files and directories
    DetailPrint "Removing files..."
    RMDir /r "$INSTDIR\python"
    RMDir /r "$INSTDIR\agent"
    RMDir /r "$INSTDIR\logs"
    Delete "$INSTDIR\nssm.exe"
    Delete "$INSTDIR\check_status.bat"
    Delete "$INSTDIR\uninstall.exe"
    
    ; Remove installation directory (if empty)
    RMDir "$INSTDIR"
    
    ; Remove Start Menu shortcuts
    DetailPrint "Removing Start Menu shortcuts..."
    RMDir /r "$SMPROGRAMS\AI Competency Agent"
    
    ; Remove registry entries
    DetailPrint "Removing registry entries..."
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AptorAIAgent"
    
    DetailPrint "Uninstallation completed successfully!"
    MessageBox MB_OK "AI Competency Agent has been uninstalled successfully."
SectionEnd
