$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$devopsApiDir = Join-Path $repoRoot "services/devops/execution_api"
$gatewayDir = Join-Path $repoRoot "services/api-gateway"
$frontendDir = Join-Path $repoRoot "frontend"

function Start-ServiceWindow {
    param(
        [string]$Title,
        [string]$WorkingDir,
        [string]$Command
    )

    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "`$Host.UI.RawUI.WindowTitle='$Title'; cd '$WorkingDir'; $Command"
    )
}

Write-Host "Starting DevOps local stack..."

# DevOps FastAPI
$devopsCommand = @"
if (!(Test-Path '.\.venv\Scripts\python.exe')) {
  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  pip install -r requirements.txt
} else {
  .\.venv\Scripts\Activate.ps1
}
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"@
Start-ServiceWindow -Title "DevOps FastAPI :8000" -WorkingDir $devopsApiDir -Command $devopsCommand

# API Gateway
$gatewayCommand = @"
npm install
npm run dev
"@
Start-ServiceWindow -Title "API Gateway :8080" -WorkingDir $gatewayDir -Command $gatewayCommand

# Frontend
$frontendCommand = @"
npm install
npm run dev -- -p 3001
"@
Start-ServiceWindow -Title "Frontend :3001" -WorkingDir $frontendDir -Command $frontendCommand

Write-Host "Started:"
Write-Host " - DevOps FastAPI: http://localhost:8000"
Write-Host " - API Gateway:   http://localhost:8080"
Write-Host " - Frontend:      http://localhost:3001/devops"
