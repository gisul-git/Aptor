# Final Verification Test

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "FINAL VERIFICATION TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Start-Sleep -Seconds 8

# Test 1: Beginner Mobile Healthcare
Write-Host "`n1. BEGINNER - Healthcare Mobile App" -ForegroundColor Yellow
$body1 = '{"role":"ui_designer","difficulty":"beginner","task_type":"mobile_app","topic":"Healthcare"}'
$r1 = Invoke-RestMethod -Uri "http://localhost:3006/api/v1/design/questions/generate" -Method Post -Body $body1 -ContentType "application/json"

Write-Host "Title: $($r1.title)" -ForegroundColor White
Write-Host "Time: $($r1.time_limit_minutes) minutes" -ForegroundColor White
Write-Host "`nConstraints ($($r1.constraints.Count) total):" -ForegroundColor Green
$r1.constraints | ForEach-Object { Write-Host "  • $_" }

# Test 2: Intermediate Dashboard Healthcare
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "2. INTERMEDIATE - Healthcare Portal Dashboard" -ForegroundColor Yellow
$body2 = '{"role":"ui_designer","difficulty":"intermediate","task_type":"dashboard","topic":"Healthcare Portal"}'
$r2 = Invoke-RestMethod -Uri "http://localhost:3006/api/v1/design/questions/generate" -Method Post -Body $body2 -ContentType "application/json"

Write-Host "Title: $($r2.title)" -ForegroundColor White
Write-Host "Time: $($r2.time_limit_minutes) minutes" -ForegroundColor White
Write-Host "`nConstraints ($($r2.constraints.Count) total):" -ForegroundColor Green
$r2.constraints | ForEach-Object { Write-Host "  • $_" }

# Verification
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "VERIFICATION RESULTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$canvas1 = $r1.constraints | Where-Object { $_ -match 'Canvas' }
$canvas2 = $r2.constraints | Where-Object { $_ -match 'Canvas' }

Write-Host "`n✓ Canvas Width Check:" -ForegroundColor Yellow
if ($canvas1 -match "375px|360px") {
    Write-Host "  Test 1: PASS - $canvas1" -ForegroundColor Green
} else {
    Write-Host "  Test 1: FAIL - $canvas1" -ForegroundColor Red
}

if ($canvas2 -match "1440px|1280px") {
    Write-Host "  Test 2: PASS - $canvas2" -ForegroundColor Green
} else {
    Write-Host "  Test 2: FAIL - $canvas2" -ForegroundColor Red
}

Write-Host "`n✓ Constraint Count Check:" -ForegroundColor Yellow
if ($r1.constraints.Count -ge 5 -and $r1.constraints.Count -le 6) {
    Write-Host "  Test 1: PASS - $($r1.constraints.Count) constraints (ideal 5-6 for beginner)" -ForegroundColor Green
} elseif ($r1.constraints.Count -le 7) {
    Write-Host "  Test 1: ACCEPTABLE - $($r1.constraints.Count) constraints (recommended 5-6)" -ForegroundColor Yellow
} else {
    Write-Host "  Test 1: TOO MANY - $($r1.constraints.Count) constraints (should be 5-6)" -ForegroundColor Red
}

if ($r2.constraints.Count -ge 7 -and $r2.constraints.Count -le 8) {
    Write-Host "  Test 2: PASS - $($r2.constraints.Count) constraints (ideal 7-8 for intermediate)" -ForegroundColor Green
} else {
    Write-Host "  Test 2: $($r2.constraints.Count) constraints (recommended 7-8)" -ForegroundColor Yellow
}

Write-Host "`n✓ Neutral Language Check:" -ForegroundColor Yellow
$hasYou1 = $r1.description -match "\byou\b|\byour\b"
$hasYou2 = $r2.description -match "\byou\b|\byour\b"

if (!$hasYou1) {
    Write-Host "  Test 1: PASS - No 'you/your' language" -ForegroundColor Green
} else {
    Write-Host "  Test 1: FAIL - Contains 'you/your'" -ForegroundColor Red
}

if (!$hasYou2) {
    Write-Host "  Test 2: PASS - No 'you/your' language" -ForegroundColor Green
} else {
    Write-Host "  Test 2: FAIL - Contains 'you/your'" -ForegroundColor Red
}

Write-Host "`n✓ Time Limit Check:" -ForegroundColor Yellow
if ($r1.time_limit_minutes -eq 45) {
    Write-Host "  Test 1: PASS - 45 minutes (correct for beginner)" -ForegroundColor Green
} else {
    Write-Host "  Test 1: $($r1.time_limit_minutes) minutes (expected 45)" -ForegroundColor Yellow
}

if ($r2.time_limit_minutes -eq 60) {
    Write-Host "  Test 2: PASS - 60 minutes (correct for intermediate)" -ForegroundColor Green
} else {
    Write-Host "  Test 2: $($r2.time_limit_minutes) minutes (expected 60)" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "FINAL SCORE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

$score1 = 0
$score2 = 0

if ($canvas1 -match "375px|360px") { $score1 += 3 }
if ($r1.constraints.Count -ge 5 -and $r1.constraints.Count -le 7) { $score1 += 2 }
if (!$hasYou1) { $score1 += 2 }
if ($r1.time_limit_minutes -eq 45) { $score1 += 1 }

if ($canvas2 -match "1440px|1280px") { $score2 += 3 }
if ($r2.constraints.Count -ge 7 -and $r2.constraints.Count -le 8) { $score2 += 2 }
if (!$hasYou2) { $score2 += 2 }
if ($r2.time_limit_minutes -eq 60) { $score2 += 1 }

Write-Host "Beginner Question: $score1/8" -ForegroundColor $(if ($score1 -ge 7) { "Green" } elseif ($score1 -ge 5) { "Yellow" } else { "Red" })
Write-Host "Intermediate Question: $score2/8" -ForegroundColor $(if ($score2 -ge 7) { "Green" } elseif ($score2 -ge 5) { "Yellow" } else { "Red" })

if ($score1 -ge 7 -and $score2 -ge 7) {
    Write-Host "`n[PASS] ALL TESTS PASSED - PRODUCTION READY!" -ForegroundColor Green
} elseif ($score1 -ge 5 -and $score2 -ge 5) {
    Write-Host "`n[WARN] MOSTLY PASSING - Minor improvements needed" -ForegroundColor Yellow
} else {
    Write-Host "`n[FAIL] TESTS FAILED - Needs fixes" -ForegroundColor Red
}

Write-Host ""
