#!/usr/bin/env bash
set -euo pipefail

IMAGE_TAG="${1:-}"
if [ -z "$IMAGE_TAG" ]; then
  echo "Usage: ./deploy.sh <image_tag>"
  exit 1
fi

DEPLOY_DIR="${DEPLOY_DIR:-/opt/ontorale}"
cd "$DEPLOY_DIR"

OLD_TAG=$(cat current_tag 2>/dev/null || echo "latest")
export IMAGE_TAG

echo "[Deploy] Target image: $IMAGE_TAG"
echo "[Deploy] Current image: $OLD_TAG"

# Wait up to 10 minutes (60 x 10s) until no active games are running
echo "[Deploy] Waiting for active games to complete..."
WAIT_COUNT=0
MAX_WAIT_COUNT=60
while true; do
  ACTIVE_GAMES=$(curl -sf http://127.0.0.1:3000/healthz | sed -E 's/.*"activeGames":([0-9]+).*/\1/' 2>/dev/null || echo 0)
  if [ "$ACTIVE_GAMES" -le 0 ]; then
    echo "[Deploy] Zero active games detected. Safe to deploy."
    break
  fi
  WAIT_COUNT=$((WAIT_COUNT + 1))
  if [ "$WAIT_COUNT" -ge "$MAX_WAIT_COUNT" ]; then
    echo "[Deploy] Warning: Timeout waiting for active games to reach 0. Proceeding with deploy."
    break
  fi
  echo "[Deploy] $ACTIVE_GAMES game(s) active. Sleeping 10s ($WAIT_COUNT/$MAX_WAIT_COUNT)..."
  sleep 10
done

# Pull new image and restart app container
echo "[Deploy] Pulling container image $IMAGE_TAG..."
docker compose pull app || true

echo "[Deploy] Updating app service..."
docker compose up -d app

# Verify container health
echo "[Deploy] Verifying health at http://127.0.0.1:3000/healthz..."
HEALTHY=false
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3000/healthz | grep -q '"ok":true'; then
    HEALTHY=true
    break
  fi
  echo "[Deploy] Health check attempt $i/30 waiting..."
  sleep 1
done

if [ "$HEALTHY" = true ]; then
  echo "$IMAGE_TAG" > current_tag
  echo "[Deploy] Deployment of $IMAGE_TAG succeeded!"
  docker image prune -f || true
  exit 0
else
  echo "[Deploy] Health check failed! Rolling back to $OLD_TAG..."
  export IMAGE_TAG="$OLD_TAG"
  docker compose up -d app
  echo "[Deploy] Rollback completed."
  exit 1
fi
