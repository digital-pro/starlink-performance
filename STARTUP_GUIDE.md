# Starlink Performance Monitoring - Startup Guide

This guide explains all the services that need to run for the Starlink performance monitoring system, and how to manage them after a system reboot.

## 🚀 Quick Start (After Reboot)

**Start everything with one command:**

```bash
cd /home/david/levante/starlink-performance
bash scripts/start-all.sh
```

This will start all services in the correct order and verify they're running.

---

## 📋 Required Services

### 1. **Prometheus** (Port 9090)
- **Purpose:** Collects metrics from exporters and pushes to Grafana Cloud
- **Config:** `deployment/prom-wsl.yml`
- **Start:** `bash scripts/restart-prometheus.sh`
- **Logs:** `logs/prometheus.out`
- **PID File:** `logs/prometheus.pid`

### 2. **Starlink Exporter** (Port 9817)
- **Purpose:** Collects metrics from Starlink dish (dishy)
- **Source:** Built from `starlink_exporter/` Go code
- **Connects to:** Starlink dish at `192.168.100.1:9200`
- **Start:** `bash scripts/restart-exporter.sh`
- **Logs:** `logs/starlink_exporter.out`
- **PID File:** `logs/starlink_exporter.pid`

### 3. **WiFi Exporter** (Port 9818)
- **Purpose:** Collects Windows WiFi adapter metrics (link speed, etc.)
- **Source:** `scripts/wifi-exporter.mjs`
- **Start:** `bash scripts/restart-wifi-exporter.sh`
- **Logs:** `logs/wifi-exporter.out`
- **PID File:** `logs/wifi-exporter.pid`

### 4. **Speedtest Exporter** (Port 9820)
- **Purpose:** Runs periodic iperf3 speed tests to measure actual throughput
- **Source:** `scripts/iperf-exporter.mjs`
- **Tests against:** cardinalphoto.com:5201 (or configured server)
- **Frequency:** Every 5 minutes (configurable)
- **Test duration:** 30 seconds with 4 parallel streams
- **Start:** `bash scripts/restart-speedtest.sh`
- **Logs:** `logs/speedtest-exporter.out`
- **PID File:** `logs/speedtest-exporter.pid`

### 5. **Watchdog** (No port)
- **Purpose:** Monitors other services and restarts them if they crash
- **Source:** `scripts/watchdog.mjs`
- **Start:** `bash scripts/restart-watchdog.sh`
- **Logs:** `logs/watchdog.out`
- **PID File:** `logs/watchdog.pid`

### 6. **Netdata** (Port 19999) - Optional
- **Purpose:** System metrics and anomaly detection
- **Type:** System service (auto-starts on boot)
- **Check:** `systemctl status netdata`
- **Note:** Used for advanced anomaly detection features

---

## 🔧 Management Commands

### Start All Services
```bash
cd /home/david/levante/starlink-performance
bash scripts/start-all.sh
```

### Stop All Services
```bash
bash scripts/stop-all.sh
```

### Check Status
```bash
bash scripts/check-status.sh
```

### Restart Individual Services
```bash
bash scripts/restart-prometheus.sh
bash scripts/restart-exporter.sh
bash scripts/restart-wifi-exporter.sh
bash scripts/restart-speedtest.sh
bash scripts/restart-watchdog.sh
```

### View Logs
```bash
# All logs at once
tail -f logs/*.out

# Individual service logs
tail -f logs/prometheus.out
tail -f logs/starlink_exporter.out
tail -f logs/wifi-exporter.out
tail -f logs/speedtest-exporter.out
tail -f logs/watchdog.out
```

---

## 📊 Data Flow

```
Starlink Dish (192.168.100.1:9200)
    ↓
Starlink Exporter (port 9817)
    ↓
Prometheus (port 9090) ←──── scrapes every 10s
    ↓
Grafana Cloud (remote_write) ←──── pushes metrics
    ↓
Vercel Dashboard (via API) ←──── queries metrics
```

**Speedtest Flow:**
```
iperf3 client (speedtest exporter)
    ↓
cardinalphoto.com:5201 (iperf3 server)
    ↓
Speedtest Exporter exposes metrics (port 9820)
    ↓
Prometheus scrapes → Grafana Cloud → Dashboard
```

---

## 🔍 Troubleshooting

### Check if all services are running
```bash
bash scripts/check-status.sh
```

### If a service won't start

1. Check the logs:
   ```bash
   tail -30 logs/<service>.out
   ```

2. Check if the port is already in use:
   ```bash
   lsof -i :9090  # Prometheus
   lsof -i :9817  # Starlink Exporter
   lsof -i :9818  # WiFi Exporter
   lsof -i :9820  # Speedtest Exporter
   ```

