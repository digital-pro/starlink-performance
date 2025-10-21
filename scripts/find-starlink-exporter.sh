#!/usr/bin/env bash
set -euo pipefail

# Fast scan for Starlink exporter on common subnets
# Tries: 127.0.0.1 and these /24s: 192.168.1.x, 192.168.0.x, 10.0.0.x, 10.0.1.x
# Prints the first HOST:9817 that responds with starlink_* metrics

PORT=9817

# Derive local subnets
SUBNETS=("127.0.0")
# Parse ip route output to include connected subnets (limit to /24 slices for speed)
IPR=$(ip route || true)
if echo "$IPR" | grep -qE "^(default|)"; then
  echo "$IPR" | awk '/ proto kernel scope link src /{print $1}' | while read -r cidr; do
    base=$(echo "$cidr" | cut -d'/' -f1 | awk -F. '{print $1"."$2"."$3}');
    if [[ "$base" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      SUBNETS+=("$base")
    fi
  done
fi
# Always include a few common ones
SUBNETS+=("192.168.1" "192.168.0" "10.0.0" "10.0.1")

probe() {
  local host="$1"
  local url="http://${host}:${PORT}/metrics"
  local out
  out=$(curl -m 0.5 -fsS "$url" 2>/dev/null || true)
  if [[ -n "$out" && "$out" == *"starlink_dish"* ]]; then
    echo "${host}:${PORT}"
    return 0
  fi
  return 1
}

# First try localhost quickly
if probe 127.0.0.1; then exit 0; fi

# De-duplicate subnets
uniq_subnets=()
declare -A seen
for s in "${SUBNETS[@]}"; do
  if [[ -n "${seen[$s]:-}" ]]; then continue; fi
  seen[$s]=1
  uniq_subnets+=("$s")
done

for base in "${uniq_subnets[@]}"; do
  if [[ "$base" == "127.0.0" ]]; then continue; fi
  seq 1 254 | xargs -I{} -P 64 bash -lc 'HOST="'"$base"'.{}"; curl -m 0.4 -fsS "http://${HOST}:9817/metrics" 2>/dev/null | grep -q "starlink_dish" && echo "${HOST}:9817"' | head -n1 && exit 0 || true
done

exit 1
