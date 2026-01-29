# AI Competency Agent - Windows Installer Build Script
# This script builds the Windows installer for the AI Competency Agent

#Requires -RunAsAdministrator

# Force TLS 1.2 for downloads
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Configuration
$PYTHON_VERSION = "3.11.8"
$PYTHON_EMBED_URL = "https://www.python.org/ftp/python/$PYTHON_VERSION/python-$PYTHON_VERSION-embed-amd64.zip"
$NSSM_VERSION = "2.24"
$NSSM_URL = "https://nssm.cc/release/nssm-$NSSM_VERSION.zip"
$BUILD_DIR = "build"
$DIST_DIR = "dist"
$AGENT_SOURCE = "../../"  # Path to agent source (from installer/windows/)
$INSTALLER_VERSION = "1.0.0"

# Color codes for output
$COLOR_INFO = "Cyan"
$COLOR_SUCCESS = "Green"
$COLOR_WARNING = "Yellow"
$COLOR_ERROR = "Red"

# Helper function for status messages
function Write-Status {
    param(
        [string]$Message,
        [string]$Type = "INFO"
    )
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    
    switch ($Type) {
        "INFO"    { Write-Host "[$timestamp] [*] $Message" -ForegroundColor $COLOR_INFO }
        "SUCCESS" { Write-Host "[$timestamp] [" -NoNewline; Write-Host "OK" -ForegroundColor $COLOR_SUCCESS -NoNewline; Write-Host "] $Message" }
        "WARNING" { Write-Host "[$timestamp] [" -NoNewline; Write-Host "!" -ForegroundColor $COLOR_WARNING -NoNewline; Write-Host "] $Message" }
        "ERROR"   { Write-Host "[$timestamp] [" -NoNewline; Write-Host "X" -ForegroundColor $COLOR_ERROR -NoNewline; Write-Host "] $Message" }
    }
}

# Check prerequisites
function Test-Prerequisites {
    Write-Status "Checking prerequisites..." "INFO"
    
    # Check if running as Administrator
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    $isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    
    if (-not $isAdmin) {
        Write-Status "This script requires Administrator privileges" "ERROR"
        Write-Status "Please run PowerShell as Administrator" "WARNING"
        exit 1
    }
    Write-Status "Administrator privileges confirmed" "SUCCESS"
    
    # Check if NSIS is installed
    $nsisPath = "C:\Program Files (x86)\NSIS\makensis.exe"
    if (-not (Test-Path $nsisPath)) {
        Write-Status "NSIS not found at: $nsisPath" "ERROR"
        Write-Status "Please install NSIS from: https://nsis.sourceforge.io/Download" "WARNING"
        exit 1
    }
    Write-Status "NSIS found at: $nsisPath" "SUCCESS"
    
    # Check if agent source exists
    $agentSourcePath = Join-Path $PSScriptRoot $AGENT_SOURCE
    if (-not (Test-Path $agentSourcePath)) {
        Write-Status "Agent source not found at: $agentSourcePath" "ERROR"
        exit 1
    }
    Write-Status "Agent source found" "SUCCESS"
    
    return $nsisPath
}

