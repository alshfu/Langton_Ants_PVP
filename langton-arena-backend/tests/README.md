# tests/

Все тесты бэкенда.

```
tests/
├── unit/         Чистые юнит-тесты (быстрые, без I/O)
│   ├── core/         Тесты для @langton/core (langton engine, protocol, formatting)
│   ├── engine/       Дополнительные сценарии симуляции
│   └── matchmaker/   Алгоритм подбора, SR window
│
├── integration/  С реальной БД и Redis (Docker)
│   ├── api/          HTTP endpoints
│   ├── ws/           WebSocket flow
│   └── matchmaking/  End-to-end matchmaking
│
└── load/         Нагрузочные тесты
    └── k6/           Сценарии k6 для DDoS-симуляции и нагрузки
```

## Покрытие — цели

- 70% общее покрытие
- 90%+ для critical path: langton engine, ELO, JWT, matchmaking
- Каждый bug-fix → новый regression test

## Запуск

```bash
# Юнит-тесты
pnpm test

# Интеграционные (поднимут docker-compose)
pnpm -r test:integration

# Нагрузочные
k6 run tests/load/k6/scenarios/basic.js
```
