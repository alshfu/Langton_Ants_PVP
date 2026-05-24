#!/usr/bin/env bash
# scripts/seed.sh — заполнить тестовыми данными. ТОЛЬКО dev/staging.
set -e
[ "$NODE_ENV" = "production" ] && echo "REFUSING TO SEED PRODUCTION" && exit 1

PG_HOST="${PG_HOST:-localhost}"
PG_USER="${PG_USER:-langton}"
PG_DB="${PG_DATABASE:-langton_arena}"

PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -f infra/postgres/seed.sql
echo "✓ Seed data inserted"