# Clean previous builds
function Clear-BuildDirectories {
    Write-Status "Cleaning previous builds..." "INFO"
    
    if (Test-Path $BUILD_DIR) {
        Remove-Item -Path $BUILD_DIR -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    if (Test-Path $DIST_DIR) {
        Remove-Item -Path $DIST_DIR -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    New-Item -ItemType Directory -Force -Path $BUILD_DIR | Out-Null
    New-Item -ItemType Directory -Force -Path $DIST_DIR | Out-Null
    
    Write-Status "Build directories ready" "SUCCESS"
}

# Download file with better error handling
function Get-FileWithProgress {
    param(
        [string]$Url,
        [string]$OutputPath
    )
    
    try {
        # Method 1: Try Invoke-WebRequest first (more reliable)
        Write-Host "    Downloading from: $Url" -ForegroundColor DarkGray
        
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $Url -OutFile $OutputPath -UseBasicParsing
        $ProgressPreference = 'Continue'
        
        if (Test-Path $OutputPath) {
            $fileSize = (Get-Item $OutputPath).Length / 1MB
            Write-Host "    Downloaded: $([math]::Round($fileSize, 2)) MB" -ForegroundColor DarkGray
            return $true
        }
        
        return $false
    }
    catch {
        Write-Status "Download failed (Method 1): $($_.Exception.Message)" "WARNING"
        
        # Method 2: Try WebClient as fallback
        try {
            Write-Host "    Trying alternative download method..." -ForegroundColor DarkGray
            
            $webClient = New-Object System.Net.WebClient
            $webClient.DownloadFile($Url, $OutputPath)
            
            if (Test-Path $OutputPath) {
                $fileSize = (Get-Item $OutputPath).Length / 1MB
                Write-Host "    Downloaded: $([math]::Round($fileSize, 2)) MB" -ForegroundColor DarkGray
                return $true
            }
            
            return $false
        }
        catch {
            Write-Status "Download failed (Method 2): $($_.Exception.Message)" "ERROR"
            return $false
        }
    }
}

# Download and extract Python embedded
function Get-PythonEmbedded {
    Write-Status "Downloading Python $PYTHON_VERSION embedded..." "INFO"
    
    $pythonZip = Join-Path $BUILD_DIR "python-embed.zip"
    $pythonDir = Join-Path $BUILD_DIR "python"
    
    # Download Python
    if (-not (Get-FileWithProgress -Url $PYTHON_EMBED_URL -OutputPath $pythonZip)) {
        Write-Status "Failed to download Python" "ERROR"
        Write-Status "Please check your internet connection and firewall settings" "WARNING"
        Write-Status "You can manually download from: $PYTHON_EMBED_URL" "WARNING"
        exit 1
    }
    Write-Status "Downloaded Python $PYTHON_VERSION embedded successfully" "SUCCESS"
    
    # Extract Python
    Write-Status "Extracting Python..." "INFO"
    New-Item -ItemType Directory -Force -Path $pythonDir | Out-Null
    
    try {
        Expand-Archive -Path $pythonZip -DestinationPath $pythonDir -Force
        Write-Status "Extracted Python embedded successfully" "SUCCESS"
    }
    catch {
        Write-Status "Failed to extract Python: $_" "ERROR"
        exit 1
    }
    
    # Configure Python for pip and agent module discovery
    Write-Status "Configuring Python for pip..." "INFO"
    $pthFile = Join-Path $pythonDir "python311._pth"
    if (Test-Path $pthFile) {
        # Read entire file as a single string
        $content = Get-Content $pthFile -Raw

        # Uncomment import site if it's commented in any common form
        $content = $content -replace '#\s*import site', 'import site'

        # Ensure we don't add duplicate '..' lines
        if ($content -notmatch '(^|\r?\n)\.\.(\r?\n|$)') {
            # Trim trailing newlines, then append our ".." line
            $content = $content.TrimEnd("`r", "`n") + "`r`n..`r`n"
        }

        Set-Content -Path $pthFile -Value $content -NoNewline
        Write-Status "python311._pth updated (import site + .. added)" "SUCCESS"

        # Also write a copy outside the python directory so NSIS can reliably pick up
        # the modified version at compile time (it scans ${BUILD_DIR} before runtime).
        $modifiedPth = Join-Path $BUILD_DIR "python311_modified._pth"
        Copy-Item -Path $pthFile -Destination $modifiedPth -Force
        Write-Status "Exported modified python311._pth to $modifiedPth" "INFO"
    }
    else {
        Write-Status "python311._pth not found" "WARNING"
    }
    
    return $pythonDir
}

# Install pip
function Install-Pip {
    param([string]$PythonDir)
    
    Write-Status "Downloading get-pip.py..." "INFO"
    
    # IMPORTANT: Place get-pip.py inside the embedded Python directory so NSIS
    # will pick it up when bundling ${BUILD_DIR}\python\*.* into the installer.
    $getPipPath = Join-Path $PythonDir "get-pip.py"
    $getPipUrl = "https://bootstrap.pypa.io/get-pip.py"
    
    if (-not (Get-FileWithProgress -Url $getPipUrl -OutputPath $getPipPath)) {
        Write-Status "Failed to download get-pip.py" "ERROR"
        exit 1
    }
    Write-Status "Downloaded get-pip.py successfully" "SUCCESS"
    
    Write-Status "Installing pip..." "INFO"
    $pythonExe = Join-Path $PythonDir "python.exe"
    
    # Run get-pip.py from inside the embedded Python directory
    $pipOutput = & $pythonExe $getPipPath --no-warn-script-location 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "pip installed successfully" "SUCCESS"
    }
    else {
        Write-Status "pip installation failed" "ERROR"
        Write-Host $pipOutput
        exit 1
    }
}

# Download and extract NSSM
function Get-NSSM {
    # Check for manually cached NSSM in the installer directory
    $cachedNssm = Join-Path $PSScriptRoot "nssm-cached.exe"
    if (Test-Path $cachedNssm) {
        Write-Status "Using cached NSSM from installer directory" "SUCCESS"
        $nssmDest = Join-Path $BUILD_DIR "nssm.exe"
        Copy-Item $cachedNssm $nssmDest -Force
        return
    }

    Write-Status "Downloading NSSM $NSSM_VERSION..." "INFO"
    
    $nssmZip = Join-Path $BUILD_DIR "nssm.zip"
    $nssmTempDir = Join-Path $BUILD_DIR "nssm-temp"
    
    # Download NSSM
    if (-not (Get-FileWithProgress -Url $NSSM_URL -OutputPath $nssmZip)) {
        Write-Status "Failed to download NSSM" "ERROR"
        exit 1
    }
    Write-Status "Downloaded NSSM $NSSM_VERSION successfully" "SUCCESS"
    
    # Extract NSSM
    Write-Status "Extracting NSSM..." "INFO"
    
    try {
        Expand-Archive -Path $nssmZip -DestinationPath $nssmTempDir -Force
        
        # Copy 64-bit NSSM executable
        $nssmExe = Join-Path $nssmTempDir "nssm-$NSSM_VERSION\win64\nssm.exe"
        $nssmDest = Join-Path $BUILD_DIR "nssm.exe"
        
        if (Test-Path $nssmExe) {
            Copy-Item $nssmExe $nssmDest -Force
            Write-Status "NSSM extracted successfully" "SUCCESS"
        }
        else {
            Write-Status "NSSM executable not found in archive" "ERROR"
            exit 1
        }
        
        # Cleanup temp directory
        Remove-Item $nssmTempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    catch {
        Write-Status "Failed to extract NSSM: $_" "ERROR"
        exit 1
    }
}

# Copy agent source files
function Copy-AgentSource {
    Write-Status "Copying agent source files..." "INFO"
    
    $agentSourcePath = Join-Path $PSScriptRoot $AGENT_SOURCE
    $agentDestPath = Join-Path $BUILD_DIR "agent"
    
    # Remove existing destination
    if (Test-Path $agentDestPath) {
        Remove-Item $agentDestPath -Recurse -Force
    }
    
    # Create destination directory
    New-Item -ItemType Directory -Path $agentDestPath -Force | Out-Null
    
    # CRITICAL: Exclude installer directory and other large/unnecessary directories
    # This prevents recursive copying of build artifacts (55GB+ problem!)
    $excludeDirs = @(
        "installer",      # Exclude installer directory (contains build/dist)
        "__pycache__",    # Exclude Python cache
        ".git",           # Exclude git repository
        ".venv",          # Exclude virtual environments
        "venv",
        "env",
        "node_modules",   # Exclude node modules (if any)
        "build",          # Exclude any build directories
        "dist"            # Exclude any dist directories
    )
    
    # Copy only necessary Python files and directories
    $filesToCopy = @(
        "__init__.py",
        "__main__.py",
        "server.py",
        "kernel_executor.py",
        "kernel_manager.py",
        "requirements.txt"
    )
    
    $copiedCount = 0
    
    # Copy individual Python files
    foreach ($file in $filesToCopy) {
        $sourceFile = Join-Path $agentSourcePath $file
        if (Test-Path $sourceFile) {
            Copy-Item $sourceFile (Join-Path $agentDestPath $file) -Force
            $copiedCount++
        }
    }
    
    # Copy features directory (only .py files, exclude __pycache__)
    $featuresSource = Join-Path $agentSourcePath "features"
    $featuresDest = Join-Path $agentDestPath "features"
    if (Test-Path $featuresSource) {
        New-Item -ItemType Directory -Path $featuresDest -Force | Out-Null
        Get-ChildItem -Path $featuresSource -Filter "*.py" -File | ForEach-Object {
            Copy-Item $_.FullName $featuresDest -Force
            $copiedCount++
        }
        # Copy __init__.py if it exists
        if (Test-Path (Join-Path $featuresSource "__init__.py")) {
            Copy-Item (Join-Path $featuresSource "__init__.py") (Join-Path $featuresDest "__init__.py") -Force
        }
    }
    
    # Verify requirements.txt exists
    $requirementsPath = Join-Path $agentDestPath "requirements.txt"
    if (-not (Test-Path $requirementsPath)) {
        Write-Status "requirements.txt not found in agent source" "WARNING"
    } else {
        Write-Status "Agent source files copied ($copiedCount files)" "SUCCESS"
    }
    
    Write-Status "Agent source files copied" "SUCCESS"
}

# Copy license file
function Copy-LicenseFile {
    Write-Status "Copying license file..." "INFO"
    
    $licenseSrc = Join-Path $PSScriptRoot "license.txt"
    $licenseDest = Join-Path $BUILD_DIR "license.txt"
    
    if (Test-Path $licenseSrc) {
        Copy-Item $licenseSrc $licenseDest -Force
        Write-Status "License file copied" "SUCCESS"
    }
    else {
        Write-Status "license.txt not found, creating placeholder..." "WARNING"
        $placeholderLicense = @"
AI Competency Agent - End User License Agreement
Copyright (c) 2024 Aptor. All rights reserved.

This software is provided for use with the AI Competency Platform.
By installing this software, you agree to the terms and conditions
of the AI Competency Platform service agreement.

For support, please contact: support@aptor.com
"@
        Set-Content -Path $licenseDest -Value $placeholderLicense
        Write-Status "Placeholder license created" "SUCCESS"
    }
}

# Create check_status.bat
function New-StatusCheckScript {
    Write-Status "Creating check_status.bat..." "INFO"
    
    $statusScript = @'
@echo off
title AI Competency Agent - Status Check
color 0A

echo ========================================
echo   AI Competency Agent Status Check
echo ========================================
echo.

REM Check if service exists
sc query AptorAIAgent >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Service not found
    echo Please reinstall AI Competency Agent
    goto end
)

REM Check if service is running
sc query AptorAIAgent | find "RUNNING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Service is RUNNING
) else (
    echo [WARNING] Service is NOT running
    echo.
    echo Attempting to start service...
    net start AptorAIAgent
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Service started successfully
    ) else (
        echo [ERROR] Failed to start service
        echo Check logs at: C:\Program Files\Aptor\Agent\logs\
    )
)

