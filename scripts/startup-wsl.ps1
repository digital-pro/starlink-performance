# PowerShell script to start Starlink Performance monitoring in WSL
# This is run by Windows Task Scheduler on boot/login

# Wait for WSL to be fully ready
Start-Sleep -Seconds 5

# Run the startup script in WSL
wsl.exe -d Ubuntu -u david -- bash /home/david/levante/starlink-performance/scripts/start-all.sh

# Log the startup
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path "$env:USERPROFILE\starlink-startup.log" -Value "$timestamp - Starlink monitoring started"
