#!/bin/bash
set -euo pipefail

# Start Vercel dev server for local API endpoints
# Usage: ./scripts/start-api-dev.sh

cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "Creating .env.local with PROM_URL..."
  echo "PROM_URL=http://localhost:9090/api/v1" > .env.local
fi

echo "Starting Vercel dev server on port 3000..."
echo "API endpoints will be available at:"
echo "  - http://localhost:3000/api/ai-correlate"
echo "  - http://localhost:3000/api/promql"
echo ""
echo "Press Ctrl+C to stop"
echo ""

vercel dev --listen 3000
