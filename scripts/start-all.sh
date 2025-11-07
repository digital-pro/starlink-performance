#!/usr/bin/env bash
#
# Master startup script for Starlink Performance Monitoring
# Starts all required services in the correct order
#

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
SCRIPTS_DIR="$ROOT_DIR/scripts"

echo "=================================="
echo "Starting Starlink Performance Stack"
echo "=================================="
echo ""

# Function to check if a service is running on a port
check_port() {
  local port=$1
  local name=$2
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✓ $name is running on port $port"
    return 0
  else
    echo "✗ $name is NOT running on port $port"
    return 1
  fi
}

# Function to wait for a service to be ready
wait_for_port() {
  local port=$1
  local name=$2
  local max_wait=${3:-30}
  local waited=0
  
  echo -n "  Waiting for $name (port $port)..."
  while ! lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; do
    if [ $waited -ge $max_wait ]; then
      echo " TIMEOUT after ${max_wait}s"
      return 1
    fi
    sleep 1
    waited=$((waited + 1))
    echo -n "."
  done
  echo " ready (${waited}s)"
  return 0
}

echo "1. Starting Prometheus (metrics collection & remote write)"
echo "-----------------------------------------------------------"
bash "$SCRIPTS_DIR/restart-prometheus.sh"
wait_for_port 9090 "Prometheus" 10
echo ""

echo "2. Starting Starlink Exporter (dish metrics)"
echo "-----------------------------------------------------------"
bash "$SCRIPTS_DIR/restart-exporter.sh"
wait_for_port 9817 "Starlink Exporter" 10
echo ""

echo "3. Starting WiFi Exporter (Windows WiFi metrics)"
echo "-----------------------------------------------------------"
bash "$SCRIPTS_DIR/restart-wifi-exporter.sh"
wait_for_port 9818 "WiFi Exporter" 10
echo ""

echo "4. Starting Speedtest Exporter (iperf3 periodic tests)"
echo "-----------------------------------------------------------"
bash "$SCRIPTS_DIR/restart-speedtest.sh"
wait_for_port 9820 "Speedtest Exporter" 10
echo ""

echo "5. Starting Watchdog (monitors and restarts failed services)"
echo "-----------------------------------------------------------"
bash "$SCRIPTS_DIR/restart-watchdog.sh"
sleep 2
echo ""

echo "=================================="
echo "Service Status Check"
echo "=================================="
echo ""

check_port 9090 "Prometheus" || true
check_port 9817 "Starlink Exporter" || true
check_port 9818 "WiFi Exporter" || true
check_port 9820 "Speedtest Exporter" || true
check_port 19999 "Netdata (if installed)" || echo "  Note: Netdata is optional"

echo ""
echo "=================================="
echo "Startup Complete!"
echo "=================================="
echo ""
echo "Dashboard: https://starlink-performance-digitalpros-projects.vercel.app"
echo "Prometheus: http://localhost:9090"
echo "Grafana: https://levanteperformance.grafana.net"
echo ""
echo "Logs directory: $ROOT_DIR/logs"
echo "  - prometheus.out"
echo "  - starlink_exporter.out"
echo "  - wifi-exporter.out"
echo "  - speedtest-exporter.out"
echo "  - watchdog.out"
echo ""
