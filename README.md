# Langton Arena

> Многопользовательская PvP-игра на основе клеточного автомата Лэнгтона.
> 2–10 игроков захватывают территорию на общей сетке. Конкурентный рейтинг ELO, реплеи, античит.

---

## Структура репозитория

```
langton-arena/
├── ux-prototype/            ← Vanilla JSX-прототип v1 (референс, не в продакшне)
├── langton-arena-web/       ← React-клиент v2 (Vite + TypeScript) — актуальный фронт
└── langton-arena-backend/   ← Бэкенд monorepo (5 микросервисов, Node.js + TypeScript)
```

---

## С чего начать

| Задача | Куда смотреть |
|--------|---------------|
| 🎮 Запустить игру в браузере | [`langton-arena-web/README.md`](./langton-arena-web/README.md) |
| 🖥 Поднять бэкенд локально | [`langton-arena-backend/README.md`](./langton-arena-backend/README.md) |
| 🏗 Архитектура системы | [`langton-arena-backend/docs/backend-architecture.md`](./langton-arena-backend/docs/backend-architecture.md) |
| 📋 Контракт фронт ↔ бэк | [`langton-arena-backend/docs/interface-contract.md`](./langton-arena-backend/docs/interface-contract.md) |
| 🔌 REST API (OpenAPI) | [`langton-arena-backend/docs/api/openapi.yaml`](./langton-arena-backend/docs/api/openapi.yaml) |
| 🧪 Тесты | [`langton-arena-backend/tests/README.md`](./langton-arena-backend/tests/README.md) |
| 🐳 Инфраструктура | [`langton-arena-backend/infra/README.md`](./langton-arena-backend/infra/README.md) |

---

## Быстрый старт (бэкенд)

```bash
# 1. Поднять инфраструктуру (Postgres, Redis, ClickHouse, Redpanda, MinIO)
docker-compose -f langton-arena-backend/infra/docker/docker-compose.dev.yml up -d

# 2. Установить зависимости
cd langton-arena-backend && pnpm install

# 3. Применить миграции БД
pnpm migrate

# 4. Запустить все сервисы с hot-reload
pnpm dev
```

## Быстрый старт (фронт)

```bash
cd langton-arena-web
pnpm install
pnpm dev        # http://localhost:5173
```

---

## Стек

| Слой | Технологии |
|------|-----------|
| Фронт | React 18, Vite, TypeScript, Canvas API, WebSocket |
| Бэкенд | Node.js, TypeScript 5, Fastify, pnpm workspaces |
| БД | PostgreSQL 16, Redis 7, ClickHouse |
| Стриминг | Redpanda (Kafka-совместимый) |
| Хранилище | MinIO / Cloudflare R2 |
| Деплой | Docker Compose (dev), Kubernetes (prod) |
| Мониторинг | Prometheus + Grafana + Loki |

---

## Лицензия

MIT
