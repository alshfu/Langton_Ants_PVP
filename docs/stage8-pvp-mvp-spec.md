# ТЗ · Stage 8 · PvP MVP — первый матч между двумя браузерами

**Версия:** 8.1 (обновлено под реальное состояние backend folder)
**Срок:** 3-4 рабочих недели (≈ 20 дней работы)
**Цель:** **запустить настоящий PvP-матч** между двумя браузерами через WebSocket. Без auth, без matchmaker, без ELO, без profile — только **core loop: connect → match → finish → replay**.

> **Источник:** написано Web Claude в claude.ai. Скопировано в репо Claude Code 2026-05-28 как `docs/stage8-pvp-mvp-spec.md` для общего доступа.
>
> **HANDOVER** от Web Claude к Claude Code: `docs/HANDOVER-stage8-from-web-claude.md` — содержит **пересмотренный Q1** на основе анализа реального snapshot (см. § «Ответы на Q1-Q6»).

---

## 0. Контекст из v8.0 → v8.1

В v8.0 я не знал точное состояние backend folder. Тимлид предоставил скелет проекта. Главные открытия:

1. **Backend существует как design** — 5 микросервисов есть как папки, есть архитектурные документы, но **сервисы не запускаются**, не деплоятся, билинг закрыт.
2. **`core/` в backend — "зеркальная копия" frontend engine** — может рассинхронизироваться, нужно превратить в **shared workspace package** перед началом MVP.
3. **Frontend ушёл вперёд** — теперь 27 пресетов, 4 топологии (torus/wall/bounce/void), до 1000×1000, 10 локалей, 138 тестов.
4. **Billing закрыт** → деплой невозможен. MVP работает **локально** на `localhost:8080`.

Эти 4 открытия меняют план. Изменения v8.0 → v8.1 — в §17 (changelog в конце).

---

## 1. Контекст — почему MVP сначала

7 этапов sandbox мы строили **офлайн-инструмент**. После него осталось доказать **главную гипотезу проекта**: что детерминированная симуляция Лэнгтона **реально работает в сетевом режиме** между двумя физическими браузерами с client-side prediction.

Без этого доказательства — все 7 этапов остаются «красивой песочницей». С ним — становятся **рабочей платформой** на которой можно строить matchmaking, ELO, tournaments.

**Гипотеза которую проверяем:** один и тот же seed + один и тот же timeline of inputs → bit-identical результат на сервере и у обоих клиентов. Это **уже доказано** в офлайн-режиме (15/15 пресетов bit-deterministic), но мы должны проверить что **сетевая задержка не ломает** этот инвариант.

---

## 2. Что считается «готово»

После Stage 8 пользователь может:

1. Открыть `http://localhost:5173/?room=abc123` → видит «Waiting for opponent»
2. Открыть тот же URL в другой вкладке (incognito) → автоматический matchmaking двух игроков в один room
3. Видеть друг друга в Lobby — никнеймы (анонимные random animals), готовность, фиксированный preset
4. Нажать "Ready" оба → countdown 3-2-1 → начало матча
5. Играть **Stage 6 механику** (deploy clicks) — синхронизация в реальном времени между браузерами
6. Видеть один и тот же state field в обоих браузерах (client-side prediction для своих deploys)
7. Получить banner победы одновременно (один из 5 win conditions)
8. Скачать replay матча в JSON формате с сервера (compatible со Stage 7 format)

Не входит в Stage 8:
- ❌ Регистрация / login / JWT (всё анонимно через temp UUID)
- ❌ Postgres / Redis / ClickHouse (всё в памяти процесса; replay в .json файлах на диске)
- ❌ Matchmaker через ELO (room code = вручную в URL)
- ❌ Profile / history / heatmaps
- ❌ Reconnect (disconnect = матч завершается)
- ❌ Multi-region / production deploy (всё на `localhost`)
- ❌ MessagePack (используем JSON)
- ❌ PvP-поле > 200×200 (sandbox остаётся 1000×1000)

