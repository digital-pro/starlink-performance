# Auto-Start Configuration

The Starlink Performance monitoring stack is now configured to **automatically start on boot** via systemd user service.

## Prerequisites

1. **Enable systemd inside WSL** (required once per distro)
   ```ini
   # /etc/wsl.conf
   [boot]
   systemd=true
   ```
   After editing, run `wsl --shutdown` from Windows and reopen the distro. Verify with `ps -p 1 -o comm=` → `systemd`.

2. **Install & enable Netdata** (feeds anomaly detection + events)
   ```bash
   sudo apt-get update
   sudo apt-get install -y netdata
   sudo systemctl enable --now netdata
   sudo ss -ltnp | grep 19999
   ```
   Netdata must be running for the “Anomaly Detection & Starlink Events” panel to populate.

## What Gets Started

1. **Starlink Exporter** (port 9817) - Collects metrics from Starlink dish
2. **Prometheus** (port 9090) - Scrapes and stores metrics, pushes to Grafana Cloud
3. **Watchdog** - Monitors and auto-restarts services if they fail

## Service Management

### Check Status
```bash
systemctl --user status starlink-performance
```

### Start Manually
```bash
systemctl --user start starlink-performance
```

### Stop
```bash
systemctl --user stop starlink-performance
```

### Restart
```bash
systemctl --user restart starlink-performance
```

### View Logs
```bash
# Service logs
journalctl --user -u starlink-performance -f

# Prometheus logs
tail -f ~/levante/starlink-performance/logs/prometheus.out

# Starlink exporter logs
tail -f ~/levante/starlink-performance/logs/starlink_exporter.out

# Watchdog logs
tail -f ~/levante/starlink-performance/logs/watchdog.out
```

### Disable Auto-Start (if needed)
```bash
systemctl --user disable starlink-performance
```

### Re-enable Auto-Start
```bash
systemctl --user enable starlink-performance
```

## Configuration

Service file location: `~/.config/systemd/user/starlink-performance.service`

Environment variables (edit service file if needed):
- `INSTANCE_ID=2743807` - Grafana Cloud instance ID
- `STARLINK_TARGET=127.0.0.1:9817` - Starlink exporter address
- `STARLINK_DISH_ADDR=192.168.100.1:9201` - Starlink dish address

After editing the service file:
```bash
systemctl --user daemon-reload
systemctl --user restart starlink-performance
```

## Testing Auto-Start

To test without rebooting:
```bash
# Stop everything
systemctl --user stop starlink-performance

# Start via systemd (simulates boot)
systemctl --user start starlink-performance

# Check status
systemctl --user status starlink-performance
ps aux | grep -E "(starlink|prometheus)" | grep -v grep
```

## What Happens on Reboot

1. System boots
2. User lingering is enabled, so systemd user services start automatically
3. `starlink-performance.service` starts
4. Starlink exporter starts
5. Prometheus starts (scrapes every 30s, pushes to Grafana Cloud)
6. Watchdog starts (monitors and auto-restarts if needed)

No manual intervention required! 🎉

### Optional: Windows exporter scheduled task

If you ever need the exporter to run on the Windows host instead of WSL (for example, while debugging WSL networking), reuse `C:\Users\<you>\levante\start_starlink_exporter.ps1` and register it from an elevated PowerShell:

```powershell
schtasks /Create /TN "StarlinkExporter" /TR 'powershell.exe -ExecutionPolicy Bypass -File "C:\Users\<you>\levante\start_starlink_exporter.ps1"' /SC ONLOGON /RL HIGHEST /F
```

Disable it again with `schtasks /Change /TN "StarlinkExporter" /Disable` when the WSL service is handling the stack.
