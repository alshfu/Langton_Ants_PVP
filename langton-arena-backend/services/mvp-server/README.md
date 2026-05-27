# @langton/mvp-server

**Stage 8 PvP MVP — single-process WebSocket game server**

Временный сервис. Stage 10 — миграция в `ws-gateway` + `game-worker`. До тех пор `mvp-server` — единственный backend который реально работает.

## Запуск

```bash
# Из корня репо
pnpm dev:mvp                  # tsx watch на http://localhost:8080
pnpm test:mvp                 # vitest

# Прямо в сервисе
cd langton-arena-backend/services/mvp-server
pnpm dev                       # dev with hot-reload
pnpm test                      # vitest run
pnpm build && pnpm start       # production build
```

Дефолтный bind: `127.0.0.1:8080`. Override через env:

```bash
PORT=9001 HOST=0.0.0.0 pnpm dev
```

## Что сделано (Day 2)

- ✅ WebSocket listener (lib: `ws`)
- ✅ Per-connection state (`Connection` class)
- ✅ JSON message routing (`router.ts` — parse → validate shape → dispatch)
- ✅ Protocol types (`messages.ts` — все 10 типов из spec §4.2)
- ✅ i18n с **10 локалями** × **12 error codes** = 120 переведённых строк
- ✅ Tests: **23 vitest** (i18n + router + integration server)

## Что НЕ сделано (Day 3+)

- ❌ Room state (lobby logic) → Day 3
- ❌ Match lifecycle (countdown, ticks, broadcast) → Day 4
- ❌ Deploy validation + queue → Day 5
- ❌ Replay JSON storage + HTTP endpoint → Day 12
- ❌ Rate limiting → Day 17

## Architecture

```
WebSocket :8080
   │
   ▼
MvpServer (server.ts)
   ├─ Set<Connection> (tracking)
   ├─ on('connection') → new Connection
   └─ Connection.ws.on('message') → routeMessage(conn, raw)
        │
        ▼
   routeMessage (router.ts)
        ├─ JSON.parse → MALFORMED_MESSAGE
        ├─ isClientMessage shape check → MALFORMED / UNKNOWN_TYPE
        └─ dispatch(conn, msg)
            ├─ join_room    → setLocale, send room_joined  ← stub
            ├─ leave_room   → clear roomCode               ← stub
            ├─ set_ready    → check roomCode               ← stub (Day 3)
            ├─ deploy       → MATCH_NOT_ACTIVE             ← stub (Day 5)
            └─ ping         → pong (working)
```

## Engine import

```ts
import { stepLangton, makeLangtonState } from '@langton/core';
// workspace dependency — резолвится в langton-arena-backend/core/
```
