#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
LOG_DIR="$ROOT_DIR/logs"
PID_FILE="$LOG_DIR/watchdog.pid"
OUT_FILE="$LOG_DIR/watchdog.out"

mkdir -p "$LOG_DIR"

if [[ -f "$PID_FILE" ]]; then
  if kill "$(cat "$PID_FILE")" 2>/dev/null; then
    rm -f "$PID_FILE"
  fi
fi

nohup node "$ROOT_DIR/scripts/watchdog.mjs" \
  > "$OUT_FILE" \
  2>&1 &

echo $! > "$PID_FILE"
echo "watchdog started (pid $(cat "$PID_FILE"))"