Эти **переезжают в Stage 9-12**.

---

## 3. Backend — новый сервис `mvp-server/`

### 3.1 Решение: НЕ трогаем существующие 5 сервисов

В `langton-arena-backend/services/` уже есть 5 папок (api-gateway, ws-gateway, game-worker, matchmaker, analytics-consumer). Это **design** без работающего кода. Мы **не трогаем их** в Stage 8 — это работа Stage 9-11.

Создаём **новый шестой сервис** `services/mvp-server/`. Он временный — после Stage 10 его логика мигрирует в ws-gateway+game-worker и mvp-server удаляется.

```
langton-arena-backend/
├── core/                          ← пакет @langton/core (см §3.2)
│   └── src/
│       └── (содержимое из frontend engine, через workspace symlink)
└── services/
    ├── api-gateway/               ← (existing, не трогаем)
    ├── ws-gateway/                ← (existing, не трогаем)
    ├── game-worker/               ← (existing, не трогаем)
    ├── matchmaker/                ← (existing, не трогаем)
    ├── analytics-consumer/        ← (existing, не трогаем)
    └── mvp-server/                ←─── 🎯 НОВЫЙ сервис в Stage 8
        ├── src/
        │   ├── main.ts            ← entry point, WS listener на 8080
        │   ├── connection.ts      ← per-client state
        │   ├── room.ts            ← lobby logic
        │   ├── match.ts           ← active match (tick loop, broadcast)
        │   ├── messages.ts        ← protocol types
        │   ├── storage.ts         ← JSON file save/load в data/
        │   └── i18n.ts            ← error/lobby messages для клиента
        ├── tests/
        │   └── (30+ vitest tests)
        ├── package.json
        └── tsconfig.json
```

### 3.2 Engine sharing — pnpm workspace

**Проблема:** в backend `core/` сейчас «зеркало копия» engine. Это **опасно** — изменения в engine на frontend не автоматически попадают на backend, детерминизм рассинхронизируется.

**Решение:** превратить `langton-arena-backend/core/` в pnpm workspace package `@langton/core`:

1. Удаляем содержимое `backend/core/src/langton/` (копию)
2. В `backend/core/package.json` создаём workspace dependency на frontend engine
3. Или (вариант **B**): перемещаем `langton-arena-web/src/core/langton/` в корневой workspace package, и frontend, и backend импортируют его как `@langton/core`

**Голосую за B** — yes, требует рефакторинга frontend (1 день), но **гарантирует** что server и client используют **тот же** код. Это **критично** для детерминизма.

День 1 MVP — этот рефакторинг.

### 3.3 Storage — JSON файлы

Для MVP **никакой БД**. Сохраняем замершее состояние:
- `data/matches/<matchId>.json` — финальный snapshot + winner + duration
- `data/replays/<matchId>.json` — полный timeline of inputs (compatible со Stage 7 replay format)

Это **то же самое** что мы делаем в Stage 7 на клиенте, только теперь на сервере. **Никаких миграций, никакого setup БД, никаких ORM**. Просто `fs.writeFileSync`.

В Stage 9 заменим на Postgres. До тех пор — JSON files достаточно.

### 3.4 Производительность для 200×200

Бенчмарки из backend-architecture: один тик 100×100 + 100 муравьёв = 0.5-2 мс.

Для 200×200 (4× клеток) ожидаем 2-8 мс. При 10 TPS это **20-80% CPU** одного ядра на один матч. Для 5 одновременных матчей нужно ~50% от ядра — норма.

**Лимит размера поля для PvP в MVP — 200×200.** Sandbox остаётся 1000×1000. При попытке начать PvP-матч с большим полем — toast «PvP supports up to 200×200, full-size sandbox available offline».

---

## 4. Сетевой протокол

Берём из `backend-architecture §4`, но **упрощаем**:

### 4.1 Транспорт

