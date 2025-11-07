#!/usr/bin/env bash
#
# Check status of all Starlink Performance services
#

set -uo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
LOG_DIR="$ROOT_DIR/logs"

echo "=================================="
echo "Starlink Performance Service Status"
echo "=================================="
echo ""

# Function to check if a service is running on a port
check_port() {
  local port=$1
  local name=$2
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
    local pid=$(lsof -Pi :$port -sTCP:LISTEN -t)
    echo "✓ $name - RUNNING on port $port (PID: $pid)"
    return 0
  else
    echo "✗ $name - NOT RUNNING (expected port $port)"
    return 1
  fi
}

# Function to check PID file
check_pid() {
  local pid_file=$1
  local name=$2
  if [[ -f "$pid_file" ]]; then
    local pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      echo "  PID file: $pid_file (active: $pid)"
      return 0
    else
      echo "  PID file: $pid_file (stale: $pid)"
      return 1
    fi
  else
    echo "  PID file: not found"
    return 1
  fi
}

echo "Core Services:"
echo "--------------"
check_port 9090 "Prometheus"
check_pid "$LOG_DIR/prometheus.pid" "Prometheus"
echo ""

check_port 9817 "Starlink Exporter"
check_pid "$LOG_DIR/starlink_exporter.pid" "Starlink Exporter"
echo ""

check_port 9818 "WiFi Exporter"
check_pid "$LOG_DIR/wifi-exporter.pid" "WiFi Exporter"
echo ""

check_port 9820 "Speedtest Exporter"
check_pid "$LOG_DIR/speedtest-exporter.pid" "Speedtest Exporter"
echo ""

echo "Monitoring:"
echo "-----------"
if [[ -f "$LOG_DIR/watchdog.pid" ]]; then
  wpid=$(cat "$LOG_DIR/watchdog.pid")
  if kill -0 "$wpid" 2>/dev/null; then
    echo "✓ Watchdog - RUNNING (PID: $wpid)"
  else
    echo "✗ Watchdog - NOT RUNNING (stale PID: $wpid)"
  fi
else
  echo "✗ Watchdog - NOT RUNNING (no PID file)"
fi
echo ""

echo "Optional Services:"
echo "------------------"
check_port 19999 "Netdata" || echo "  (Netdata is optional for anomaly detection)"
echo ""

echo "Recent Logs:"
echo "------------"
for log in prometheus.out starlink_exporter.out wifi-exporter.out speedtest-exporter.out watchdog.out; do
  if [[ -f "$LOG_DIR/$log" ]]; then
    last_line=$(tail -1 "$LOG_DIR/$log" 2>/dev/null || echo "empty")
    echo "$log: $last_line"
  fi
done
echo ""

echo "=================================="
echo "Quick Commands:"
echo "=================================="
echo "Start all:    bash $ROOT_DIR/scripts/start-all.sh"
echo "Stop all:     bash $ROOT_DIR/scripts/stop-all.sh"
echo "View logs:    tail -f $LOG_DIR/*.out"
echo ""
