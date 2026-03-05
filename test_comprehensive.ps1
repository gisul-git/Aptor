# Comprehensive Test - All Roles, Difficulties, and Task Types

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "COMPREHENSIVE AI QUESTION GENERATOR TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$results = @()
$testCount = 0
$passCount = 0

function Test-Question {
    param(
        [string]$Role,
        [string]$Difficulty,
        [string]$TaskType,
        [string]$Topic,
        [int]$ExpectedTime,
        [int]$MinConstraints,
        [int]$MaxConstraints,
        [string]$ExpectedCanvas
    )
    
    $script:testCount++
    
    $body = @{
        role = $Role
        difficulty = $Difficulty
        task_type = $TaskType
        topic = $Topic
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3006/api/v1/design/questions/generate" -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
        
        $canvas = $response.constraints | Where-Object { $_ -match 'Canvas' }
        $constraintCount = $response.constraints.Count
        $hasYou = $response.description -match '\byou\b|\byour\b'
        
        $canvasPass = $canvas -match $ExpectedCanvas
        $countPass = $constraintCount -ge $MinConstraints -and $constraintCount -le $MaxConstraints
        $timePass = $response.time_limit_minutes -eq $ExpectedTime
        $langPass = -not $hasYou
        
        $allPass = $canvasPass -and $countPass -and $timePass -and $langPass
        
        if ($allPass) { $script:passCount++ }
        
        $result = [PSCustomObject]@{
            Test = "$Role - $Difficulty - $TaskType"
            Title = $response.title
            Canvas = $canvas
            CanvasPass = $canvasPass
            Constraints = $constraintCount
            CountPass = $countPass
            Time = $response.time_limit_minutes
            TimePass = $timePass
            Language = if ($langPass) { "Clean" } else { "Has you/your" }
            LangPass = $langPass
            Overall = if ($allPass) { "PASS" } else { "FAIL" }
        }
        
        return $result
    }
    catch {
        Write-Host "ERROR: $_" -ForegroundColor Red
        return $null
    }
}

Write-Host "Testing UI Designer..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# UI Designer Tests
$results += Test-Question -Role "ui_designer" -Difficulty "beginner" -TaskType "mobile_app" -Topic "E-Commerce" -ExpectedTime 45 -MinConstraints 5 -MaxConstraints 6 -ExpectedCanvas "375px|360px"
Start-Sleep -Seconds 2

$results += Test-Question -Role "ui_designer" -Difficulty "intermediate" -TaskType "dashboard" -Topic "Analytics" -ExpectedTime 60 -MinConstraints 7 -MaxConstraints 8 -ExpectedCanvas "1440px|1280px"
Start-Sleep -Seconds 2

$results += Test-Question -Role "ui_designer" -Difficulty "advanced" -TaskType "mobile_app" -Topic "Banking" -ExpectedTime 90 -MinConstraints 8 -MaxConstraints 10 -ExpectedCanvas "375px|360px"
Start-Sleep -Seconds 2

Write-Host "Testing UX Designer..." -ForegroundColor Yellow

# UX Designer Tests
$results += Test-Question -Role "ux_designer" -Difficulty "beginner" -TaskType "mobile_app" -Topic "Social Media" -ExpectedTime 45 -MinConstraints 5 -MaxConstraints 6 -ExpectedCanvas "375px|360px"
Start-Sleep -Seconds 2

$results += Test-Question -Role "ux_designer" -Difficulty "intermediate" -TaskType "dashboard" -Topic "Project Management" -ExpectedTime 60 -MinConstraints 7 -MaxConstraints 8 -ExpectedCanvas "1440px|1280px"
Start-Sleep -Seconds 2

$results += Test-Question -Role "ux_designer" -Difficulty "advanced" -TaskType "mobile_app" -Topic "Healthcare" -ExpectedTime 90 -MinConstraints 8 -MaxConstraints 10 -ExpectedCanvas "375px|360px"
Start-Sleep -Seconds 2

Write-Host "Testing Product Designer..." -ForegroundColor Yellow

# Product Designer Tests
$results += Test-Question -Role "product_designer" -Difficulty "beginner" -TaskType "mobile_app" -Topic "Fitness" -ExpectedTime 45 -MinConstraints 5 -MaxConstraints 6 -ExpectedCanvas "375px|360px"
Start-Sleep -Seconds 2

$results += Test-Question -Role "product_designer" -Difficulty "intermediate" -TaskType "dashboard" -Topic "CRM" -ExpectedTime 60 -MinConstraints 7 -MaxConstraints 8 -ExpectedCanvas "1440px|1280px"
Start-Sleep -Seconds 2

$results += Test-Question -Role "product_designer" -Difficulty "advanced" -TaskType "landing_page" -Topic "SaaS Product" -ExpectedTime 90 -MinConstraints 8 -MaxConstraints 10 -ExpectedCanvas "1440px|1280px"
Start-Sleep -Seconds 2

Write-Host "Testing Visual Designer..." -ForegroundColor Yellow