- WebSocket (raw, без socket.io)
- **JSON** вместо MessagePack — упрощает дебаг, разница в трафике на MVP-масштабах ничтожна
- TLS в продакшене (`wss://`), без TLS в dev (`ws://localhost:8080`)

### 4.2 Сообщения (минимум для MVP — 10 типов)

```typescript
type ClientMessage =
  | { type: 'join_room';    roomCode: string; nickname: string; locale: string }
  | { type: 'leave_room';   }
  | { type: 'set_ready';    ready: boolean }
  | { type: 'deploy';       x: number; y: number; tick: number }
  | { type: 'ping';         t: number };

type ServerMessage =
  | { type: 'room_joined';      roomCode: string; clientId: string; players: PlayerInfo[] }
  | { type: 'room_updated';     players: PlayerInfo[] }
  | { type: 'match_starting';   countdownMs: number; config: SandboxConfig; seed: number; matchId: string }
  | { type: 'match_started';    matchId: string; startedAt: number; serverEngineVersion: string }
  | { type: 'match_tick';       tick: number; deploys: DeployAction[]; checksum?: string }
  | { type: 'match_ended';      result: MatchResult; replayUrl: string }
  | { type: 'pong';             t: number; serverT: number }
  | { type: 'error';            code: string; message: string; locale: string };
```

`locale` в join_room — для серверного выбора языка error сообщений. Server возвращает строки на выбранном языке (см §6.7).

### 4.3 Tick rate

10 TPS — как описано в архитектуре. Сервер тикает раз в 100мс и шлёт `match_tick` всем подписанным клиентам.

`match_tick` несёт:
- `tick: number` — порядковый номер
- `deploys: DeployAction[]` — все deploy events случившиеся в этом тике
- `checksum: string` (опционально) — раз в секунду (каждый 10-й тик) для desync detection

**Что НЕ шлём:** полный state field (W×H bytes). Клиент **сам симулирует** через client-side prediction на том же engine.

### 4.4 Client-side prediction

Как описано в backend-architecture §5.2:

1. Игрок кликает deploy → клиент **сразу** применяет действие (предсказание)
2. Клиент шлёт `deploy` сообщение на сервер с локальным `tick`
3. Сервер получает, валидирует (через `canDeploy` из Stage 6), ставит в очередь к next tick
4. Сервер шлёт `match_tick` со всеми deploys → клиент сравнивает с предсказанием
5. **Если совпадает** — нет визуальных глитчей
6. **Если расхождение** — клиент откатывается к серверному state и плавно интерполирует

Это **переиспользует** detrandomization работу 7 этапов. Без него предикция была бы невозможна.

### 4.5 Engine version compatibility

В `match_started` сервер шлёт `serverEngineVersion`. Клиент сравнивает с своим. Если major разные → toast warning + reject match. Если minor — continue с warning.

Версия engine — semver в `@langton/core/package.json`.

---

## 5. Frontend — обновления MatchScreen

### 5.1 MatchScreen становится реальным

Сейчас это placeholder. После Stage 8 — полноценный screen с 6 фазами:

```typescript
type MatchPhase =
  | 'connecting'   // подключаемся к WebSocket
  | 'lobby'        // ждём другого игрока, обмениваемся ready
  | 'countdown'    // 3-2-1
  | 'playing'      // активный матч
  | 'finished'     // match_ended получен
  | 'error';       // ошибка соединения
```

### 5.2 Маршрутизация

URL `/?room=abc123` или `/match?room=abc123` — Router читает `roomCode` из URL и переключает экран на `MatchScreen` с этим параметром.

Если URL без `room` — генерируем случайный код, переходим на тот же URL с ним, копируем в clipboard.

### 5.3 UI для каждой фазы

- **connecting:** spinner + "Connecting to server..." (i18n)
- **lobby:** список игроков (1-2), их ready-статусы, кнопка Ready, share URL, share QR
- **countdown:** большая цифра 3 → 2 → 1 → GO!
- **playing:** **переиспользуем существующий** `LangtonField` + `TransportBar` (но Deploy всегда активен, нет step back, нет pause)
- **finished:** `MatchBanner` из Stage 5 + кнопка "Download replay" + "Play again"

