# Auto-Start on Boot Setup Guide

This guide will help you configure automatic startup of Starlink Performance monitoring services when Windows boots.

## 🎯 Goal

After setup, the monitoring stack will automatically start:
- 30 seconds after you log into Windows
- Without any manual intervention
- In the background (no visible windows)

---

## 📋 Prerequisites

- Windows 10/11 with WSL2
- Ubuntu distribution installed in WSL
- Administrative privileges (for Task Scheduler)

---

## ✅ Method 1: Import Task Scheduler XML (Recommended - Easiest)

### Step 1: Get the Windows path to the XML file

In **PowerShell**, run:

```powershell
wsl.exe wslpath -w /home/david/levante/starlink-performance/scripts/StarlinkMonitoring-Task.xml
```

This will output something like:
```
\\wsl.localhost\Ubuntu\home\david\levante\starlink-performance\scripts\StarlinkMonitoring-Task.xml
```

Copy this path.

### Step 2: Open Task Scheduler

1. Press `Win + R`
2. Type `taskschd.msc`
3. Press Enter

### Step 3: Import the Task

1. In Task Scheduler, click **"Action"** → **"Import Task..."**
2. Browse to the XML file using the path from Step 1
3. You may need to copy the file to a regular Windows folder (like Desktop) first
4. Click **"OK"**
5. The task "StarlinkMonitoring" will be created

### Step 4: Verify

1. In Task Scheduler, find **"StarlinkMonitoring"** in the task list
2. Right-click → **"Run"** to test it immediately
3. Check that services started: In WSL, run:
   ```bash
   cd /home/david/levante/starlink-performance
   bash scripts/check-status.sh
   ```

### Step 5: Done!

The task will now run automatically 30 seconds after you log in to Windows.

---

## 🔧 Method 2: Create Task Manually (Alternative)

If importing doesn't work, create the task manually:

### Step 1: Open Task Scheduler

1. Press `Win + R`
2. Type `taskschd.msc`
3. Press Enter

### Step 2: Create Basic Task

1. Click **"Action"** → **"Create Task..."** (not "Create Basic Task")
2. **General Tab:**
   - Name: `StarlinkMonitoring`
   - Description: `Automatically starts Starlink Performance monitoring`
   - Uncheck: "Run only when user is logged on" (if you want it to run in background)
   
3. **Triggers Tab:**
   - Click **"New..."**
   - Begin the task: **"At log on"**
   - Delay task for: **30 seconds**
   - Click **"OK"**

4. **Actions Tab:**
   - Click **"New..."**
   - Action: **"Start a program"**
   - Program/script: `wsl.exe`
   - Add arguments: `-d Ubuntu -u david -- bash /home/david/levante/starlink-performance/scripts/start-all.sh`
   - Click **"OK"**

5. **Conditions Tab:**
   - Uncheck: **"Start the task only if the computer is on AC power"**
   - Uncheck: **"Stop if the computer switches to battery power"**

6. **Settings Tab:**
   - Check: **"Allow task to be run on demand"**
   - Check: **"Run task as soon as possible after a scheduled start is missed"**
   - If the task fails, restart every: **1 minute** (up to 3 times)

7. Click **"OK"** to create the task

### Step 3: Test

Right-click the task → **"Run"** to test it immediately.

---

## 🔍 Method 3: PowerShell Script (Advanced)

Run this in **PowerShell as Administrator**:

```powershell
# Register the scheduled task
$action = New-ScheduledTaskAction -Execute "wsl.exe" -Argument "-d Ubuntu -u david -- bash /home/david/levante/starlink-performance/scripts/start-all.sh"

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$trigger.Delay = "PT30S"  # 30 second delay

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

Register-ScheduledTask -TaskName "StarlinkMonitoring" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Automatically starts Starlink Performance monitoring services in WSL"

Write-Host "Task 'StarlinkMonitoring' has been registered successfully!"
Write-Host "The services will start automatically 30 seconds after you log in."
```

---

## 🧪 Testing

### Test the Task Now (Don't Wait for Reboot)

