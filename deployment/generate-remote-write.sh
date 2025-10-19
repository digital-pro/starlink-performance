#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   INSTANCE_ID=2743807 SITE=local ./generate-remote-write.sh > remote-write.local.yml
# Reads write token from ../secrets/grafana_write_token.txt

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
SECRETS="$ROOT_DIR/secrets"
TOKEN_FILE="$SECRETS/grafana_write_token.txt"

if [[ -z "${INSTANCE_ID:-}" ]]; then
  echo "INSTANCE_ID env var required (Grafana stack instance ID)" >&2
  exit 1
fi
if [[ -z "${SITE:-}" ]]; then
  echo "SITE env var required (e.g., local, starlink)" >&2
  exit 1
fi
if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "Write token file not found: $TOKEN_FILE" >&2
  exit 1
fi
WRITE_TOKEN=$(<"$TOKEN_FILE")
WRITE_TOKEN=${WRITE_TOKEN//$'\r'/}
WRITE_TOKEN=${WRITE_TOKEN//$'\n'/}

cat <<YAML
external_labels:
  site: ${SITE}
  prometheus: \\${HOSTNAME}

remote_write:
  - url: https://prometheus-prod-36-prod-us-west-0.grafana.net/api/prom/push
    basic_auth:
      username: ${INSTANCE_ID}
      password: ${WRITE_TOKEN}
YAML
