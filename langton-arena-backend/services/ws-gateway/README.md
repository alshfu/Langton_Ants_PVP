# services/ws-gateway

WebSocket Gateway — приёмник всего реалтайм-трафика от клиентов.

## Зоны ответственности

- Принимает WS-соединение, валидирует JWT через `auth:hello`.
- Регистрирует connection в Redis (`ws:conn:{user_id}`) — для presence и pub/sub.
- Маршрутизирует входящие сообщения в соответствующий handler.
- Подписывает клиента на нужные каналы: `user:{id}`, `match:{id}`, `lobby:{id}`.
- Получает события от Game Workers через Redis pub/sub и пересылает клиенту.
- Управляет backpressure: если клиент медленный — дропает старые snapshots.

## Sticky sessions

Один user обслуживается одним WS Gateway всегда. Реализация через consistent
hashing по user_id в Load Balancer. Это нужно потому что:
- В памяти процесса лежат буферы исходящих сообщений
- Match events приходят через локальную подписку на Redis канал

## Структура

```
src/
├── index.ts           bootstrap
├── server.ts          ws-сервер, accept connections
├── connection.ts      Жизненный цикл одного клиента
├── router.ts          Маршрутизация входящих по type
├── handlers/          По одному файлу на namespace
│   ├── auth.ts
│   ├── matchmaking.ts
│   ├── lobby.ts
│   ├── match.ts
│   └── ping.ts
├── channels/          Подписки на Redis
│   ├── channelManager.ts
│   └── pubsub.ts
└── backpressure.ts    Drop старых snapshots при медленном клиенте
```

## Лимиты

- `WS_MAX_CONNECTIONS=10000` на процесс
- `WS_MESSAGE_RATE_LIMIT=50` сообщений/сек на клиента
- `WS_HEARTBEAT_INTERVAL_MS=30000` — если клиент не отвечает на ping → close

## Протокол

См. `core/src/protocol/messages.ts`. Все 15 client→server и 17 server→client сообщений.
