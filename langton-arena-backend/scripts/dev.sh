#!/usr/bin/env bash
# scripts/dev.sh — поднимает все сервисы в watch-режиме параллельно.
set -e

# Проверяем что docker-compose поднял зависимости
if ! docker compose -f infra/docker/docker-compose.dev.yml ps | grep -q "postgres"; then
  echo "Stack not running. Starting infra..."
  docker compose -f infra/docker/docker-compose.dev.yml up -d
  sleep 5
fi

# Применяем миграции
./scripts/migrate.sh

# Запускаем все сервисы параллельно через pnpm
pnpm -r --parallel run dev
