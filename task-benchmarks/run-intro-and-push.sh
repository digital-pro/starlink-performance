#!/bin/bash
# Run intro benchmark and automatically push results to dashboard

set -e

cd "$(dirname "$0")"

echo "🚀 Running intro benchmark..."
npm run timings:one intro

echo ""
echo "📤 Pushing results to dashboard..."
npm run push

echo ""
echo "✅ Done! View results at: https://starlink-performance.vercel.app"

