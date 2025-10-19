#!/usr/bin/env bash
set -euo pipefail

# Usage (WSL/Linux, no Docker):
#   ./deployment/run-wsl-prom.sh --instance 2743807 \
#     --starlink 127.0.0.1:9817 --netdata 127.0.0.1:19999 [--bg]
# Reads a write token from ../secrets/grafana_write_token.txt (glc_...)
# Falls back to parsing glc_ from ../secrets/grafana_token.txt

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
SECRETS="$ROOT_DIR/secrets"
WRITE_FILE="$SECRETS/grafana_write_token.txt"
ALT_FILE="$SECRETS/grafana_token.txt"
CACHE_DIR="$ROOT_DIR/deployment/.cache"
PROM_DIR="$CACHE_DIR/prometheus"
CONF="$ROOT_DIR/deployment/prom-wsl.yml"
BG=false
STARLINK="127.0.0.1:9817"
NETDATA="127.0.0.1:19999"
INSTANCE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --instance) INSTANCE="$2"; shift 2;;
    --starlink) STARLINK="$2"; shift 2;;
    --netdata) NETDATA="$2"; shift 2;;
    --bg) BG=true; shift;;
    *) echo "Unknown arg: $1" >&2; exit 1;;
  esac
done

if [[ -z "$INSTANCE" ]]; then
  echo "--instance <STACK_INSTANCE_ID> required (e.g., 2743807)" >&2; exit 1
fi

mkdir -p "$CACHE_DIR"
TOKEN=""
if [[ -f "$WRITE_FILE" ]]; then
  TOKEN=$(<"$WRITE_FILE")
else
  if [[ -f "$ALT_FILE" ]]; then
    TOKEN=$(grep -o 'glc_[A-Za-z0-9=_-]*' "$ALT_FILE" | head -n1 || true)
  fi
fi
TOKEN=${TOKEN//$'\r'/}; TOKEN=${TOKEN//$'\n'/}
if [[ -z "$TOKEN" ]]; then
  echo "No Grafana write token found. Save it to $WRITE_FILE" >&2; exit 1
fi

# Download Prometheus if missing
if [[ ! -x "$PROM_DIR/prometheus" ]]; then
  mkdir -p "$PROM_DIR"
  ARCH=$(uname -m)
  VER="2.54.1"
  case "$ARCH" in
    x86_64|amd64)
      TARBALL="prometheus-${VER}.linux-amd64.tar.gz"
      ;;
    aarch64|arm64)
      TARBALL="prometheus-${VER}.linux-arm64.tar.gz"
      ;;
    *)
      echo "Unsupported arch: $ARCH" >&2; exit 1
      ;;
  esac
  URL="https://github.com/prometheus/prometheus/releases/download/v${VER}/${TARBALL}"
  TMP="$CACHE_DIR/$TARBALL"
  echo "Downloading Prometheus $VER..."
  curl -fsSL "$URL" -o "$TMP"
  tar -xzf "$TMP" -C "$CACHE_DIR"
  EXTRACT_DIR=$(find "$CACHE_DIR" -maxdepth 1 -type d -name "prometheus-${VER}.linux-*" | head -n1)
  cp "$EXTRACT_DIR/prometheus" "$PROM_DIR/"
  cp "$EXTRACT_DIR/promtool" "$PROM_DIR/" || true
fi

# Generate config
cat > "$CONF" <<YAML
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: starlink
    static_configs: [{ targets: ['${STARLINK}'] }]

remote_write:
  - url: https://prometheus-prod-36-prod-us-west-0.grafana.net/api/prom/push
    basic_auth:
      username: ${INSTANCE}
      password: ${TOKEN}
YAML

echo "Config written: $CONF"

# Run Prometheus
CMD=("$PROM_DIR/prometheus" --config.file="$CONF" --web.listen-address=":9090")
if $BG; then
  nohup "${CMD[@]}" > "$CACHE_DIR/prometheus.out" 2>&1 &
  echo "Prometheus started in background (pid $!). Logs: $CACHE_DIR/prometheus.out"
else
  echo "Starting Prometheus (Ctrl+C to stop)..."
  exec "${CMD[@]}"
fi