### 5.4 Что отключаем в PvP режиме

- Edit mode — нет, конфиг приходит от сервера
- Step back — нет, симуляция продолжается
- Pause — нет, real-time
- Speed control — нет, fixed 10 TPS
- Множественные муравьи в spawn — стартуют как в config'е от сервера

### 5.5 i18n — все новые strings на 10 локалях

Frontend уже имеет 10 локалей в `i18n/translations.ts`. Все новые strings из MatchScreen (примерно 30 строк) добавляются на all 10 locales перед закрытием Stage 8.

Серверные error messages с поля `locale` тоже на 10 локалях (в `mvp-server/src/i18n.ts`).

### 5.6 Что не меняем

**Весь движок** (`@langton/core`) **остаётся идентичным**. Это и есть весь смысл архитектуры — server и client используют **тот же** код.

---

## 6. Алгоритмы и поведение

### 6.1 Создание матча

```
1. Player A открывает /match?room=abc
2. Connects via WS, шлёт {type: 'join_room', roomCode: 'abc', nickname: 'BraveAnt-42', locale: 'en'}
3. Server создаёт Room('abc'), добавляет A как player 0
4. Server отвечает {type: 'room_joined', clientId, players: [...A...]}

5. Player B открывает тот же URL
6. join_room → Server добавляет B как player 1
7. Server шлёт {type: 'room_updated', players: [...A, ...B]} обоим

8. Оба нажимают Ready → set_ready true
9. Когда оба ready=true → Server шлёт {type: 'match_starting', countdownMs: 3000, config, seed, matchId}
10. Клиенты показывают countdown
11. Через 3 сек → Server шлёт {type: 'match_started', matchId, startedAt, serverEngineVersion}
12. Server начинает tick loop
```

### 6.2 Deploy flow

```
Player A кликает deploy at (5, 5):
1. Client A применяет deploy локально (predict)
2. Client A шлёт {type: 'deploy', x:5, y:5, tick: 42}
3. Server получает, валидирует через canDeploy →
   - Если invalid: {type: 'error', code: 'INVALID_DEPLOY', message, locale}
   - Если valid: ставит в очередь к следующему server tick
4. На server tick 43: server включает deploy в match_tick для тика 43
5. Server шлёт match_tick всем клиентам
6. Client A получает match_tick с своим deploy → проверяет совпадение → ок
7. Client B получает match_tick → применяет deploy от A
```

### 6.3 Win condition

Уже есть в `computeMatchResult.ts` из Stage 5. Server использует **ту же** функцию (из `@langton/core`).

Когда `match.finished === true` → server:
1. Шлёт `match_ended` с результатом
2. Сохраняет replay в `data/replays/<matchId>.json`
3. Отправляет URL replay (`http://localhost:8080/api/replays/<matchId>.json`)
4. Закрывает room через 30 секунд

### 6.4 Disconnect

Если клиент отключился во время матча:
- В MVP: матч **немедленно заканчивается**, оставшийся игрок побеждает (reason: "opponent disconnected")
- В Stage 9+: добавим reconnect window 30 секунд

### 6.5 Ping / RTT

Раз в 5 секунд клиент шлёт `ping`, сервер отвечает `pong`. Клиент вычисляет RTT и показывает в углу экрана:
- < 50мс — зелёный
- 50-200мс — жёлтый
- > 200мс — красный

Это **только индикатор** в MVP. Никакой lag compensation.

### 6.6 Field size limit

При попытке начать PvP-матч с конфигом > 200×200:
- Server отвечает `error: FIELD_TOO_LARGE_FOR_PVP`
- Клиент показывает toast (на выбранном locale)
- Клиент остаётся в lobby
- Match не стартует

В дефолтном MVP-конфиге поле 60×60 — внутри лимита.

