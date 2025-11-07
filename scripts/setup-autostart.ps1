# PowerShell script to automatically set up Starlink monitoring to start on boot
# Run this in PowerShell as Administrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starlink Monitoring Auto-Start Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠️  Warning: Not running as Administrator" -ForegroundColor Yellow
    Write-Host "   Some settings may not apply correctly." -ForegroundColor Yellow
    Write-Host "   For best results, run PowerShell as Administrator." -ForegroundColor Yellow
    Write-Host ""
}

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName "StarlinkMonitoring" -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "⚠️  Task 'StarlinkMonitoring' already exists." -ForegroundColor Yellow
    $response = Read-Host "   Do you want to replace it? (Y/N)"
    if ($response -ne "Y" -and $response -ne "y") {
        Write-Host "   Setup cancelled." -ForegroundColor Yellow
        exit
    }
    Unregister-ScheduledTask -TaskName "StarlinkMonitoring" -Confirm:$false
    Write-Host "   Removed existing task." -ForegroundColor Green
}

Write-Host "Creating scheduled task..." -ForegroundColor Cyan

# Create the task action
$action = New-ScheduledTaskAction -Execute "wsl.exe" -Argument "-d Ubuntu -u david -- bash /home/david/levante/starlink-performance/scripts/start-all.sh"

# Create the trigger (30 seconds after logon)
$trigger = New-ScheduledTaskTrigger -AtLogOn
$trigger.Delay = "PT30S"  # 30 second delay

# Create settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Create principal (run as current user)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

# Register the task
try {
    Register-ScheduledTask `
        -TaskName "StarlinkMonitoring" `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal `
        -Description "Automatically starts Starlink Performance monitoring services in WSL on login" `
        -ErrorAction Stop | Out-Null
    
    Write-Host ""
    Write-Host "✅ Success! Task 'StarlinkMonitoring' has been created." -ForegroundColor Green
    Write-Host ""
    Write-Host "Configuration:" -ForegroundColor Cyan
    Write-Host "  • Triggers: 30 seconds after you log in" -ForegroundColor White
    Write-Host "  • Command: wsl.exe -d Ubuntu -u david -- bash .../start-all.sh" -ForegroundColor White
    Write-Host "  • Works on battery power: Yes" -ForegroundColor White
    Write-Host "  • Auto-retry on failure: 3 times, 1 minute apart" -ForegroundColor White
    Write-Host ""
    
    # Test the task
    Write-Host "Testing the task now..." -ForegroundColor Cyan
    Start-ScheduledTask -TaskName "StarlinkMonitoring"
    Start-Sleep -Seconds 2
    
    Write-Host ""
    Write-Host "Task has been triggered. Check WSL to verify services started:" -ForegroundColor Cyan
    Write-Host "  wsl.exe -d Ubuntu -u david -- bash /home/david/levante/starlink-performance/scripts/check-status.sh" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Verify services are running (command above)" -ForegroundColor White
    Write-Host "  2. Reboot to test automatic startup" -ForegroundColor White
    Write-Host "  3. After reboot, check status again" -ForegroundColor White
    Write-Host ""
    Write-Host "To view/manage the task:" -ForegroundColor Cyan
    Write-Host "  • Open Task Scheduler: taskschd.msc" -ForegroundColor White
    Write-Host "  • Look for: StarlinkMonitoring" -ForegroundColor White
    Write-Host ""
    Write-Host "To remove auto-start:" -ForegroundColor Cyan
    Write-Host "  Unregister-ScheduledTask -TaskName 'StarlinkMonitoring' -Confirm:`$false" -ForegroundColor Yellow
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "❌ Error creating task: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running this script as Administrator." -ForegroundColor Yellow
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
