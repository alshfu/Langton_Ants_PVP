# infra/

Инфраструктурные артефакты: миграции БД, конфиги сервисов, k8s манифесты, мониторинг.

## Структура

```
infra/
├── postgres/
│   ├── migrations/    Forward-only SQL миграции, нумерованные
│   └── seed.sql       Тестовые данные для dev/staging
├── redis/
│   └── redis.conf     Redis 7 конфигурация
├── clickhouse/
│   └── schema.sql     Схема таблиц для аналитики
├── docker/
│   ├── docker-compose.dev.yml    Локальная разработка
│   └── docker-compose.prod.yml   Минимальный single-host prod
├── k8s/               Kubernetes манифесты (для serious prod)
├── monitoring/        Prometheus rules, Grafana dashboards
└── keys/              JWT private/public keys (НЕ КОММИТИТЬ; есть в .gitignore)
```

## Миграции

Применяются автоматически на старте API Gateway, если `MIGRATE_ON_BOOT=true`.
Принципы:
- **Forward-only** — нет down-миграций. Если нужно откатить, пишем новую миграцию вперёд.
- Naming: `YYYY_MM_DD_NNN_short_description.sql`
- Каждая миграция оборачивается в transaction (`BEGIN; ... COMMIT;`) автоматически runner'ом.

Применить вручную: `./scripts/migrate.sh`.

## JWT keys

Генерация для dev:
```bash
mkdir -p infra/keys
openssl genrsa -out infra/keys/jwt-private.pem 2048
openssl rsa -in infra/keys/jwt-private.pem -pubout -out infra/keys/jwt-public.pem
```

В production — ключи из k8s Secrets или Vault, никогда не в репозитории.