### 6.7 i18n серверных messages

`mvp-server/src/i18n.ts`:
```typescript
const messages = {
  en: { ROOM_FULL: 'Room is full', INVALID_DEPLOY: 'Cannot deploy here', /* ... */ },
  ru: { ROOM_FULL: 'Комната переполнена', INVALID_DEPLOY: 'Сюда нельзя выпустить', /* ... */ },
  // ... 10 locales
};

export function t(locale: string, code: string): string {
  return messages[locale]?.[code] ?? messages.en[code] ?? code;
}
```

10 кодов × 10 локалей = 100 строк перевода. Тимлид (или members кто знает языки) поможет с переводом.

---

## 7. Edge cases

| Случай | Реакция |
|---|---|
| Player A заходит, ждёт. Player B не приходит 5 минут | Server закрывает room, A получает `error: room_timeout`, идёт в menu |
| Server рестарт во время матча | Все матчи теряются (MVP). Игроки получают disconnect. |
| Player пытается зайти в полную room (уже 2 игрока) | `error: ROOM_FULL` |
| Player A посылает deploy с `tick` который уже прошёл | Server игнорирует, отвечает `error: INPUT_TOO_OLD` |
| Sync drift: client predicted X, server says Y | Client делает re-sync через полный snapshot (раз в 10 тиков шлём checksum) |
| Один клиент шлёт 1000 deploys/сек (abuse) | Rate limit 5 deploys/сек на клиента, лишние игнорируются |
| Browser tab background → throttling JS таймеров | Client продолжает получать ticks от сервера, рендерит как может |
| Engine version mismatch | `error: ENGINE_VERSION_MISMATCH`, match не стартует |
| PvP конфиг > 200×200 | `error: FIELD_TOO_LARGE_FOR_PVP`, остаёмся в lobby |

---

## 8. План работ по дням (≈ 20 дней)

### Week 1: Backend foundation (Дни 1-5)

**День 1:** **Engine refactor → @langton/core workspace.**
- В корне репо: `pnpm-workspace.yaml` + root `package.json`
- Создаём `@langton/core` пакет (новая локация — обсудить с тимлидом)
- Frontend импортирует engine из `@langton/core` (path alias меняется)
- Backend `core/src/langton/*` копия — удаляем
- **Все 138 frontend tests должны пройти после рефакторинга** — это acceptance criteria Дня 1

**День 2:** mvp-server boilerplate. `WebSocketServer` listener на 8080, connection tracking, message routing. `i18n.ts` со скелетом 10 локалей и базовыми кодами.

**День 3:** Room logic. `join_room`, `leave_room`, `set_ready`, broadcast `room_updated`. Random animal nickname generator. **5+ unit-тестов**.

**День 4:** Match lifecycle. `match_starting` → `match_started` → tick loop → `match_ended`. Без deploys пока. **5+ tests**.

**День 5:** Deploy handling. Validation (через `canDeploy` из `@langton/core`), queueing, inclusion в `match_tick`. Field size check (200×200 cap). **5+ tests**.

### Week 2: Frontend integration (Дни 6-10)

**День 6:** WebSocket client lib. `WSClient` класс с connect/send/onMessage + auto-reconnect skeleton. Tests с mock server.

**День 7:** `MatchScreen` UI — connecting / lobby фазы. WS connection. Player list, ready toggle, share URL/QR.

**День 8:** Countdown phase + match_started transition. `MatchScreen` рендерит LangtonField (переиспользование из sandbox!). Engine инициализируется с server-provided seed.

**День 9:** Deploy click → send to server. Receive `match_tick` → re-apply deploys в локальный engine.

**День 10:** Client-side prediction. Локально применяем deploy сразу, на recv `match_tick` сравниваем. Reconciliation: при расхождении откат + replay буфера.

### Week 3: Stability & replay (Дни 11-15)

**День 11:** Match end flow. `match_ended` → `MatchBanner` (переиспользование из Stage 5). Download replay button. **i18n всех strings**.