echo.
echo Checking port 8889...
netstat -an | find "8889" | find "LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Port 8889 is LISTENING
    echo WebSocket available at: ws://127.0.0.1:8889
) else (
    echo [ERROR] Port 8889 is NOT listening
    echo The agent may have failed to start
)

echo.
echo Service details:
sc qc AptorAIAgent

:end
echo.
echo ========================================
echo Press any key to exit...
pause >nul
'@
    
    $statusScriptPath = Join-Path $BUILD_DIR "check_status.bat"
    Set-Content -Path $statusScriptPath -Value $statusScript -Encoding ASCII
    
    Write-Status "check_status.bat created" "SUCCESS"
}

# Build installer with NSIS
function Build-Installer {
    param([string]$NsisPath)
    
    Write-Status "Building installer with NSIS..." "INFO"
    
    $installerScript = Join-Path $PSScriptRoot "installer.nsi"
    
    if (-not (Test-Path $installerScript)) {
        Write-Status "installer.nsi not found" "ERROR"
        exit 1
    }
    
    # Run NSIS with absolute BUILD_DIR so installer.nsi can resolve input/output paths
    $buildDirPath = (Resolve-Path $BUILD_DIR).Path
    
    $originalLocation = Get-Location
    Set-Location $PSScriptRoot
    
    $nsisOutput = & $NsisPath "/DBUILD_DIR=$buildDirPath" $installerScript 2>&1
    
    Set-Location $originalLocation
    
    if ($LASTEXITCODE -eq 0) {
        Write-Status "NSIS build completed" "SUCCESS"
    }
    else {
        Write-Status "NSIS build failed with exit code: $LASTEXITCODE" "ERROR"
        Write-Host $nsisOutput
        exit 1
    }
}

