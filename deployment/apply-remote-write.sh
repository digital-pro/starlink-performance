#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   SITE=local ./deployment/apply-remote-write.sh --config /etc/prometheus/prometheus.yml --instance 2743807 [--restart]
# Requirements:
#   - Write token saved in ../secrets/grafana_write_token.txt (glc_...)
#   - Run with sudo if modifying /etc/prometheus/prometheus.yml

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
SECRETS="$ROOT_DIR/secrets"
TOKEN_FILE="$SECRETS/grafana_write_token.txt"

CONFIG="/etc/prometheus/prometheus.yml"
INSTANCE=""
RESTART=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config) CONFIG="$2"; shift 2;;
    --instance) INSTANCE="$2"; shift 2;;
    --restart) RESTART=true; shift;;
    *) echo "Unknown arg: $1" >&2; exit 1;;
  esac
done

if [[ -z "${SITE:-}" ]]; then
  echo "SITE env var required (e.g., local, starlink)" >&2; exit 1
fi
if [[ -z "$INSTANCE" ]]; then
  echo "--instance <STACK_INSTANCE_ID> required (e.g., 2743807)" >&2; exit 1
fi
if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "Write token not found: $TOKEN_FILE" >&2; exit 1
fi
TOKEN=$(<"$TOKEN_FILE"); TOKEN=${TOKEN//$'\r'/}; TOKEN=${TOKEN//$'\n'/}

if [[ ! -f "$CONFIG" ]]; then
  echo "Prometheus config not found: $CONFIG" >&2; exit 1
fi

BACKUP="$CONFIG.$(date +%Y%m%d%H%M%S).bak"
cp "$CONFIG" "$BACKUP"
echo "Backup: $BACKUP"

MARK_START="# >>> levante-remote-write (managed)"
MARK_END="# <<< levante-remote-write (managed)"

BLOCK=$(cat <<YAML
$MARK_START
# External labels help distinguish sources in Grafana Cloud
external_labels:
  site: ${SITE}
  prometheus: \${HOSTNAME}

# Push samples to Grafana Cloud Prometheus
remote_write:
  - url: https://prometheus-prod-36-prod-us-west-0.grafana.net/api/prom/api/v1/write
    basic_auth:
      username: ${INSTANCE}
      password: ${TOKEN}
$MARK_END
YAML
)

# Replace existing managed block or append
if grep -q "$MARK_START" "$CONFIG"; then
  awk -v start="$MARK_START" -v end="$MARK_END" -v repl="$BLOCK" '
    BEGIN{printed=0}
    {
      if ($0==start) {inblk=1; if (!printed){print repl; printed=1}}
      else if ($0==end) {inblk=0}
      else if (!inblk) {print}
    }
  ' "$CONFIG" > "$CONFIG.tmp"
  mv "$CONFIG.tmp" "$CONFIG"
else
  printf "\n%s\n" "$BLOCK" >> "$CONFIG"
fi

echo "Updated: $CONFIG"

if $RESTART; then
  if command -v systemctl >/dev/null 2>&1; then
    echo "Restarting prometheus via systemctl..."
    systemctl restart prometheus || true
    systemctl status prometheus --no-pager || true
  else
    echo "--restart requested but systemctl not found; restart Prometheus manually." >&2
  fi
fi
