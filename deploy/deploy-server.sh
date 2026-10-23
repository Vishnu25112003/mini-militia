#!/usr/bin/env bash
# Update the game server on the VPS: pull -> install -> build -> restart. Run from the repo root.
set -euo pipefail

git pull --ff-only
npm ci
npm run build -w @game/shared
npm run build -w @game/server
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save
echo "deployed: $(git rev-parse --short HEAD)"
curl -fsS http://127.0.0.1:2567/health && echo