# Rename and move installer
function Move-Installer {
    Write-Status "Preparing final installer..." "INFO"
    
    # NSIS creates the installer in the build directory
    $builtInstaller = Join-Path $BUILD_DIR "AICompetencyAgent-Setup.exe"
    $finalInstaller = Join-Path $DIST_DIR "AICompetencyAgent-Setup-v$INSTALLER_VERSION.exe"
    
    if (Test-Path $builtInstaller) {
        Move-Item $builtInstaller $finalInstaller -Force
        Write-Status "Installer ready at: dist\AICompetencyAgent-Setup-v$INSTALLER_VERSION.exe" "SUCCESS"
        return $finalInstaller
    }
    else {
        Write-Status "Built installer not found at: $builtInstaller" "ERROR"
        exit 1
    }
}

# Main build process
function Start-Build {
    Write-Host ""
    Write-Host "========================================"  -ForegroundColor Cyan
    Write-Host "  Building AI Competency Agent Installer"  -ForegroundColor Cyan
    Write-Host "========================================"  -ForegroundColor Cyan
    Write-Host ""
    
    $startTime = Get-Date
    
    # Run build steps
    $nsisPath = Test-Prerequisites
    Clear-BuildDirectories
    $pythonDir = Get-PythonEmbedded
    Install-Pip -PythonDir $pythonDir
    Get-NSSM
    Copy-AgentSource
    Copy-LicenseFile
    New-StatusCheckScript
    Build-Installer -NsisPath $nsisPath
    $finalInstaller = Move-Installer
    
    # Calculate build time
    $endTime = Get-Date
    $buildTime = ($endTime - $startTime).TotalSeconds
    
    # Get installer size
    $installerSize = (Get-Item $finalInstaller).Length / 1MB
    
    # Display success message
    Write-Host ""
    Write-Host "========================================"  -ForegroundColor Green
    Write-Host "  Build completed successfully!"  -ForegroundColor Green
    Write-Host "========================================"  -ForegroundColor Green
    Write-Host ""
    Write-Host "Installer: " -NoNewline
    Write-Host $finalInstaller -ForegroundColor Cyan
    Write-Host "Size: " -NoNewline
    Write-Host ("{0:N1} MB" -f $installerSize) -ForegroundColor Cyan
    Write-Host "Build time: " -NoNewline
    Write-Host ("{0:N1} seconds" -f $buildTime) -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Test installer: .\dist\AICompetencyAgent-Setup-v$INSTALLER_VERSION.exe"
    Write-Host "2. Verify service starts and port 8889 is listening"
    Write-Host "3. Test WebSocket connection from browser"
    Write-Host ""
    Write-Host "========================================"  -ForegroundColor Green
}

# Run the build
try {
    Start-Build
}
catch {
    Write-Status "Build failed with error: $_" "ERROR"
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}