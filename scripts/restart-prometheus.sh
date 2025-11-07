#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
LOG_DIR="$ROOT_DIR/logs"
PROM_DIR="$LOG_DIR/prometheus"
PROM_BIN="$PROM_DIR/prometheus"
PID_FILE="$LOG_DIR/prometheus.pid"
OUT_FILE="$LOG_DIR/prometheus.out"
CONFIG_FILE="${PROM_CONFIG:-$ROOT_DIR/deployment/prom-wsl.yml}"

mkdir -p "$LOG_DIR"

# Check if prometheus binary exists
if [[ ! -f "$PROM_BIN" ]]; then
  echo "Prometheus binary not found at $PROM_BIN" >&2
  echo "Please download and extract Prometheus to $PROM_DIR" >&2
  exit 1
fi

# Check if config exists
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Prometheus config not found at $CONFIG_FILE" >&2
  exit 1
fi

# Stop existing prometheus
if [[ -f "$PID_FILE" ]]; then
  if kill "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "Stopped existing prometheus (pid $(cat "$PID_FILE"))"
    rm -f "$PID_FILE"
  fi
fi

# Start prometheus
nohup "$PROM_BIN" \
  --config.file="$CONFIG_FILE" \
  --web.listen-address=:9090 \
  > "$OUT_FILE" \
  2>&1 &

echo $! > "$PID_FILE"
echo "prometheus started (pid $(cat "$PID_FILE"))"
