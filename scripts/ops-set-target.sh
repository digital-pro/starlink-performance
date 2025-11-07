#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
SECRETS="$ROOT_DIR/secrets"
TARGET_FILE="$SECRETS/starlink_target.txt"
TARGET="${1:-}"
if [[ -z "${TARGET}" ]]; then
  echo "Usage: npm run ops:set-target -- <HOST:PORT>" >&2
  exit 1
fi
mkdir -p "$SECRETS"
echo -n "$TARGET" > "$TARGET_FILE"
echo "Saved STARLINK_TARGET=$TARGET to $TARGET_FILE"
