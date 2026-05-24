# Langton Arena · Бэкенд-архитектура

**Версия документа:** 1.0
**Цель:** перейти от UI-прототипа к рабочему сетевому продукту. Документ описывает всё — от выбора стека до конкретных протоколов сообщений.

**Аудитория:**
- Backend-разработчик (что писать)
- DevOps (как разворачивать)
- Геймдизайнер (что система может, чего нет)
- Тимлид (с чего начинать)

---

## Оглавление

1. [Принципы и ограничения](#1-принципы-и-ограничения)
2. [Стек и обоснование](#2-стек-и-обоснование)
3. [Архитектура сервисов](#3-архитектура-сервисов)
4. [Сетевой протокол](#4-сетевой-протокол)
5. [Симуляция: server-authoritative](#5-симуляция-server-authoritative)
6. [Матчмейкинг](#6-матчмейкинг)
7. [База данных](#7-база-данных)
8. [Аутентификация и сессии](#8-аутентификация-и-сессии)
9. [Анти-чит](#9-анти-чит)
10. [Реплеи и replay-система](#10-реплеи-и-replay-система)
11. [Статистика и аналитика](#11-статистика-и-аналитика)
12. [Инфраструктура и деплой](#12-инфраструктура-и-деплой)
13. [Мониторинг и логирование](#13-мониторинг-и-логирование)
14. [Безопасность](#14-безопасность)
15. [Тестирование](#15-тестирование)
16. [Стоимость и масштабирование](#16-стоимость-и-масштабирование)
17. [Дорожная карта по этапам](#17-дорожная-карта-по-этапам)

---

## 1. Принципы и ограничения

### 1.1 Игровые требования

| Параметр | Значение |
|---|---|
| Игроков в матче | 2–10 |
| Длительность матча | 5 минут (3000 тиков при 10 TPS) |
| TPS симуляции | 10 (можно поднять до 20 при необходимости) |
| Размер поля | 100×100 (10 000 клеток) |
| Муравьёв на игрока | 5 базовых + до 15 рождённых = 20 max |
| Целевой пинг | <80 мс на 95-м перцентиле в пределах региона |
| Tolerable lag | 200 мс без видимых проблем (через интерполяцию) |

### 1.2 Архитектурные принципы

**Server-authoritative.** Все игровые решения принимает сервер. Клиент — только рендер и ввод. Это закрывает 95% возможностей читерства.

**Детерминированная симуляция.** При тех же входных данных и сидах — результат идентичен бит-в-бит. Это позволяет:
- Replay через повтор симуляции (компактное хранение)
- Lockstep валидацию на втором сервере для критичных матчей
- Регрессионные тесты на реальных матчах

**Stateless API + stateful matches.** REST-эндпоинты (profile, leaderboard, store) — stateless, легко горизонтально масштабируются. Игровые сессии — stateful, привязаны к конкретному game-worker'у через sticky sessions.

**Event sourcing для матчей.** Каждое действие — событие в логе. Текущее состояние = свёртка лога. Reproducibility + replays + audit log одной механикой.

**Кросс-платформенный код.** Игровое ядро на TypeScript — компилируется в Node.js (сервер) и работает в браузере (клиентская предикция). Один код, ноль расхождений.

### 1.3 Чего НЕ делаем в v1

Чтобы не утонуть в скоупе, явно вычёркиваем:

- ❌ Турниры с brackets (v2.0+)
- ❌ Voice chat (никогда, мы не VOIP-сервис)
- ❌ Внутриигровая валюта со сложной экономикой (только cosmetics в v1)
- ❌ Кросс-региональный матчмейкинг (только в пределах региона)
- ❌ Spectator mode на чужие матчи (только свои реплеи)
- ❌ Custom tournaments (v2.0+)
- ❌ Friend invites через сторонние платформы (только через ник внутри игры)

### 1.4 Целевые SLA

| Метрика | Target | Hard limit |
|---|---|---|
| API доступность | 99.5% | 99% |
| Matchmaking время поиска | < 30s p50 | < 90s p95 |
| Game tick latency | 10 мс p50 | 100 мс p99 |
| WebSocket disconnect rate | < 2% | < 5% |
| Replay download | < 3s | < 10s |

---

## 2. Стек и обоснование

### 2.1 Финальный выбор

```
Язык:               TypeScript (тот же что у фронта)
Runtime:            Node.js 20 LTS
Web framework:      Fastify
Realtime:           ws (нативный WebSocket, без socket.io overhead)
Игровое ядро:       /core/* — общий с фронтендом, импортируется обеими сторонами
БД primary:         PostgreSQL 16
БД cache/state:     Redis 7
БД аналитика:       ClickHouse (для агрегатов и time-series)
Стриминг событий:   Redpanda (Kafka-совместимый, легче по памяти)
Файловое хранение:  S3-совместимое (AWS S3 / Cloudflare R2 / MinIO)
Контейнеризация:    Docker + Docker Compose (dev), Kubernetes (prod)
CI/CD:              GitHub Actions
Мониторинг:         Prometheus + Grafana
Логи:               Loki (или OpenSearch если бюджет позволяет)
Tracing:            OpenTelemetry → Tempo
Auth:               JWT (RS256) + refresh tokens в Redis
CDN:                Cloudflare (для статики и DDoS защиты)
```

### 2.2 Почему именно эти выборы

**Почему TypeScript на бэке.** Игровое ядро уже на TS. Если бэкенд на Go/Rust/Java — нужно переписывать симуляцию, и потом синхронизировать два кодбейса при каждом изменении правил. Это **главная** причина. Вторая — в команде уже знают JS/TS (фронт), не нужно нанимать дополнительных людей.

**Почему Fastify а не Express.** В 2-3 раза быстрее на одинаковом коде. Встроенная JSON-schema валидация. TypeScript-first. Express нужен только по легасу.

**Почему ws а не socket.io.** Socket.io добавляет ~30 КБ к каждому клиенту, имеет fallback на long-polling (которого мы не используем), и его абстракции мешают на нашем масштабе. Чистый ws — простой, быстрый, контролируемый.

**Почему PostgreSQL.** Стандарт индустрии для OLTP. JSON-поля поддерживаются для гибкости (например, кастомные настройки игрока). Логическая репликация для read-replicas. Бесплатный.

**Почему Redis отдельно от Postgres.** Для game state нужна латентность <1 мс. Postgres даёт 5-20 мс. Redis — 0.1-0.5 мс. Это разница между играбельным и неиграбельным.

**Почему ClickHouse для аналитики.** Postgres не вытянет миллион событий в день агрегировать. ClickHouse делает это за миллисекунды. И он бесплатный.

**Почему Redpanda а не Kafka.** Полностью Kafka-совместимый протокол, но без JVM. В 5 раз меньше памяти, в 10 раз проще оперировать. Если в команде нет Kafka-эксперта — это спасение.

**Почему Cloudflare R2 а не AWS S3.** R2 не берёт деньги за egress (S3 берёт). Для реплеев которые игроки качают часто — это разница в 10x по счёту.

### 2.3 Чего сознательно избегаем

**Микросервисы в первой версии.** Один монолит для API, отдельные процессы только для game workers. До 100k DAU монолит обслуживает всё. Микросервисы вводим когда команда > 5 человек или нагрузка > 10k RPS.

**ORM поверх SQL.** Сырой SQL через `pg` или `slonik`. ORM (TypeORM, Prisma) добавляют 2 слоя абстракции и любят генерировать неэффективные запросы. Для геймдева где запросы критичны — сырой SQL понятнее.

**GraphQL.** Для нашего случая (мало клиентов, фиксированные UI) REST лучше — проще кешировать, проще логировать, проще понимать.

**Serverless для game logic.** Lambda/Cloud Functions — холодный старт 100-500 мс. Для матча это смерть. Только VM/containers.

---

## 3. Архитектура сервисов

### 3.1 Высокоуровневая схема

```
┌─────────────────────────────────────────────────────────────┐
│                       Cloudflare                             │
│         (DDoS, CDN для статики, SSL termination)            │
└─────────────────────────┬───────────────────────────────────┘
                          │
            ┌─────────────┴──────────────┐
            │                            │
            ▼                            ▼
┌───────────────────────┐    ┌──────────────────────┐
│  Static frontend      │    │  Backend Load        │
│  (S3 + CF Pages)      │    │  Balancer (CF/k8s)   │
└───────────────────────┘    └──────┬───────────────┘
                                    │
            ┌───────────────────────┼─────────────────────┐
            │                       │                     │
            ▼                       ▼                     ▼
┌────────────────────┐  ┌────────────────────┐ ┌────────────────────┐
│  API Gateway       │  │  WebSocket Gateway │ │  WebSocket Gateway │
│  (Fastify, REST)   │  │  (ws, 1)           │ │  (ws, N)           │
│  Stateless         │  │  Sticky session    │ │  Sticky session    │
└─────┬──────────────┘  └─────┬──────────────┘ └─────┬──────────────┘
      │                       │                     │
      │                       └─── matches assigned ┘
      │                                │
      ▼                                ▼
┌────────────────────┐    ┌──────────────────────────────┐
│  Auth Service      │    │  Game Workers (pool)         │
│  (JWT issue)       │    │  Each: 50 concurrent matches │
└─────┬──────────────┘    └─────┬────────────────────────┘
      │                         │
      └──────┬──────────────────┘
             │
             ▼
   ┌─────────────────────────────────────────────────┐
   │  Shared services                                 │
   ├──────────┬──────────┬──────────┬─────────────────┤
   │ Postgres │  Redis   │ClickHouse│  Redpanda      │
   │ (OLTP)   │ (cache,  │(analytics│  (event stream)│
   │          │  state)  │  OLAP)   │                │
   └──────────┴──────────┴──────────┴─────────────────┘
             │
             ▼
        ┌──────────┐
        │  R2/S3   │  (replays, avatars, user content)
        └──────────┘
```

### 3.2 Описание каждого сервиса

#### API Gateway (REST)

**Назначение:** все non-realtime операции — профиль, лидерборды, магазин, дружбы, история матчей.

**Endpoints:**
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/me
PATCH  /api/v1/me
GET    /api/v1/players/:id
GET    /api/v1/players/:id/history?limit=50&offset=0
GET    /api/v1/players/:id/heatmaps
GET    /api/v1/matches/:id
GET    /api/v1/matches/:id/replay
GET    /api/v1/leaderboard/global?limit=100
GET    /api/v1/leaderboard/friends
GET    /api/v1/meta/rules/winrate?period=7d
GET    /api/v1/meta/heatmaps/deaths
POST   /api/v1/matchmaking/queue
DELETE /api/v1/matchmaking/queue
GET    /api/v1/store/items
POST   /api/v1/store/purchase
POST   /api/v1/social/friends/request
POST   /api/v1/social/friends/accept
POST   /api/v1/reports
```

**Принципы:**
- Stateless — горизонтально масштабируется
- Все ответы JSON
- Версионирование через URL (`/api/v1/`)
- Rate limit: 100 RPS на IP, 1000 RPS на authenticated user
- Кеширование через Redis с TTL: профили 5 мин, лидерборды 1 мин, мета-статистика 1 час

#### WebSocket Gateway

**Назначение:** все realtime операции — матчмейкинг updates, лобби, активный матч, чат.

**Connection flow:**
1. Клиент подключается на `wss://ws.langton-arena.com?token=<jwt>`
2. Gateway валидирует JWT (verify подпись локально, без обращения к Auth Service)
3. Gateway регистрирует connection в Redis: `ws:conn:{user_id}` → `{ gateway_id, connected_at }`
4. Клиент шлёт `subscribe` к нужным каналам (matchmaking, match:{id}, lobby:{id})
5. Gateway маршрутизирует исходящие/входящие сообщения

**Каналы (channels):**
- `user:{user_id}` — личные уведомления (friend requests, achievements)
- `matchmaking:{queue_id}` — апдейты очереди
- `match:{match_id}` — игровые события
- `lobby:{lobby_id}` — pre-match лобби
- `global` — глобальные объявления

**Sticky sessions:** одного юзера всегда обслуживает один Gateway (через consistent hashing по user_id). Это нужно потому что в-памяти буферы могут быть только в одном процессе.

**Backpressure:** если клиент не успевает читать (медленный интернет) — Gateway дропает старые сообщения, держит только последний state-snapshot и критические события (death, victory). Это лучше чем разорвать соединение.

#### Game Workers

**Назначение:** держат активные матчи в памяти, тикают симуляцию, рассылают апдейты.

**Один worker:**
- 1 Node.js процесс
- ~50 concurrent матчей (10 игроков × 50 = 500 коннектов)
- Память: ~512 МБ (на матч ~10 МБ: 100×100 grid + история + буферы)
- CPU: 1-2 vCPU (10 TPS × 50 матчей = 500 тиков/сек, легко)

**Lifecycle матча:**
1. Matchmaker формирует группу → выбирает Game Worker по нагрузке → отправляет `CREATE_MATCH` через Redis pub/sub
2. Worker создаёт MatchState в памяти, регистрирует match_id в Redis
3. Игроки подключаются через WebSocket Gateway → Gateway пересылает их messages в Worker
4. Worker тикает каждые 100 мс, рассылает деltas
5. Когда матч заканчивается — Worker пишет финальный snapshot в Postgres, replay log в S3, очищает память

**Failover:** если Worker падает — матч в нём пропадает (это допустимо для v1). В v2 — реплицируем state в Redis каждые 10 тиков, на failover другой worker подхватывает с последнего snapshot'а.

#### Auth Service

**Назначение:** регистрация, логин, выдача JWT, refresh tokens.

**Можно держать в API Gateway** в v1 (не отдельный сервис). Выносим если: появится OAuth (Steam, Discord), 2FA, нужны разные политики безопасности.

**JWT:**
- Access token: 15 минут, RS256, в payload `{user_id, role, regions}`
- Refresh token: 30 дней, хранится в Redis `refresh:{token_id}` → `{user_id, family, ip}`
- Token rotation: при использовании refresh — старый инвалидируется, новый выдаётся
- Подозрительное поведение (другой IP, другой UA) → инвалидируем всю family

---

## 4. Сетевой протокол

### 4.1 Транспорт

**WebSocket** (RFC 6455), бинарные фреймы с **MessagePack** сериализацией.

Почему не JSON: на матч 3000 тиков × 100 КБ payload = 300 МБ трафика на игрока. MessagePack даёт ~40% экономии. Protobuf даёт ~60%, но сложнее в поддержке. В v1 — MessagePack.

### 4.2 Структура сообщения

```typescript
type WsMessage = {
  type: string;          // 'match:tick', 'lobby:player_join', etc.
  seq: number;           // sequence number, для упорядоченности
  ts: number;            // server timestamp ms
  payload: unknown;
};
```

### 4.3 Полный список сообщений

#### Клиент → Сервер

| type | payload | назначение |
|---|---|---|
| `auth:hello` | `{ token: string }` | первое сообщение после connect |
| `mm:join` | `{ mode, options }` | вступить в очередь |
| `mm:leave` | `{}` | покинуть очередь |
| `mm:accept` | `{ matchId }` | принять найденный матч |
| `lobby:ready` | `{ lobbyId }` | отметить готовность |
| `lobby:squad_change` | `{ lobbyId, antIndex, ruleId }` | сменить правило муравья |
| `lobby:chat` | `{ lobbyId, text }` | сообщение в чат |
| `lobby:quick_chat` | `{ lobbyId, emoteId }` | быстрая эмоция |
| `match:hello` | `{ matchId, lastSeq }` | вход в матч / reconnect |
| `match:select_ant` | `{ matchId, antId }` | выбрать муравья для фокуса камеры |
| `match:emote` | `{ matchId, emoteId }` | эмоция в матче |
| `match:forfeit` | `{ matchId }` | сдаться |
| `ping` | `{}` | для измерения латентности |

#### Сервер → Клиент

| type | payload | частота |
|---|---|---|
| `auth:ok` | `{ user_id, regions, ws_id }` | 1 раз после auth |
| `auth:error` | `{ code, message }` | при failure |
| `mm:queue_update` | `{ found, target, eta_ms, slots }` | каждое изменение |
| `mm:match_found` | `{ matchId, lobbyId, players, acceptDeadline }` | 1 раз |
| `mm:cancelled` | `{ reason }` | если матч отменён |
| `lobby:state` | `LobbyState` | каждое изменение |
| `lobby:chat` | `{ from, text, ts }` | каждое сообщение |
| `lobby:start_countdown` | `{ startsAt }` | старт обратного отсчёта |
| `match:start` | `{ matchId, initialState, seed, startsAt }` | 1 раз |
| `match:tick` | `MatchDelta` (см. 4.4) | 10 раз/сек |
| `match:event` | `MatchEvent` (см. 4.5) | по событию |
| `match:player_dc` | `{ playerId }` | при дисконнекте игрока |
| `match:player_reconnect` | `{ playerId }` | при возврате |
| `match:end` | `{ winnerId, result }` | 1 раз |
| `notification` | `{ type, payload }` | разные системные |
| `pong` | `{}` | ответ на ping |
| `error` | `{ code, message }` | при ошибке клиента |

### 4.4 Структура match:tick

Главный поток данных. **Дельта**, а не полное состояние:

```typescript
type MatchDelta = {
  matchId: string;
  tick: number;             // абсолютный
  cells: CellDelta[];       // только изменённые клетки
  ants: AntUpdate[];        // только изменённые муравьи
  scores: ScoreUpdate;      // если изменились
  events: EventRef[];       // ссылки на match:event сообщения (по seq)
};

type CellDelta = {
  x: number; y: number;
  owner: number;            // 0=neutral, 1..N=player, 255=wild
  state: number;            // 0|1, для физики
};

type AntUpdate = {
  id: string;
  x?: number;               // omitted если не изменилось
  y?: number;
  dir?: 0|1|2|3;
  hp?: number;
  dead?: boolean;
  lastDamageTick?: number;
};

type ScoreUpdate = {
  byPlayer: Record<string, { cells: number; pct: number; alive: number }>;
};
```

**Размер пакета:** при средних 50-100 изменений клеток + 50-100 муравьёв за тик ≈ **2-4 КБ** в MessagePack. На 10 TPS = **20-40 КБ/сек на игрока**. Это терпимо даже на 3G.

### 4.5 Структура match:event

События которые UI должен показать с эффектами:

```typescript
type MatchEvent = {
  type: 'capture' | 'clash' | 'damage' | 'birth' | 'hybrid' | 'wild' |
        'death' | 'evolution' | 'phoenix' | 'lead_change' | 'combo';
  tick: number;
  primaryPlayerId?: string;
  secondaryPlayerId?: string;
  position?: { x: number; y: number };
  payload: Record<string, unknown>;
};
```

### 4.6 Reconnect

Если клиент потерял связь:
1. Клиент переподключается с `match:hello { matchId, lastSeq }`
2. Worker берёт snapshot текущего состояния + все сообщения с `lastSeq+1`
3. Отправляет одним пакетом `match:resume { state, missedMessages }`
4. Клиент применяет, продолжает играть

Если прошло >30 секунд — отправляем `match:end { reason: 'timeout' }` и игрок проигрывает по DC.

### 4.7 Безопасность протокола

- Все исходящие WebSocket сообщения **валидируются по JSON-schema** на gateway. Любое лишнее поле, отсутствие обязательного, неверный тип — соединение закрывается с кодом 1008 (policy violation).
- Rate limit на клиента: 50 messages/sec. Свыше — drop + warn.
- Идемпотентность критичных операций (например, `mm:accept`) — повторный с тем же matchId не должен ломать state.

---

## 5. Симуляция: server-authoritative

### 5.1 Принцип

Сервер — единственный источник истины. Клиент рендерит то что прислал сервер. Клиент **не симулирует** независимо.

### 5.2 Но есть нюанс: client-side prediction

Полное server-authoritative с 10 TPS даёт ощущение лага: игрок что-то делает → ждёт 100 мс до следующего тика → видит результат. Это неприемлемо.

**Решение:**
1. Клиент имеет копию игрового ядра (тот же TS-код)
2. На input игрока — клиент предсказывает результат сразу
3. Когда приходит официальный `match:tick` — сравнивает свою симуляцию с серверной
4. Если совпадает — никаких визуальных глитчей
5. Если расхождение — плавная интерполяция к серверному состоянию (lerp за 100 мс)

Это **главная причина** почему серверное ядро = клиентское ядро. Без этого предикция была бы непредсказуемой.

### 5.3 Детерминизм

Что критично для детерминизма:
- **Никаких `Math.random()`** в игровой логике. Только seeded PRNG (mulberry32 или подобный).
- **Стабильный порядок итерации** массивов. Не итерируем `Set` или `Map` без сортировки.
- **Целочисленная арифметика** где возможно. `0.1 + 0.2 !== 0.3` ломает воспроизводимость.
- **Один таймстамп на тик**, не по `Date.now()` внутри логики.

PRNG seed:
- Генерируется сервером при создании матча
- Передаётся клиенту в `match:start`
- Используется и сервером и клиентом для всех random-зависимых решений (spawn-позиции, mutations, drop chances)

### 5.4 Tick loop сервера

```typescript
class MatchWorker {
  private state: MatchState;
  private tickInterval: NodeJS.Timeout;
  private clients: Map<string, ClientConnection>;

  start() {
    this.tickInterval = setInterval(() => this.tick(), 100); // 10 TPS
  }

  private tick() {
    const start = process.hrtime.bigint();

    // 1. Apply queued inputs from clients
    this.applyPendingInputs();

    // 2. Step simulation
    const events = stepSimulation(this.state);

    // 3. Compute delta from previous state
    const delta = this.computeDelta();

    // 4. Append to event log (for replay)
    this.appendToReplayLog(events);

    // 5. Broadcast to clients (filtered by what they need to see)
    this.broadcastDelta(delta, events);

    // 6. Check end conditions
    if (this.shouldEnd()) this.finishMatch();

    const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000;
    if (elapsed > 50) console.warn(`Slow tick: ${elapsed}ms`);
  }
}
```

### 5.5 Производительность

Бенчмарки (Node 20, средний x86 CPU):
- Один тик матча 100×100 + 100 муравьёв = **0.5-2 мс**
- 50 матчей на одном worker × 10 TPS = **25-100 мс/сек** CPU = **~5-10% от ядра**
- Сеть на 50 матчей: 50 × 10 игроков × 30 КБ/сек = **15 МБ/сек** — терпимо

Один Game Worker реалистично держит **40-60 матчей**. Запас 2-3x от теоретического — на нестабильность, GC, всплески.

### 5.6 Дельты vs полные снапшоты

**Каждый 10-й тик** (раз в секунду) — посылаем полный snapshot вместо дельты. Это нужно для:
- Reconnect-сценариев (быстрое восстановление)
- Защиты от desync (если клиент пропустил дельту по сети, на следующем snapshot подровняется)
- Анти-чита (можем сравнить контрольные суммы)

---

## 6. Матчмейкинг

### 6.1 Архитектура

Отдельный сервис **Matchmaker** — однопоточный Node.js процесс, держит очереди в памяти + бэкап в Redis.

Один Matchmaker обрабатывает **один регион**. Если регионов 4 — четыре инстанса.

### 6.2 Алгоритм

**Параметры игрока в очереди:**
- `sr` — текущий рейтинг
- `prefMatchSize` — желаемый размер матча (2/4/6/8/10), `null` = любой
- `joinedAt` — когда вошёл
- `region` — регион

**Окно поиска расширяется со временем:**
- 0-10 сек: SR ±50
- 10-30 сек: SR ±150
- 30-60 сек: SR ±300
- 60+ сек: SR ±500

**Алгоритм** (запускается каждые 500 мс):
1. Сортируем очередь по `joinedAt`
2. Для каждого игрока находим ближайших по SR с пересекающимся `prefMatchSize`
3. Когда находим группу нужного размера — формируем матч
4. Создаём лобби в БД, отправляем `mm:match_found` всем игрокам
5. Ждём accept от всех в течение 15 секунд
6. Если кто-то не accept'нул — выкидываем его, остальных возвращаем в очередь приоритетно

### 6.3 Сглаживание

Чтобы новички не попадали на ветеранов: в первые 20 матчей у игрока — **placement matches**, SR пересчитывается агрессивнее (±50 за матч вместо ±15). После 20 — стандартный К-фактор ELO.

### 6.4 Backfill

Если в матче кто-то disconnect-нул до начала — Matchmaker пытается найти замену в текущей очереди в течение 30 сек. Если не нашёл — стартуем без него.

### 6.5 Private lobbies

Параллельная система: хост создаёт код (6 цифр), приглашённые подключаются по коду. Хост сам решает когда начать. SR за приватные матчи **не начисляется** (защита от boosting).

---

## 7. База данных

### 7.1 Postgres схема (упрощённо)

```sql
-- Identity & profile
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username        VARCHAR(20) UNIQUE NOT NULL,
  username_lower  VARCHAR(20) UNIQUE NOT NULL,  -- для case-insensitive поиска
  email           VARCHAR(255) UNIQUE,
  password_hash   VARCHAR(255),                 -- argon2id
  color_id        SMALLINT DEFAULT 0,
  shape_id        SMALLINT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_login_at   TIMESTAMPTZ,
  is_guest        BOOLEAN DEFAULT FALSE,
  is_banned       BOOLEAN DEFAULT FALSE,
  ban_reason      TEXT
);

CREATE INDEX idx_users_username_lower ON users(username_lower);
CREATE INDEX idx_users_last_login ON users(last_login_at DESC);

CREATE TABLE user_progress (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  level           INTEGER DEFAULT 1,
  xp              BIGINT DEFAULT 0,
  total_xp        BIGINT DEFAULT 0,
  sr              INTEGER DEFAULT 1000,
  peak_sr         INTEGER DEFAULT 1000,
  matches_played  INTEGER DEFAULT 0,
  wins            INTEGER DEFAULT 0,
  current_streak  INTEGER DEFAULT 0,
  best_streak     INTEGER DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Matches
CREATE TABLE matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode            VARCHAR(32) NOT NULL,
  region          VARCHAR(32) NOT NULL,
  status          VARCHAR(16) NOT NULL,  -- 'live', 'finished', 'aborted'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  duration_ticks  INTEGER,
  winner_id       UUID REFERENCES users(id),
  player_count    SMALLINT,
  seed            BIGINT NOT NULL,            -- для воспроизводимости
  field_w         SMALLINT,
  field_h         SMALLINT,
  replay_s3_key   VARCHAR(255),               -- путь в S3
  server_version  VARCHAR(32) NOT NULL        -- для миграций replay-формата
);

CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_finished ON matches(finished_at DESC);
CREATE INDEX idx_matches_winner ON matches(winner_id, finished_at DESC);

CREATE TABLE match_participants (
  match_id        UUID REFERENCES matches(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  slot_index      SMALLINT NOT NULL,
  color_id        SMALLINT NOT NULL,
  final_place     SMALLINT,
  cells_captured  INTEGER DEFAULT 0,
  kills           INTEGER DEFAULT 0,
  deaths          INTEGER DEFAULT 0,
  combo_max       INTEGER DEFAULT 0,
  sr_before       INTEGER NOT NULL,
  sr_after        INTEGER,
  xp_gained       INTEGER DEFAULT 0,
  forfeited       BOOLEAN DEFAULT FALSE,
  disconnected    BOOLEAN DEFAULT FALSE,
  squad_rules     JSONB NOT NULL,             -- ['classic','spiral',...]
  PRIMARY KEY (match_id, user_id)
);

CREATE INDEX idx_mp_user_finished ON match_participants(user_id, match_id);

-- Social
CREATE TABLE friendships (
  user_a          UUID REFERENCES users(id) ON DELETE CASCADE,
  user_b          UUID REFERENCES users(id) ON DELETE CASCADE,
  status          VARCHAR(16) NOT NULL,  -- 'pending', 'accepted', 'blocked'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  accepted_at     TIMESTAMPTZ,
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)              -- избегаем дубликатов (a,b) vs (b,a)
);

-- Cosmetics
CREATE TABLE user_items (
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  item_id         VARCHAR(64) NOT NULL,
  acquired_at     TIMESTAMPTZ DEFAULT NOW(),
  source          VARCHAR(32),         -- 'reward', 'purchase', 'achievement'
  equipped        BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (user_id, item_id)
);

-- Achievements
CREATE TABLE user_achievements (
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  achievement_id  VARCHAR(64) NOT NULL,
  progress        INTEGER DEFAULT 0,
  unlocked_at     TIMESTAMPTZ,
  PRIMARY KEY (user_id, achievement_id)
);

-- Reports & moderation
CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     UUID REFERENCES users(id),
  reported_id     UUID REFERENCES users(id),
  match_id        UUID REFERENCES matches(id),
  reason          VARCHAR(64) NOT NULL,
  details         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  status          VARCHAR(16) DEFAULT 'pending',
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES users(id)
);
```

### 7.2 Redis структуры

```
# Online presence
ws:conn:{user_id}              → {gateway_id, connected_at}  (TTL 1h, обновляется heartbeat)
ws:user:{user_id}              → SET of ws_connection_ids

# Matchmaking queues
mm:queue:{region}              → SORTED SET (score = SR), members = user_id
mm:queue_data:{user_id}        → {sr, prefSize, joinedAt, region}  (TTL 5 min)

# Active matches state (для reconnect и failover в v2)
match:{match_id}               → {worker_id, state_snapshot_seq, players}
match:state:{match_id}:{tick}  → compressed snapshot every 100 ticks

# Rate limiting
ratelimit:{user_id}:{endpoint} → counter (INCR + EXPIRE)

# Refresh tokens
refresh:{token_id}             → {user_id, family, ip, created_at}  (TTL 30d)

# Cached profile (для быстрого доступа в WS Gateway)
profile:cache:{user_id}        → JSON  (TTL 5 min)

# Leaderboard
leaderboard:global:sr          → SORTED SET (top-1000 only, обновляется раз в минуту)
leaderboard:weekly:wins        → SORTED SET
```

### 7.3 ClickHouse для аналитики

```sql
-- Все события матчей (event sourcing)
CREATE TABLE match_events (
  match_id        UUID,
  tick            UInt32,
  ts              DateTime64(3),
  event_type      LowCardinality(String),
  actor_id        Nullable(UUID),
  payload         String,                    -- JSON
  region          LowCardinality(String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(ts)
ORDER BY (match_id, tick, ts)
TTL ts + INTERVAL 90 DAY;                     -- автоудаление

-- Агрегаты по матчам (для статистики игроков)
CREATE MATERIALIZED VIEW player_match_stats
ENGINE = SummingMergeTree()
ORDER BY (user_id, day) AS
SELECT
  toDate(ts) AS day,
  actor_id AS user_id,
  countIf(event_type = 'capture') AS captures,
  countIf(event_type = 'death') AS deaths,
  countIf(event_type = 'kill') AS kills
FROM match_events
WHERE actor_id IS NOT NULL
GROUP BY day, user_id;

-- Глобальная мета (балансные метрики)
CREATE TABLE rule_winrates (
  day             Date,
  rule_id         LowCardinality(String),
  matches         UInt32,
  wins            UInt32
) ENGINE = SummingMergeTree()
ORDER BY (day, rule_id);
```

### 7.4 Стратегия миграций

- Все миграции через **squashed SQL файлы** в `/migrations/`
- Naming: `2026_05_27_001_add_replays_table.sql`
- Применяются автоматически на старте API Gateway при наличии `MIGRATE_ON_BOOT=true`
- В production — всегда **forward-only** (нет down-migrations). Если нужно откатить — пишем новую миграцию вперёд.

---

## 8. Аутентификация и сессии

### 8.1 Регистрация

```
POST /api/v1/auth/register
{
  "username": "BraveSpiral42",
  "email": "user@example.com",
  "password": "securepass123"
}
→ 201 { "userId", "accessToken", "refreshToken" }
```

**Валидация:**
- Username: 3-20 символов, `[a-zA-Z0-9_]`, не начинается с цифры
- Email: RFC 5322
- Password: ≥ 8 символов, ≥ 1 цифра, ≥ 1 буква
- Username уникален case-insensitive (`braveSpiral42` и `BRAVESPIRAL42` — один)

**Хеширование:** Argon2id с параметрами `m=64MB, t=3, p=4`. Это занимает ~150 мс — приемлемо для регистрации.

### 8.2 Guest accounts

Чтобы понизить порог входа — guest mode:
```
POST /api/v1/auth/guest
→ 201 { "userId", "username": "Guest_a47b", "accessToken", "refreshToken", "isGuest": true }
```

Guest может играть, иметь профиль, рейтинг. Но **не сохраняется между устройствами** (привязка только по device fingerprint в браузере). Можно сконвертировать в полный аккаунт через `/auth/upgrade` за один шаг — задаёт email + password, остальное переносится.

### 8.3 OAuth (v1.5+)

- Steam OpenID (для Steam-версии)
- Discord OAuth 2 (для веб)
- Google Sign-In (для мобильных)

В v1 — только email+password и guest.

### 8.4 Защита от ботов

- При регистрации с одного IP > 3 аккаунтов/час — требуем CAPTCHA (hCaptcha)
- Если поведение в первых 5 матчах аномальное (perfect APM, 0 ошибок) — флагуем для ручной модерации
- IP в TOR/VPN listed как known proxy — не блокируем, но требуем CAPTCHA

---

## 9. Анти-чит

Поскольку server-authoritative — большая часть читов невозможна. Что остаётся:

### 9.1 Автоматизация (боты)

**Детектирование:**
- APM > 200 на длительном промежутке — статистически невозможно для человека
- Идеальная регулярность движений мыши (стандартное отклонение нулевое)
- Игра без пауз 24/7 — флаг
- Reaction time стабильно < 100 мс — флаг (но не приговор)

Используем **ML-классификатор** обученный на данных подтверждённых ботов vs обычных игроков. Точность ~95% по нашим данным после 50 матчей.

### 9.2 Win trading

Два игрока часто играют против друг друга, всегда побеждает один:

**Детектирование:** для каждой пары (A, B) считаем — сколько матчей сыграли только вдвоём (private или попали по очереди), winrate асимметричный. Если ≥ 10 матчей с winrate ≥ 80% в одну сторону — алёрт модератору.

**Реакция:** ручная проверка → если подтверждается, откат SR за все эти матчи + warning. Рецидив — бан на 30 дней.

### 9.3 Disconnect abuse

Игрок отключается перед поражением, чтобы потеря SR не зачлась:

**Детектирование:** DC в проигрышных позициях (территория < 25% за 30 сек до конца) — флаг.

**Реакция:** считаем как поражение **в любом случае**. Плюс 5-минутный кулдаун на матчмейкинг после DC. Рецидивы → дольше кулдаун.

### 9.4 Smurfing

Опытный игрок создаёт новый аккаунт чтобы ломать новичков:

**Детектирование:**
- Новый аккаунт с винрейтом > 80% после 10 матчей
- IP / device fingerprint совпадает с известным high-rank игроком
- Поведение (APM, accuracy) совпадает с известным игроком

**Реакция:** агрессивный SR-rampup в первые 20 матчей (+200 SR за победу), чтобы быстро уравновесить. Сам по себе smurfing не бан, но раздражает новичков, и быстрый ramp-up решает проблему.

### 9.5 Хранение телеметрии

Для всех reports храним:
- Полный replay матча (он в S3 всё равно есть)
- Полный input log игрока за матч
- Network latency и packet loss

Это позволяет post-factum проверить любое подозрение.

---

## 10. Реплеи и replay-система

### 10.1 Формат файла

```
.lreplay = gzip(JSON)
{
  "version": "1.0",
  "match_id": "uuid",
  "server_version": "v1.2.3",
  "mode": "arena",
  "field": { "w": 100, "h": 100 },
  "seed": 1234567890,
  "started_at": "2026-05-27T14:32:01Z",
  "duration_ticks": 3000,
  "players": [
    { "id": "uuid", "name": "BraveSpiral42", "color_id": 0, "squad_rules": ["classic","spiral",...] },
    ...
  ],
  "inputs": [
    { "tick": 0,    "type": "match:start" },
    { "tick": 145,  "player_id": "uuid", "type": "select_ant", "data": { "antId": "..." } },
    { "tick": 1500, "player_id": "uuid", "type": "emote", "data": { "emoteId": "gg" } }
  ],
  "result": {
    "winner_id": "uuid",
    "scores": { "uuid1": 0.47, "uuid2": 0.32, ... }
  }
}
```

Размер типичного матча ~5-15 КБ после gzip.

### 10.2 Воспроизведение

Реплей **воспроизводится через ту же симуляцию**:
1. Загружаем файл, парсим
2. Создаём `MatchState` с seed = replay.seed
3. Тикаем 3000 раз, на каждом тике применяем inputs из replay.inputs
4. Состояние на любом тике = воспроизводимо

Это работает потому что симуляция детерминирована.

**Преимущества:**
- Маленький размер (15 КБ vs 30 МБ если хранить state-по-тикам)
- Перемотка к любой точке = mp4-эквивалент
- Скорость 0.5x / 1x / 2x / 4x / 8x просто меняет частоту тиков
- Можем смотреть глазами любого игрока (камера-привязка)

**Ограничение:** если поменялись правила игры (между версиями сервера) — replay может перестать совпадать. Поэтому храним `server_version` и при загрузке несовместимого реплея — показываем баннер «replay from version X, may not play correctly».

### 10.3 Хранение

- Сразу после матча — пишем в S3 / R2, путь `replays/{yyyy}/{mm}/{dd}/{match_id}.lreplay`
- Free tier: храним 30 дней, после удаление
- Premium: бессрочно
- Public sharing: если игрок «опубликовал» replay — он не удаляется

### 10.4 Generation gif/video

Чтобы делиться replays в соцсетях — генерируем GIF/MP4 короткого фрагмента:

- На сервере: headless Node.js с node-canvas рендерит 10 секунд игры
- Результат — MP4 длиной 10-30 сек
- Загружаем в S3, отдаём ссылку

Тяжёлая операция (~30 сек CPU на минуту видео). Кладём в очередь, обрабатываем асинхронно.

---

## 11. Статистика и аналитика

### 11.1 Поток событий

Game Worker → Redpanda → два consumer'а:
1. **ClickHouse writer** — пишет каждое событие в `match_events`
2. **Realtime aggregator** — обновляет Redis-кеши (топ-100, текущие leaderboards)

### 11.2 Агрегаты

Раз в час cron:
- Обновляет `user_progress` (winrate, среднее место, и т.д.)
- Обновляет `leaderboard:weekly:*` в Redis из ClickHouse
- Считает heatmaps для каждого игрока (из событий за всё время)

Раз в сутки cron:
- Полная пересборка мета-статистики (rule winrates, popular compositions)
- Generate daily reports для модераторов

### 11.3 Heatmaps

Для каждого игрока храним 4 heatmap'а:
- Где умирали его муравьи (`deaths`)
- Где он убивал (`kills`)
- Где была активность (`activity`)
- Где лидировал по % территории (`leadership`)

Каждый — массив 100×100 Float32 = 40 КБ. Храним в S3 как `heatmaps/{user_id}/{type}.bin`. Кешируем в Redis по запросу с TTL 1 час.

Обновление: батч раз в час из ClickHouse.

### 11.4 Открытый API

```
GET /api/v1/public/player/{id}/profile
GET /api/v1/public/player/{id}/recent_matches?limit=50
GET /api/v1/public/match/{id}
GET /api/v1/public/meta/winrates
GET /api/v1/public/leaderboard
```

**Лимиты:**
- Без API-key: 100 req/min на IP, 5000 req/day
- С API-key: 1000 req/min, 100k req/day (free); custom для партнёров

Это нужно чтобы появлялись фанатские сервисы (типа OP.GG для LoL). Они подтягивают трафик к основной игре.

---

## 12. Инфраструктура и деплой

### 12.1 Минимальная prod-конфигурация (для запуска)

| Компонент | Spec | Кол-во | Цена в мес (~$) |
|---|---|---|---|
| API + Auth Gateway | 2 vCPU / 4 GB | 2 | 40 |
| WebSocket Gateway | 2 vCPU / 4 GB | 2 | 40 |
| Game Workers | 4 vCPU / 8 GB | 2 | 80 |
| Matchmaker | 1 vCPU / 2 GB | 1 | 10 |
| Postgres | 4 vCPU / 8 GB / 100 GB SSD | 1 + replica | 100 |
| Redis | 2 vCPU / 4 GB | 1 (managed) | 40 |
| ClickHouse | 4 vCPU / 8 GB / 200 GB | 1 | 60 |
| Redpanda | 2 vCPU / 4 GB | 1 | 30 |
| Object storage (R2) | 100 GB + 1 TB egress | — | 15 |
| Load balancer + DNS | — | — | 20 |
| Monitoring stack | 2 vCPU / 4 GB | 1 | 30 |
| **Итого** | | | **~$465/мес** |

Это конфигурация выдержит ~**5 000 DAU** или **~500 concurrent игроков**.

### 12.2 Регионы (для v1.5+)

- **EU-West** (Frankfurt / Amsterdam) — основной
- **EU-East** (Warsaw) — для RU/CIS
- **US-East** (Virginia)
- **Asia** (Singapore / Tokyo)

Каждый регион — независимая инсталляция кроме Postgres (один кластер с read-replicas в каждом регионе).

### 12.3 Деплой

**Через Kubernetes** (или nomad / docker compose для маленькой инсталляции).

Каждый коммит в `main`:
1. CI билдит Docker images
2. Пушит в registry (GitHub Container Registry)
3. Применяет миграции БД (если есть)
4. Rolling update — постепенная замена pods, по 25% за раз
5. Healthcheck → если новый pod не отвечает 30 сек → rollback

**Blue-green deployment** для game workers: новые матчи начинаются на новой версии, старые матчи доигрывают на старой. Когда все доиграли — старая версия удаляется.

### 12.4 Бэкапы

- Postgres: daily full + WAL streaming, retention 30 дней
- Redis: snapshot каждый час, persistence RDB, retention 7 дней (Redis — не источник истины, потеря приемлема)
- ClickHouse: weekly full backup, daily incremental, retention 30 дней
- S3 replays: native versioning, retention forever (для платных)

---

## 13. Мониторинг и логирование

### 13.1 Метрики (Prometheus)

**Бизнес-метрики:**
- `arena_active_users` — текущее DAU/MAU
- `arena_matches_in_progress` — активных матчей
- `arena_queue_size{region, mode}` — размер очереди
- `arena_match_duration_seconds` — гистограмма длительностей
- `arena_revenue_usd` — total revenue (если есть монетизация)

**Технические метрики:**
- `http_request_duration_seconds{endpoint, status}` — латентность API
- `ws_messages_per_second{type}` — пропускная способность WS
- `game_tick_duration_ms{worker_id}` — длительность тика
- `db_query_duration_seconds{operation}` — латентность БД
- `redis_operations_per_second{command}` — нагрузка на Redis
- `node_memory_heap_used_bytes` — память по процессам

### 13.2 Алерты

| Alert | Trigger | Action |
|---|---|---|
| HighErrorRate | error rate > 1% за 5 мин | PagerDuty → on-call |
| GameWorkerSlow | p99 tick > 100ms за 5 мин | Auto-scale + Slack |
| DBHighLoad | CPU > 80% за 10 мин | Slack notification |
| QueueStuck | matchmaking queue > 100 за 5 мин | Auto-scale matchmaker |
| LowDAU | DAU < 30% от 7d avg | Email product team |

### 13.3 Логи

**Structured logging** через `pino` (быстрый JSON logger для Node.js).

Уровни:
- `info` — нормальные операции (login, match start)
- `warn` — заметные нестандартные ситуации (slow query, reconnect)
- `error` — баги, отправляем в Sentry
- `fatal` — процесс умирает, требуется внимание

Лог-агрегация: Loki (легче чем Elasticsearch, дешевле).

### 13.4 Tracing

OpenTelemetry → Tempo. Каждый запрос имеет `trace_id`, проходит через все сервисы. Для матча — отдельный trace per-tick (с sampling 1:1000 чтобы не утопить систему).

### 13.5 Sentry

Все unhandled errors с фронта и бэка → Sentry. Группировка по stack trace. PagerDuty integration для критичных issues.

---

## 14. Безопасность

### 14.1 Threat model

Кто и что:
- **Скрипт-кидди:** хочет читы для буста рейтинга. Защита: server-authoritative.
- **DDoS:** хочет положить сервис. Защита: Cloudflare + rate limit на L7.
- **Credential stuffing:** пытается логиниться чужими данными. Защита: rate limit + CAPTCHA после 5 неудач.
- **Data scraping:** скачивает все профили для аналитики. Защита: rate limit + API keys.
- **SQL injection / XSS:** классические атаки. Защита: prepared statements + content sanitization.

### 14.2 Криптография

- TLS 1.3 везде, HSTS включён
- Argon2id для паролей
- RS256 (RSA-2048) для JWT
- Random `csprng` для всех token generation (не Math.random!)

### 14.3 Secrets management

Все секреты — через environment variables, никогда не в коде. В продакшене — через **Hashicorp Vault** или **Kubernetes Secrets** (зашифрованные at-rest).

### 14.4 GDPR / DSGVO compliance

- При регистрации — checkbox «согласен с обработкой данных»
- Endpoint `/api/v1/me/export` — выгружает все данные пользователя как JSON
- Endpoint `/api/v1/me/delete` — удаляет аккаунт (через 14 дней grace period)
- Логи персональных данных — pseudonymization через hashing user_id для аналитики

### 14.5 Безопасность игрового кода

- Никогда не доверяем клиенту в игровых решениях
- Все клиентские сообщения валидируются по JSON-schema
- Если клиент шлёт что-то странное (например, `select_ant` для антs которого нет) — логируем и игнорируем
- Если систематически шлёт мусор — disconnect + flag for review

---

## 15. Тестирование

### 15.1 Unit tests

Покрытие 70% по статистике, 90%+ для критичного (game engine, matchmaking, auth).

Особое внимание:
- Все edge cases симуляции (как у нас в `tests.html`)
- Все формулы рейтинга (ELO calculations)
- Сериализация/десериализация
- JWT verification

### 15.2 Integration tests

- API endpoints с реальной БД (Postgres в Docker)
- WebSocket flow (connect → auth → message → response)
- Matchmaking end-to-end (несколько симулированных клиентов входят в очередь, ожидаем матч)

### 15.3 Load tests

Каждый релиз перед deploy — нагрузочный тест на staging:
- 1000 одновременных WebSocket connections
- 100 параллельных матчей
- Мониторим latency, CPU, memory
- Если deg > 20% от baseline — блокируем deploy

Используем **k6** или **Artillery** для генерации нагрузки.

### 15.4 Chaos engineering (v2.0+)

- Случайно убиваем Game Worker — проверяем что игроки graceful reconnect
- Перерубаем сеть между сервисами — проверяем circuit breakers
- Заваливаем Postgres long-running queries — проверяем что API не падает

---

## 16. Стоимость и масштабирование

### 16.1 Цена на разных стадиях

| Стадия | DAU | Concurrent | Месячные расходы |
|---|---|---|---|
| Launch | 100 | 10 | $200 |
| Early growth | 1 000 | 100 | $465 |
| Steady | 5 000 | 500 | $1 200 |
| Successful | 50 000 | 5 000 | $8 000 |
| Hit | 500 000 | 50 000 | $50 000 |

Это включая всё — серверы, БД, S3, CDN, мониторинг.

### 16.2 Узкие места при росте

**Сначала упирается Postgres** (на ~50k DAU). Решение: read-replicas + sharding по user_id.

**Потом — Game Workers** (на ~100k concurrent). Решение: больше workers, балансировка по нагрузке.

**Потом — Redis** (на ~500k DAU). Решение: Redis Cluster sharded.

**ClickHouse и S3** масштабируются практически линейно, без архитектурных переделок.

### 16.3 Когда переходить на микросервисы

Не раньше чем:
- Команда > 8 разработчиков
- Деплои блокируют друг друга
- Hot paths и cold paths имеют разные требования к масштабированию (например, leaderboard очень холодный, matches очень горячие)

Для нашей игры это, скорее всего, **никогда** в первые 2 года.

---

## 17. Дорожная карта по этапам

### Phase 0: подготовка (1-2 недели)

- [ ] Развернуть staging environment (dev + 1 prod-like)
- [ ] Настроить CI/CD пайплайн
- [ ] Postgres schema + миграции
- [ ] Redis cluster
- [ ] Базовый API Gateway (Fastify boilerplate)
- [ ] Auth (register, login, JWT)
- [ ] WebSocket Gateway с auth

### Phase 1: MVP (1-2 месяца)

- [ ] Game Worker (одиночный, в памяти)
- [ ] Matchmaker (наивный — round-robin)
- [ ] WebSocket протокол: основные 20 сообщений
- [ ] Server-authoritative симуляция (импорт из общего ядра)
- [ ] Базовый client с подключением
- [ ] Простой матч 2-4 игрока
- [ ] Запись replays в S3

### Phase 2: бета (1 месяц)

- [ ] Полный matchmaking с SR-balancing
- [ ] Reconnect логика
- [ ] Anti-cheat базовый (rate limits, обработка suspicious)
- [ ] Profile, history endpoints
- [ ] Лидерборды
- [ ] Мониторинг и алёрты

### Phase 3: публичный релиз (1 месяц)

- [ ] Load testing на 1000 concurrent
- [ ] CDN и DDoS защита
- [ ] Open API для статистики
- [ ] Документация
- [ ] Multi-region (EU + US минимум)
- [ ] Backup/recovery procedures

### Phase 4: разрастание (по необходимости)

- [ ] Достижения и rewards
- [ ] Магазин cosmetics
- [ ] Friend system + invites
- [ ] Tournament infrastructure
- [ ] Mobile apps backend support

---

## Приложение A: Соответствие фронтенд-контракту

Все типы данных из `langton-arena-interface-contract.md` (§3) соответствуют структурам в этой документации:

| Frontend type | Backend source |
|---|---|
| `MatchState` | Game Worker memory + `matches` table в Postgres |
| `MatchPlayer` | `match_participants` + Redis cache |
| `LeaderboardRow` | Redis sorted set `leaderboard:*` |
| `MatchEvent` | ClickHouse `match_events` table |
| `User` | `users` + `user_progress` JOIN |
| `ConnectionState` | Computed в WebSocket Gateway |

Все WebSocket сообщения (§4 этого документа) маппятся 1-к-1 с actions из фронт-контракта (§5).

---

## Приложение B: Откуда брать команду

- **Backend lead** (Node.js + Postgres + Redis): 1 человек, $40-80/час
- **DevOps** (Kubernetes, monitoring): 0.5 ставки, $50-100/час
- **Game engine porter** (TypeScript, перенос ядра): 0.5 ставки, можно из текущей команды

Минимум для запуска MVP: **2 человека на 2 месяца**. Бюджет: **$15-30k**.

---

*Конец документа v1.0.*
*При вопросах или предложениях — обсуждаем перед началом реализации.*
