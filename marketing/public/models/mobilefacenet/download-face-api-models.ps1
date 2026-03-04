# Download face-api.js face recognition model files
# These will replace the corrupted MobileFaceNet model

$baseUrl = "https://github.com/justadudewhohacks/face-api.js-models/raw/master"
$modelPath = $PSScriptRoot

Write-Host "Downloading face-api.js face recognition model files..."
Write-Host "Target directory: $modelPath"

# Download manifest file
$manifestUrl = "$baseUrl/face_recognition_model-weights_manifest.json"
Write-Host "Downloading manifest: $manifestUrl"
try {
    Invoke-WebRequest -Uri $manifestUrl -OutFile "$modelPath\face_recognition_model-weights_manifest.json" -UseBasicParsing
    Write-Host "✓ Manifest downloaded"
} catch {
    Write-Host "✗ Failed to download manifest: $_"
    Write-Host "Please download manually from: https://github.com/justadudewhohacks/face-api.js-models"
    exit 1
}

# Download shard files
$shard1Url = "$baseUrl/face_recognition_model-shard1"
Write-Host "Downloading shard1: $shard1Url"
try {
    Invoke-WebRequest -Uri $shard1Url -OutFile "$modelPath\face_recognition_model-shard1" -UseBasicParsing
    Write-Host "✓ Shard1 downloaded"
} catch {
    Write-Host "✗ Failed to download shard1: $_"
    Write-Host "Please download manually from: https://github.com/justadudewhohacks/face-api.js-models"
    exit 1
}

$shard2Url = "$baseUrl/face_recognition_model-shard2"
Write-Host "Downloading shard2: $shard2Url"
try {
    Invoke-WebRequest -Uri $shard2Url -OutFile "$modelPath\face_recognition_model-shard2" -UseBasicParsing
    Write-Host "✓ Shard2 downloaded"
} catch {
    Write-Host "✗ Failed to download shard2: $_"
    Write-Host "Please download manually from: https://github.com/justadudewhohacks/face-api.js-models"
    exit 1
}

Write-Host ""
Write-Host "All files downloaded successfully!"
Write-Host "Next steps:"
Write-Host "1. Rename face_recognition_model-weights_manifest.json to model.json"
Write-Host "2. Update paths in model.json to point to shard files"
