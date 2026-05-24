# services/api-gateway

REST API на Fastify. Обрабатывает все non-realtime операции:
- Аутентификация (register, login, refresh)
- Профиль (me, players/:id, history)
- Лидерборды
- Матчмейкинг (HTTP-часть; реалтайм-апдейты идут через ws-gateway)
- Магазин (cosmetics)
- Социальные функции (friends, blocks)
- Жалобы

## Принципы

- **Stateless** — горизонтально масштабируется
- **JSON only** — никаких бинарных протоколов здесь
- **JWT** — access (15 мин) + refresh (30 дней)
- **Rate limit** — на IP и на user
- **OpenAPI** — авто-генерация из routes через `@fastify/swagger`

## Endpoints

Полный список — `docs/api/openapi.yaml`. Краткая карта:

```
/api/v1/auth/*           — register, login, logout, refresh, guest
/api/v1/me               — текущий пользователь
/api/v1/players/:id      — публичный профиль
/api/v1/players/:id/history    — история матчей
/api/v1/players/:id/heatmaps   — тепловые карты
/api/v1/matches/:id      — детали матча
/api/v1/matches/:id/replay     — .lreplay файл
/api/v1/leaderboard/*    — top игроки
/api/v1/meta/*           — мета-статистика
/api/v1/matchmaking/queue      — вступить/выйти из очереди
/api/v1/store/items      — список товаров
/api/v1/store/purchase   — купить
/api/v1/social/*         — friends, blocks
/api/v1/reports          — пожаловаться
```

## Структура

```
src/
├── index.ts             Bootstrap (читает .env, запускает server.ts)
├── server.ts            Fastify configuration, plugins, hooks
├── routes/              По одному файлу на ресурс
├── middlewares/         JWT, rate limit, validation
├── repositories/        SQL-запросы к Postgres
└── utils/               JWT, password hashing, helpers
```

## Локальная разработка

```bash
cd services/api-gateway
pnpm install
pnpm dev                    # tsx watch ./src/index.ts
```

Откроется на `http://localhost:3000`. Swagger UI на `/docs`.