**In Task Scheduler:**
1. Find "StarlinkMonitoring"
2. Right-click → **"Run"**

**Or in PowerShell:**
```powershell
Start-ScheduledTask -TaskName "StarlinkMonitoring"
```

### Verify Services Started

In WSL, run:
```bash
cd /home/david/levante/starlink-performance
bash scripts/check-status.sh
```

You should see all services running.

---

## 📊 Viewing Startup Logs

After the task runs, check the log:

**In PowerShell:**
```powershell
Get-Content $env:USERPROFILE\starlink-startup.log -Tail 10
```

**Or in Windows Explorer:**
Navigate to `%USERPROFILE%\starlink-startup.log`

---

## 🔧 Troubleshooting

### Task doesn't run at logon

1. Check if WSL is configured to start properly
2. Increase the delay (edit task, change delay to 60 seconds)
3. Check Task Scheduler History:
   - Task Scheduler → View → **Enable "Show All Running Tasks"**
   - Right-click task → **"Properties"** → **"History"** tab

### Services don't start

1. Run the task manually in Task Scheduler to see immediate results
2. Check the Windows Event Viewer:
   - `eventvwr.msc` → Windows Logs → Application
   - Look for errors from "Task Scheduler"
3. Test the command manually in PowerShell:
   ```powershell
   wsl.exe -d Ubuntu -u david -- bash /home/david/levante/starlink-performance/scripts/start-all.sh
   ```

### WSL distribution name is wrong

If your WSL distribution isn't called "Ubuntu", find the correct name:

```powershell
wsl.exe --list
```

Then update the task's arguments to use the correct distribution name.

---

## 🗑️ Removing Auto-Start

If you want to disable auto-start:

**In Task Scheduler:**
1. Find "StarlinkMonitoring"
2. Right-click → **"Disable"** (keeps task, but disables it)
3. Or right-click → **"Delete"** (removes task completely)

**Or in PowerShell:**
```powershell
Unregister-ScheduledTask -TaskName "StarlinkMonitoring" -Confirm:$false
```

---

## 📝 What Happens on Boot

1. **Windows starts**
2. **You log in**
3. **Wait 30 seconds** (gives WSL time to initialize)
4. **Task Scheduler runs**: `wsl.exe -d Ubuntu -u david -- bash /home/david/levante/starlink-performance/scripts/start-all.sh`
5. **Start-all.sh runs**, starting in order:
   - Prometheus
   - Starlink Exporter
   - WiFi Exporter
   - Speedtest Exporter
   - Watchdog
6. **All services running!** 🎉

---

## ⚙️ Customization

### Change the delay

If 30 seconds isn't enough time for WSL to start:

1. Open Task Scheduler
2. Find "StarlinkMonitoring"
3. Right-click → **"Properties"**
4. **Triggers** tab → Double-click the trigger
5. Change **"Delay task for"** to 60 seconds (or more)
6. Click **"OK"**

### Run hidden/in background

To prevent a window from flashing:

1. Edit the task
2. **General** tab → Check **"Run whether user is logged on or not"**
3. You'll need to enter your Windows password

---

## ✅ Verification Checklist

After setup, verify everything works:

- [ ] Task appears in Task Scheduler
- [ ] Task runs successfully when triggered manually
- [ ] All 5 services start (check with `bash scripts/check-status.sh`)
- [ ] Prometheus is collecting metrics (`curl http://localhost:9090/api/v1/targets`)
- [ ] Dashboard shows data (https://starlink-performance-digitalpros-projects.vercel.app)
- [ ] Reboot and verify services auto-start

---

## 🆘 Getting Help

If you're still having issues:

1. Check the logs:
   ```bash
   tail -30 /home/david/levante/starlink-performance/logs/*.out
   ```

2. Run manually to see errors:
   ```bash
   bash /home/david/levante/starlink-performance/scripts/start-all.sh
   ```

3. Check Task Scheduler history for error messages

4. Verify WSL works:
   ```powershell
   wsl.exe -d Ubuntu -u david -- echo "WSL is working"
   ```
