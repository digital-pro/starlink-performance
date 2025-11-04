#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
LOG_DIR="$ROOT_DIR/logs"
EXPORTER_DIR="${STARLINK_EXPORTER_DIR:-$ROOT_DIR/../starlink_exporter}"
BIN="$LOG_DIR/starlink_exporter"
PID_FILE="$LOG_DIR/starlink_exporter.pid"
OUT_FILE="$LOG_DIR/starlink_exporter.out"
ADDR="${STARLINK_DISH_ADDR:-192.168.100.1:9200}"

if [[ ! -d "$EXPORTER_DIR" ]]; then
  echo "Exporter source directory not found: $EXPORTER_DIR" >&2
  echo "Set STARLINK_EXPORTER_DIR to the starlink_exporter repo path." >&2
  exit 1
fi

mkdir -p "$LOG_DIR"

if [[ -f "$PID_FILE" ]]; then
  if kill "$(cat "$PID_FILE")" 2>/dev/null; then
    rm -f "$PID_FILE"
  fi
fi

pushd "$EXPORTER_DIR" >/dev/null
go build -o "$BIN" ./cmd/starlink_exporter
popd >/dev/null

nohup "$BIN" -address "$ADDR" -port 9817 > "$OUT_FILE" 2>&1 &
echo $! > "$PID_FILE"
echo "started (pid $(cat "$PID_FILE"))"


