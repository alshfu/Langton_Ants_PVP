# Langton Arena · Backend Monorepo

PvP-игра на муравье Лэнгтона. Бэкенд-часть проекта.

> **Это заготовка.** Все файлы — заглушки с описаниями того, что в них должно быть.
> Команда заполняет их по мере реализации, сверяясь с `docs/backend-architecture.md`
> и `docs/interface-contract.md`.

## Структура репозитория

```
langton-arena-backend/
├── core/                  Общий игровой код (импортируется и фронтом, и бэком)
├── services/              Микро-монолит — несколько долгоживущих Node.js процессов
│   ├── api-gateway/       REST API (Fastify): auth, profile, leaderboard, store
│   ├── ws-gateway/        WebSocket: matchmaking, lobby, match realtime
│   ├── game-worker/       Симуляция матчей (10 TPS, ~50 матчей на воркер)
│   ├── matchmaker/        Очереди и подбор противников
│   └── analytics-consumer/ Стрим Redpanda → ClickHouse
├── infra/                 Миграции БД, конфиги, k8s манифесты, мониторинг
├── tests/                 Unit, integration, load tests
├── scripts/               Dev-хелперы (build, deploy, migrate, seed)
└── docs/                  Спецификации и API-документация
```

## Принципы

1. **Server-authoritative.** Сервер — единственный источник истины. Клиент только рендерит.
2. **Детерминированная симуляция.** Один seed + те же inputs = тот же результат. Replays через повтор.
3. **Один игровой код на фронте и бэке.** Папка `core/` импортируется обеими сторонами.
4. **Stateless API + stateful matches.** REST горизонтально масштабируется. Game workers через sticky sessions.
5. **Event sourcing для матчей.** Каждое действие — событие. Текущее состояние = свёртка лога.

Подробности — `docs/backend-architecture.md`.

## Что НЕ делаем в v1

См. §1.3 архитектурного документа. Кратко: нет турниров, нет voice chat, нет
сложной экономики, нет кросс-региональных матчей, нет spectator на чужие матчи.

## Быстрый старт

```bash
# 1. Установить зависимости
pnpm install                    # используем pnpm для workspace

# 2. Поднять локальную инфраструктуру
docker-compose -f infra/docker/docker-compose.dev.yml up -d

# 3. Применить миграции
./scripts/migrate.sh

# 4. (опционально) Заполнить тестовыми данными
./scripts/seed.sh

# 5. Запустить все сервисы в dev-режиме
./scripts/dev.sh
```

После этого:
- API: `http://localhost:3000`
- WebSocket: `ws://localhost:3001`
- Postgres: `localhost:5432` (user/pass из `.env`)
- Redis: `localhost:6379`
- ClickHouse: `http://localhost:8123`
- Grafana: `http://localhost:3030` (admin/admin)

## Стек

- **Runtime:** Node.js 20 LTS
- **Язык:** TypeScript 5
- **Web framework:** Fastify
- **Realtime:** ws (нативный WebSocket)
- **DB primary:** PostgreSQL 16
- **DB cache:** Redis 7
- **DB аналитика:** ClickHouse
- **Стриминг:** Redpanda (Kafka-совместимый)
- **Object storage:** S3-совместимый (R2/MinIO)
- **Контейнеризация:** Docker → Kubernetes
- **CI/CD:** GitHub Actions

Полное обоснование выборов — §2 архитектурного документа.

## Дорожная карта

См. `docs/backend-architecture.md` §17. Phase 0 (подготовка) → Phase 1 (MVP) → Phase 2 (бета) → Phase 3 (релиз).

## Лицензия

MIT. Cм. `LICENSE`.

## Контакты

- Issues: GitHub Issues
- Discord: TBD
- Email: TBD
