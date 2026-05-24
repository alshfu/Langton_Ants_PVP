#!/usr/bin/env bash
# scripts/deploy.sh — деплой в k8s. Требует kubectl и валидный context.
set -e

VERSION="${1:-latest}"
NAMESPACE="${NAMESPACE:-arena-prod}"

echo "Deploying version $VERSION to $NAMESPACE"

# 1. Apply миграции через job
kubectl -n "$NAMESPACE" create job "migrate-$(date +%s)" \
  --image="ghcr.io/langton/api-gateway:$VERSION" \
  -- node services/api-gateway/dist/migrate.js

# 2. Rolling update deployments
for svc in api-gateway ws-gateway game-worker matchmaker; do
  kubectl -n "$NAMESPACE" set image "deployment/$svc" "$svc=ghcr.io/langton/$svc:$VERSION"
  kubectl -n "$NAMESPACE" rollout status "deployment/$svc" --timeout=5m
done

echo "✓ Deploy complete"
