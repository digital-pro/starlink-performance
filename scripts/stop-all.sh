#!/usr/bin/env bash
#
# Stop all Starlink Performance services
#

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
LOG_DIR="$ROOT_DIR/logs"

echo "=================================="
echo "Stopping Starlink Performance Stack"
echo "=================================="
echo ""

# Function to stop a service by PID file
stop_service() {
  local pid_file=$1
  local name=$2
  
  if [[ -f "$pid_file" ]]; then
    local pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping $name (PID: $pid)..."
      kill "$pid" 2>/dev/null || true
      sleep 1
      # Force kill if still running
      if kill -0 "$pid" 2>/dev/null; then
        echo "  Force stopping $name..."
        kill -9 "$pid" 2>/dev/null || true
      fi
      rm -f "$pid_file"
      echo "  ✓ $name stopped"
    else
      echo "  $name not running (removing stale PID file)"
      rm -f "$pid_file"
    fi
  else
    echo "  $name - no PID file found"
  fi
}

echo "Stopping services..."
echo ""

stop_service "$LOG_DIR/watchdog.pid" "Watchdog"
stop_service "$LOG_DIR/speedtest-exporter.pid" "Speedtest Exporter"
stop_service "$LOG_DIR/wifi-exporter.pid" "WiFi Exporter"
stop_service "$LOG_DIR/starlink_exporter.pid" "Starlink Exporter"
stop_service "$LOG_DIR/prometheus.pid" "Prometheus"

echo ""
echo "=================================="
echo "All services stopped"
echo "=================================="
echo ""
echo "To restart: bash $ROOT_DIR/scripts/start-all.sh"
echo ""