**День 12:** Server saves replay JSON в `data/replays/`. HTTP endpoint `GET /api/replays/<id>.json` (через тот же mvp-server, на HTTP upgrade). **5+ tests**.

**День 13:** Disconnect handling. Server detects, шлёт `match_ended` с winner = другой игрок. **5+ tests**.

**День 14:** Ping/RTT indicator в UI. Корнер экрана: `RTT: 42ms` цветом по threshold.

**День 15:** Desync detection. Каждый 10-й tick server шлёт checksum (hash state). Client сверяет. Если расходимся — force re-sync через полный snapshot.

### Week 4: Polish + локальный demo (Дни 16-20)

**День 16:** Error handling в UI. Все `error` сообщения → user-friendly toast на правильном locale.

**День 17:** Rate limiting на сервере. 5 deploys/сек на клиента.

**День 18:** README в `mvp-server/` с инструкциями локального запуска. Финальный E2E smoke — два **реальных** браузера, реальный матч до конца.

**День 19:** **Bit-deterministic verification.** Скрипт `scripts/verify-pvp-determinism.mjs` — запускает 20 фейковых клиентов через mock WS, делает 1000 ticks с известным timeline of deploys, сравнивает финальные state hashes между server и всеми клиентами. **Все 21 hashes должны быть identical.** Это **главный тест гипотезы проекта**.

**День 20:** DEVLOG Дни 57-76 (точные номера зависят от текущей нумерации в репо). 16 критериев приёмки Stage 8. Финальный пакет `langton-arena-stage8-mvp.zip`.

---

## 9. Критерии приёмки (16 пунктов)

- [ ] **Day 1 acceptance:** все 138 frontend tests pass после engine refactor
- [ ] mvp-server поднимается через `pnpm dev` локально
- [ ] Open URL → connects → "Lobby" с никнеймом (random animal)
- [ ] Open 2-й tab → matchmaking auto в тот же room
- [ ] Оба видят друг друга в lobby с правильными nicknames
- [ ] Set Ready → второй игрок видит обновление < 100мс
- [ ] Оба Ready → countdown → match start
- [ ] Engine инициализируется с **server-provided** seed (не локальный)
- [ ] Deploy click → синхронизируется в другом браузере < 200мс
- [ ] **Главный тест:** state field hash после 100 тиков совпадает у server и обоих клиентов
- [ ] Win condition срабатывает синхронно у обоих
- [ ] Match ended banner показывается одновременно
- [ ] Download replay работает, файл валиден через `parseJsonFile` Stage 7
- [ ] Disconnect одного → match ends, другой побеждает
- [ ] Ping indicator показывает RTT с цветом по threshold
- [ ] Tests: 30+ backend + 138 frontend = 168+, all pass
- [ ] i18n: все error messages работают на 10 локалях
- [ ] PvP > 200×200 → error, sandbox без ограничений
- [ ] **Bit-deterministic verification script** runs clean

(превышение лимита 16 пунктов — приёмка стала более строгой после v8.1)

---

## 10. Архитектурные решения для книги

1. **Engine как shared workspace package** — после v8.1 `@langton/core` живёт **отдельно** от frontend и backend. Это **единственный** способ гарантировать что детерминизм работает в сети. «Зеркало копий» — антипаттерн, рано или поздно расходится.

2. **MVP в новом сервисе `mvp-server/`, не в существующих 5.** Это сохраняет архитектурную чистоту: «MVP что работает» отдельно от «архитектура когда-нибудь». После Stage 10 mvp-server удаляется, его логика переезжает в ws-gateway+game-worker.

3. **PvP лимит 200×200 vs sandbox 1000×1000.** Это **компромисс производительности**. PvP требует server-side simulation в реальном времени, что добавляет ограничение которого нет в офлайн-режиме. Это **нормально** — multiplayer всегда более ограничен чем single-player.

