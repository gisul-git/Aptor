# Test AI Question Generator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TEST 1: BEGINNER - MOBILE APP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$body = @{
    role = "ui_designer"
    difficulty = "beginner"
    task_type = "mobile_app"
    topic = "Food Delivery"
    experience_level = "Fresher"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3006/api/v1/design/questions/generate" -Method Post -Body $body -ContentType "application/json"

Write-Host "`nTITLE:" -ForegroundColor Yellow
Write-Host $response.title

Write-Host "`nROLE: $($response.role) | DIFFICULTY: $($response.difficulty) | TIME: $($response.time_limit_minutes) min" -ForegroundColor Green

Write-Host "`nDESCRIPTION:" -ForegroundColor Yellow
Write-Host $response.description

Write-Host "`nCONSTRAINTS:" -ForegroundColor Yellow
$response.constraints | ForEach-Object { Write-Host "  • $_" }

Write-Host "`nDELIVERABLES:" -ForegroundColor Yellow
$response.deliverables | ForEach-Object { Write-Host "  • $_" }

Write-Host "`nEVALUATION CRITERIA:" -ForegroundColor Yellow
$response.evaluation_criteria | ForEach-Object { Write-Host "  • $_" }

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST 2: INTERMEDIATE - DASHBOARD" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$body2 = @{
    role = "ui_designer"
    difficulty = "intermediate"
    task_type = "dashboard"
    topic = "Food Delivery"
    experience_level = "1-3 years"
} | ConvertTo-Json

$response2 = Invoke-RestMethod -Uri "http://localhost:3006/api/v1/design/questions/generate" -Method Post -Body $body2 -ContentType "application/json"

Write-Host "`nTITLE:" -ForegroundColor Yellow
Write-Host $response2.title

Write-Host "`nROLE: $($response2.role) | DIFFICULTY: $($response2.difficulty) | TIME: $($response2.time_limit_minutes) min" -ForegroundColor Green

Write-Host "`nDESCRIPTION:" -ForegroundColor Yellow
Write-Host $response2.description

Write-Host "`nCONSTRAINTS:" -ForegroundColor Yellow
$response2.constraints | ForEach-Object { Write-Host "  • $_" }

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST 3: ADVANCED - MOBILE APP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$body3 = @{
    role = "ux_designer"
    difficulty = "advanced"
    task_type = "mobile_app"
    topic = "Hospital Dashboard"
    experience_level = "3-5 years"
} | ConvertTo-Json

$response3 = Invoke-RestMethod -Uri "http://localhost:3006/api/v1/design/questions/generate" -Method Post -Body $body3 -ContentType "application/json"

Write-Host "`nTITLE:" -ForegroundColor Yellow
Write-Host $response3.title

Write-Host "`nROLE: $($response3.role) | DIFFICULTY: $($response3.difficulty) | TIME: $($response3.time_limit_minutes) min" -ForegroundColor Green

Write-Host "`nDESCRIPTION:" -ForegroundColor Yellow
Write-Host $response3.description

Write-Host "`nCONSTRAINTS:" -ForegroundColor Yellow
$response3.constraints | ForEach-Object { Write-Host "  • $_" }

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "VERIFICATION CHECKS" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Check canvas widths
$canvas1 = $response.constraints | Where-Object { $_ -match "Canvas width" }
$canvas2 = $response2.constraints | Where-Object { $_ -match "Canvas width" }
$canvas3 = $response3.constraints | Where-Object { $_ -match "Canvas width" }

Write-Host "`nCanvas Width Check:" -ForegroundColor Yellow
Write-Host "  Test 1 (mobile_app): $canvas1" -ForegroundColor $(if ($canvas1 -match "375px|360px") { "Green" } else { "Red" })
Write-Host "  Test 2 (dashboard): $canvas2" -ForegroundColor $(if ($canvas2 -match "1440px|1280px") { "Green" } else { "Red" })
Write-Host "  Test 3 (mobile_app): $canvas3" -ForegroundColor $(if ($canvas3 -match "375px|360px") { "Green" } else { "Red" })

# Check for "you/your" language
$hasYou1 = $response.description -match "\byou\b|\byour\b"
$hasYou2 = $response2.description -match "\byou\b|\byour\b"
$hasYou3 = $response3.description -match "\byou\b|\byour\b"

Write-Host "`nNeutral Language Check:" -ForegroundColor Yellow
Write-Host "  Test 1: $(if (!$hasYou1) { 'PASS - No you/your' } else { 'FAIL - Contains you/your' })" -ForegroundColor $(if (!$hasYou1) { "Green" } else { "Red" })
Write-Host "  Test 2: $(if (!$hasYou2) { 'PASS - No you/your' } else { 'FAIL - Contains you/your' })" -ForegroundColor $(if (!$hasYou2) { "Green" } else { "Red" })
Write-Host "  Test 3: $(if (!$hasYou3) { 'PASS - No you/your' } else { 'FAIL - Contains you/your' })" -ForegroundColor $(if (!$hasYou3) { "Green" } else { "Red" })

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TESTS COMPLETED" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
