#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
LOG_DIR="$ROOT_DIR/logs"
PID_FILE="$LOG_DIR/speedtest-exporter.pid"
OUT_FILE="$LOG_DIR/speedtest-exporter.out"

mkdir -p "$LOG_DIR"

if [[ -f "$PID_FILE" ]]; then
  if kill "$(cat "$PID_FILE")" 2>/dev/null; then
    rm -f "$PID_FILE"
  fi
fi

export SPEEDTEST_SERVER="${SPEEDTEST_SERVER:-cardinalphoto.com}"
export SPEEDTEST_PORT="${SPEEDTEST_PORT:-5201}"
export SPEEDTEST_INTERVAL_SECONDS="${SPEEDTEST_INTERVAL_SECONDS:-900}"
export SPEEDTEST_EXPORTER_PORT="${SPEEDTEST_EXPORTER_PORT:-9820}"

nohup SPEEDTEST_PORT="$SPEEDTEST_PORT" node "$ROOT_DIR/scripts/iperf-exporter.mjs" \
  > "$OUT_FILE" \
  2>&1 &

echo $! > "$PID_FILE"
echo "speedtest exporter started (pid $(cat "$PID_FILE"))"

