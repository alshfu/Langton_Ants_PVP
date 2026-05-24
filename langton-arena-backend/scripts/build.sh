#!/usr/bin/env bash
# scripts/build.sh — собрать все сервисы (TypeScript → dist/).
set -e
pnpm install --frozen-lockfile
pnpm -r build
echo "✓ Build complete"