4. **JSON вместо MessagePack в MVP.** Production-архитектура говорит "MessagePack для эффективности", но в MVP мы не знаем работает ли вообще. Сначала запустить, потом оптимизировать. MessagePack — Stage 11.

5. **Локальный deploy вместо staging.** Билинг закрыт → деплой невозможен. Это не блокер для доказательства гипотезы — два браузера на одной машине достаточно. Public deploy — когда откроется билинг.

6. **i18n с Дня 1.** Frontend уже на 10 локалях. Если backend error messages только на английском — UX рассинхронизирован. 100 строк перевода — дёшево с самого начала, дорого внедрять потом.

7. **Bit-deterministic verification как acceptance test.** Это **проверка гипотезы** проекта. Если падает — мы знаем что детерминизм ломается в сети, и сразу видим где. Это **встроенный self-check** для всех будущих изменений.

---

## 11. Что после Stage 8

**Stage 9 — Persistence & Auth (1-2 недели):**
- Postgres schema + миграции
- Anonymous → registered users (JWT)
- Match history в БД
- Replays в Postgres вместо JSON files
- Использовать существующий `api-gateway/` каркас

**Stage 10 — Matchmaker + миграция в проектную архитектуру (1-2 недели):**
- Queue API
- Naive round-robin matching
- **Миграция логики mvp-server → ws-gateway + game-worker**
- Удаление mvp-server папки
- Stage 8 закрылся доказательством гипотезы; Stage 10 переносит код в правильную архитектуру

**Stage 11 — Production hardening (2-3 недели):**
- MessagePack
- Redis для cross-service state
- Reconnect logic
- ELO с expanding window (из существующего matchmaker design)

**Stage 12 — Public release (1 неделя):**
- Load testing
- Multi-region (опционально)
- Public announcement
- **Требует:** билинг разблокирован

Это **3-4 месяца** работы до полноценного публичного PvP. **20 дней** — для MVP.

---

## 12. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Client-side prediction приводит к visible desync | High | High | Раз в секунду checksum для re-sync. Lerp интерполяция при mismatch. |
| Network jitter ломает 10 TPS | Medium | Medium | Tick rate adaptive — если RTT > 200мс, переходим на 5 TPS |
| Engine refactor (День 1) ломает frontend | High | Critical | Все 138 tests как acceptance criteria; rollback готов |
| pnpm workspace ломает существующий build | Medium | Low | Сначала локально, frontend tests pass без изменений |
| Engine изменился между client и server (out of sync) | Medium | Critical | Engine version в `match_started`, клиент проверяет |
| Билинг разблокируется неожиданно во время Stage 8 | Low | Low | Локальный план не зависит от cloud, billing — для Stage 12 |
| Игроки не понимают что нужен второй tab | Low | Medium | Lobby UI показывает QR code + копируемый URL |

---

## 13. Зависимости и допущения

**Зависим от:**
- Существующий движок в `langton-arena-web/src/core/langton/`
- `canDeploy` из Stage 6, `computeMatchResult` из Stage 5
- pnpm 8+, Node.js 20+
- Frontend i18n infrastructure готова и работает

**Допускаем:**
- Engine refactor (День 1) пройдёт без deep архитектурных изменений
- Backend `core/` копия может быть удалена (она правда полная копия?)
- Команда найдёт переводчиков для 100 строк × 10 локалей

**НЕ зависим от:**
- Postgres / Redis / ClickHouse setup
- Cloud hosting / billing
- DNS / TLS certificates
- Существующих 5 backend сервисов

---

## 14. Open questions для тимлида

### Q1: Engine workspace location

Где будет жить `@langton/core` после рефакторинга?
- **A.** В корне репо: `Langton_Ants_PVP/packages/core/`
- **B.** Внутри backend: `langton-arena-backend/core/` (переименование существующей зеркальной копии)
- **C.** В frontend: `langton-arena-web/src/core/` (никуда не двигаем, просто backend импортирует через workspace)

