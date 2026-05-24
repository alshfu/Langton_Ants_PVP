#!/usr/bin/env bash
# scripts/migrate.sh — применить SQL миграции из infra/postgres/migrations.
# Очень простой runner: применяет файлы в алфавитном порядке, идемпотентно
# (отслеживая через таблицу __migrations).
set -e

PG_HOST="${PG_HOST:-localhost}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-langton}"
PG_DB="${PG_DATABASE:-langton_arena}"

# Создать таблицу __migrations если её нет
PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -c \
  "CREATE TABLE IF NOT EXISTS __migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())"

for f in infra/postgres/migrations/*.sql; do
  name=$(basename "$f")
  applied=$(PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -tA -c \
    "SELECT 1 FROM __migrations WHERE name='$name'")
  if [ "$applied" = "1" ]; then
    echo "  skip $name (already applied)"
    continue
  fi
  echo "→ applying $name"
  PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" \
    -v ON_ERROR_STOP=1 -f "$f"
  PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -c \
    "INSERT INTO __migrations (name) VALUES ('$name')"
done

echo "✓ Migrations done"