3. Kill the process and restart:
   ```bash
   kill <PID>
   bash scripts/restart-<service>.sh
   ```

### If Prometheus isn't collecting data

1. Check Prometheus targets:
   ```bash
   curl http://localhost:9090/api/v1/targets | jq
   ```

2. Check if exporters are responding:
   ```bash
   curl http://localhost:9817/metrics  # Starlink
   curl http://localhost:9818/metrics  # WiFi
   curl http://localhost:9820/metrics  # Speedtest
   ```

### If speedtest shows low numbers

- **Check test settings:** The exporter uses 30s duration and 4 parallel streams by default
- **Verify iperf3 server:** Make sure cardinalphoto.com:5201 is accessible
- **Test manually:**
  ```bash
  iperf3 -c cardinalphoto.com -p 5201 -t 30 -P 4 -R
  ```

### If dashboard shows no data

1. **Check Vercel environment variables:**
   - `PROM_URL` - Grafana Cloud Prometheus endpoint
   - `PROM_USER` - Grafana Cloud user ID
   - `PROM_TOKEN` - Grafana Cloud API token

2. **Test Prometheus query:**
   ```bash
   curl -u "2743807:<token>" \
     "https://prometheus-prod-36-prod-us-west-0.grafana.net/api/prom/api/v1/query?query=starlink_speedtest_download_mbps"
   ```

---

## ⚙️ Configuration

### Speedtest Settings

Edit `scripts/restart-speedtest.sh` to change:

```bash
export SPEEDTEST_SERVER="cardinalphoto.com"      # Test server
export SPEEDTEST_PORT="5201"                      # Server port
export SPEEDTEST_INTERVAL_SECONDS="300"          # Test every 5 minutes
export SPEEDTEST_DURATION_SECONDS="30"           # Test for 30 seconds
export SPEEDTEST_ADDITIONAL_ARGS="-P 4"          # 4 parallel streams
```

### Prometheus Settings

Edit `deployment/prom-wsl.yml` to:
- Change scrape intervals
- Add/remove exporters
- Modify Grafana Cloud credentials

---

## 🔄 Auto-Start on Boot (Optional)

To automatically start services on system boot, you can:

### Option 1: WSL Task (Windows)

Create a Windows Task Scheduler task that runs on login:

```powershell
wsl.exe -d Ubuntu -u david -- bash /home/david/levante/starlink-performance/scripts/start-all.sh
```

### Option 2: Crontab (Linux)

Add to crontab:
```bash
@reboot cd /home/david/levante/starlink-performance && bash scripts/start-all.sh >> logs/startup.log 2>&1
```

### Option 3: Systemd Service (Linux)

Create `/etc/systemd/system/starlink-monitoring.service`:

```ini
[Unit]
Description=Starlink Performance Monitoring
After=network.target

[Service]
Type=forking
User=david
WorkingDirectory=/home/david/levante/starlink-performance
ExecStart=/home/david/levante/starlink-performance/scripts/start-all.sh
ExecStop=/home/david/levante/starlink-performance/scripts/stop-all.sh
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then enable:
```bash
sudo systemctl enable starlink-monitoring
sudo systemctl start starlink-monitoring
```

---

## 📌 Quick Reference

| Service | Port | PID File | Log File | Purpose |
|---------|------|----------|----------|---------|
| Prometheus | 9090 | `logs/prometheus.pid` | `logs/prometheus.out` | Metrics collection & remote write |
| Starlink Exporter | 9817 | `logs/starlink_exporter.pid` | `logs/starlink_exporter.out` | Dish metrics |
| WiFi Exporter | 9818 | `logs/wifi-exporter.pid` | `logs/wifi-exporter.out` | WiFi adapter metrics |
| Speedtest Exporter | 9820 | `logs/speedtest-exporter.pid` | `logs/speedtest-exporter.out` | iperf3 speed tests |
| Watchdog | - | `logs/watchdog.pid` | `logs/watchdog.out` | Service monitoring |
| Netdata | 19999 | System service | System logs | System metrics (optional) |

---

## 🌐 URLs

- **Dashboard:** https://starlink-performance-digitalpros-projects.vercel.app
- **Prometheus:** http://localhost:9090
- **Grafana Dashboard:** https://levanteperformance.grafana.net/d/ab8a8fa9-8d9c-47df-928b-9db5a89a5bca/starlink-performance-10-25
- **Netdata (if installed):** http://localhost:19999

---

## 📝 Notes

- All services run in the background using `nohup`
- PID files track running processes for easy management
- Logs rotate automatically (if logrotate is configured)
- Watchdog restarts crashed services automatically
- Prometheus pushes data to Grafana Cloud every 10 seconds
- Speedtest runs every 5 minutes to avoid excessive bandwidth usage
