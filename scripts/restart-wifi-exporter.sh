#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
LOG_DIR="$ROOT_DIR/logs"
PID_FILE="$LOG_DIR/wifi-exporter.pid"
OUT_FILE="$LOG_DIR/wifi-exporter.out"

mkdir -p "$LOG_DIR"

if [[ -f "$PID_FILE" ]]; then
  if kill "$(cat "$PID_FILE")" 2>/dev/null; then
    rm -f "$PID_FILE"
  fi
fi

export WIFI_EXPORTER_PORT="${WIFI_EXPORTER_PORT:-9818}"

nohup node "$ROOT_DIR/scripts/wifi-exporter.mjs" \
  > "$OUT_FILE" \
  2>&1 &

echo $! > "$PID_FILE"
echo "wifi-exporter started (pid $(cat "$PID_FILE"))"
