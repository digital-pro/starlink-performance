# After Reboot Checklist

## 🚀 Quick Start (ONE COMMAND)

```bash
cd /home/david/levante/starlink-performance && bash scripts/start-all.sh
```

This single command starts all required services in the correct order.

---

## ✅ Verification

After running `start-all.sh`, verify everything is working:

```bash
bash scripts/check-status.sh
```

You should see:
- ✓ Prometheus - RUNNING on port 9090
- ✓ Starlink Exporter - RUNNING on port 9817
- ✓ WiFi Exporter - RUNNING on port 9818
- ✓ Speedtest Exporter - RUNNING on port 9820
- ✓ Watchdog - RUNNING

---

## 📋 Services Started

1. **Prometheus** → Collects and forwards metrics to Grafana Cloud
2. **Starlink Exporter** → Reads dish metrics
3. **WiFi Exporter** → Reads WiFi adapter metrics
4. **Speedtest Exporter** → Runs iperf3 tests every 5 minutes
5. **Watchdog** → Monitors and restarts services if they crash

---

## 🔧 Manual Control

### Stop All Services
```bash
bash scripts/stop-all.sh
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
tail -f logs/*.out
```

---

## 🌐 Access Points

- **Dashboard:** https://starlink-performance-digitalpros-projects.vercel.app
- **Prometheus:** http://localhost:9090
- **Grafana:** https://levanteperformance.grafana.net

---

## 🔍 If Something Goes Wrong

1. Check status: `bash scripts/check-status.sh`
2. View logs: `tail -30 logs/<service>.out`
3. Restart service: `bash scripts/restart-<service>.sh`
4. Full restart: `bash scripts/stop-all.sh && bash scripts/start-all.sh`

For detailed troubleshooting, see `STARTUP_GUIDE.md`.
