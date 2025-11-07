@echo off
REM Batch script to start Starlink Performance monitoring in WSL
REM This can be run by Windows Task Scheduler or manually

REM Wait for WSL to be ready
timeout /t 5 /nobreak > nul

REM Run the startup script in WSL
wsl.exe -d Ubuntu -u david -- bash /home/david/levante/starlink-performance/scripts/start-all.sh

REM Log the startup
echo %date% %time% - Starlink monitoring started >> %USERPROFILE%\starlink-startup.log