# Visual Designer Tests
$results += Test-Question -Role "visual_designer" -Difficulty "beginner" -TaskType "mobile_app" -Topic "Travel" -ExpectedTime 45 -MinConstraints 5 -MaxConstraints 6 -ExpectedCanvas "375px|360px"
Start-Sleep -Seconds 2

$results += Test-Question -Role "visual_designer" -Difficulty "intermediate" -TaskType "landing_page" -Topic "Marketing Campaign" -ExpectedTime 60 -MinConstraints 7 -MaxConstraints 8 -ExpectedCanvas "1440px|1280px"
Start-Sleep -Seconds 2

# Landing Page Tests
Write-Host "Testing Landing Pages..." -ForegroundColor Yellow

$results += Test-Question -Role "ui_designer" -Difficulty "beginner" -TaskType "landing_page" -Topic "Startup" -ExpectedTime 45 -MinConstraints 5 -MaxConstraints 6 -ExpectedCanvas "1440px|1280px"
Start-Sleep -Seconds 2

$results += Test-Question -Role "ui_designer" -Difficulty "intermediate" -TaskType "landing_page" -Topic "Product Launch" -ExpectedTime 60 -MinConstraints 7 -MaxConstraints 8 -ExpectedCanvas "1440px|1280px"
Start-Sleep -Seconds 2

# Component Tests
Write-Host "Testing Components..." -ForegroundColor Yellow

$results += Test-Question -Role "ui_designer" -Difficulty "beginner" -TaskType "component" -Topic "Button System" -ExpectedTime 45 -MinConstraints 5 -MaxConstraints 6 -ExpectedCanvas "1440px|1280px"
Start-Sleep -Seconds 2

$results += Test-Question -Role "ui_designer" -Difficulty "intermediate" -TaskType "component" -Topic "Card Components" -ExpectedTime 60 -MinConstraints 7 -MaxConstraints 8 -ExpectedCanvas "1440px|1280px"
Start-Sleep -Seconds 2

# Display Results
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$results | Format-Table -Property Test, Canvas, CanvasPass, Constraints, CountPass, Time, TimePass, Language, Overall -AutoSize

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "DETAILED ANALYSIS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$canvasFails = $results | Where-Object { -not $_.CanvasPass }
$countFails = $results | Where-Object { -not $_.CountPass }
$timeFails = $results | Where-Object { -not $_.TimePass }
$langFails = $results | Where-Object { -not $_.LangPass }

Write-Host "`nCanvas Width Issues: $($canvasFails.Count)" -ForegroundColor $(if ($canvasFails.Count -eq 0) { "Green" } else { "Red" })
if ($canvasFails.Count -gt 0) {
    $canvasFails | ForEach-Object { Write-Host "  - $($_.Test): $($_.Canvas)" -ForegroundColor Red }
}

Write-Host "`nConstraint Count Issues: $($countFails.Count)" -ForegroundColor $(if ($countFails.Count -eq 0) { "Green" } else { "Red" })
if ($countFails.Count -gt 0) {
    $countFails | ForEach-Object { Write-Host "  - $($_.Test): $($_.Constraints) constraints" -ForegroundColor Red }
}

Write-Host "`nTime Limit Issues: $($timeFails.Count)" -ForegroundColor $(if ($timeFails.Count -eq 0) { "Green" } else { "Red" })
if ($timeFails.Count -gt 0) {
    $timeFails | ForEach-Object { Write-Host "  - $($_.Test): $($_.Time) minutes" -ForegroundColor Red }
}

Write-Host "`nLanguage Issues: $($langFails.Count)" -ForegroundColor $(if ($langFails.Count -eq 0) { "Green" } else { "Red" })
if ($langFails.Count -gt 0) {
    $langFails | ForEach-Object { Write-Host "  - $($_.Test): Contains you/your" -ForegroundColor Red }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "FINAL SCORE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$passRate = [math]::Round(($passCount / $testCount) * 100, 1)

Write-Host "`nTests Passed: $passCount / $testCount ($passRate%)" -ForegroundColor $(if ($passRate -ge 90) { "Green" } elseif ($passRate -ge 70) { "Yellow" } else { "Red" })

if ($passRate -eq 100) {
    Write-Host "`n[SUCCESS] ALL TESTS PASSED - PRODUCTION READY!" -ForegroundColor Green
} elseif ($passRate -ge 90) {
    Write-Host "`n[GOOD] Most tests passed - Minor issues to fix" -ForegroundColor Yellow
} elseif ($passRate -ge 70) {
    Write-Host "`n[WARNING] Some tests failed - Needs attention" -ForegroundColor Yellow
} else {
    Write-Host "`n[CRITICAL] Many tests failed - Major fixes needed" -ForegroundColor Red
}

Write-Host ""

# Export results to CSV
$results | Export-Csv -Path "test_results.csv" -NoTypeInformation
Write-Host "Results exported to test_results.csv" -ForegroundColor Cyan