Голосую за **C** — минимум перемещений, frontend tests не ломаются, backend получает доступ через workspace symlink. Engine остаётся "родом из frontend" что соответствует истории проекта.

> **HANDOVER UPDATE (Web Claude после анализа snapshot):** пересмотрел в пользу **B** —
> backend уже создал `@langton/core` package с правильным name, "зеркальная копия" —
> половина работы уже сделана. Single source of truth = engine физически в backend.
> Frontend становится pure client. **Требует подтверждения тимлида.**

### Q2: Начальный конфиг матча

В MVP игроки **не выбирают** пресет — сервер даёт фиксированный. Какой?
- **A.** Простой default — поле 60×60, 2 игрока с 3 муравьями каждый, halo mutation enabled, time win condition 300 тиков
- **B.** Случайный из существующих 27 пресетов (адаптирован для 2 игроков)
- **C.** Host игрок выбирает в lobby из dropdown

Голосую за **A** — минимум variables для отладки prediction.

### Q3: Никнейм формат

- **A.** Random animal: `BraveAnt-42`, `SilentFox-91`
- **B.** Just `Player-<short_uuid>`
- **C.** User вводит при подключении

Голосую за **A** — дружелюбно, легко идентифицировать в логах.

### Q4: Что показывает Player A после disconnect Player B?

- **A.** Сразу finished с winner=A
- **B.** 30-секундный таймер "Opponent disconnected, waiting for reconnect..."

Голосую за **A** — MVP simplicity. Reconnect — Stage 9.

### Q5: Локальные переводчики

Server error messages × 10 локалей = ~100 строк. Кто переводит?
- **A.** Я (Claude) пишу все, тимлид/команда корректирует ru/uk на правильность
- **B.** Только en+ru на день 11, остальные локали в follow-up PR
- **C.** Использовать тот же translations.ts что frontend (если есть подходящие ключи)

Голосую за **A** — у меня есть базовое знание всех языков для черновика.

### Q6: Backend tests baseline

Подтверди — в `langton-arena-backend/services/*/` действительно нет тестов сейчас?
- **A.** Подтверждаю — нет тестов в backend
- **B.** Есть тесты в `backend/tests/integration/` (общие)
- **C.** Есть тесты в каких-то конкретных сервисах

Если **B/C** — изменится план backend testing в Дне 5/13/19.

---

## 15. Резюме

**4 недели работы. 19 критериев приёмки. Главное доказательство: детерминизм работает в сети.**

После Stage 8 у нас есть **запускаемый MVP PvP** на `localhost`. Не feature-complete, не задеплоен — но реально работающий между двумя браузерами. На нём можно строить Stage 9-12 как **итерации**, не как rebuilds.

Главные риски — рефакторинг engine в Дне 1 и client-side prediction в Дне 10. Все остальное относительно линейно.

Жду ответы на Q1-Q6 + общее «ок» прежде чем начинать.

---

## 16. Changelog v8.0 → v8.1

| Что | v8.0 | v8.1 | Почему |
|---|---|---|---|
| Backend service | Combined ws-server | **mvp-server** в `services/` | Сохранение архитектурной чистоты |
| Engine sharing | pnpm workspace в общем | **Конкретный план**: refactor в Дне 1, acceptance = 138 frontend tests pass | Реальное состояние выяснилось |
| Deploy target | Fly.io staging | **localhost** (билинг закрыт) | Информация от тимлида |
| Field size | Не ограничено | **PvP cap 200×200** | Frontend ушёл до 1000×1000, server не вытянет |
| i18n | Не упоминалось | **10 локалей для всех new strings** | Frontend уже 10 локалей |
| Tests baseline | 30+ backend | 30+ backend (вероятно с 0) + acceptance: все 138 frontend pass | Подтверждение от тимлида |
| Бit-deterministic test | Один пункт критериев | **Отдельный День 19 — verify script** | Главный self-check проекта |
| Open questions | Q1-Q5 | **Q1-Q6** + другие варианты ответов | Учёт реальности |
