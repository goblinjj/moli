#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="moli"

# Install dependencies and build
npm ci
npm run build

# Check if wrangler is available
if ! command -v wrangler &> /dev/null; then
  echo "Installing wrangler..."
  npm install -g wrangler
fi

# Check if project exists, create if not
if ! wrangler pages project list 2>/dev/null | grep -q "$PROJECT_NAME"; then
  echo "Creating Cloudflare Pages project: $PROJECT_NAME"
  wrangler pages project create "$PROJECT_NAME" --production-branch main
fi

# Deploy
echo "Deploying to Cloudflare Pages..."
wrangler pages deploy dist --project-name "$PROJECT_NAME"
