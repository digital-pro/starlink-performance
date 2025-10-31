#!/bin/bash

# Deployment script for Starlink Performance Dashboard
# Usage: ./deploy.sh [--prod]

set -e

echo "Building Vue dashboard..."
npm run build

if [ "$1" == "--prod" ]; then
  echo "Deploying to production..."
  vercel --prod
else
  echo "Deploying to preview..."
  vercel
fi

echo "✅ Deployment complete!"

