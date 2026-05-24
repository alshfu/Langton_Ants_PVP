# @langton/core

**Общий игровой код, импортируется и фронтендом, и каждым бэкенд-сервисом.**

Это **самый критичный** пакет в репозитории. Любое расхождение между тем,
как код работает на клиенте и на сервере, ломает client-side prediction
и приводит к видимым визуальным глитчам.

## Что внутри

```
core/
└── src/
    ├── langton/         Сим-движок Лэнгтона
    │   ├── engine.ts    stepLangton() — один тик симуляции
    │   ├── state.ts     makeLangtonState(), типы Sim
    │   ├── rules.ts     LA_RULES, LA_DIRS, helpers
    │   ├── birth.ts     Логика рождения/гибридов/диких
    │   └── prng.ts      mulberry32 (seeded PRNG)
    │
    ├── protocol/        WebSocket-протокол
    │   ├── messages.ts  Типы всех сообщений (см. backend §4.3)
    │   ├── schema.ts    JSON schemas для валидации входящих
    │   └── codec.ts     MessagePack encode/decode
    │
    ├── contract/        Контракт интерфейса (см. interface-contract.md §3-5)
    │   ├── state.ts     AppState и все sub-states
    │   ├── actions.ts   Список actions с сигнатурами
    │   └── events.ts    GameEvent (логика → UI уведомления)
    │
    └── shared/          Общие константы и форматтеры
        ├── constants.ts PLAYER_PALETTE, RULES_REGISTRY, RANK_TIERS
        └── formatting.ts форматирование времени, %, чисел
```

## Принципы

### 1. Детерминизм — критичный инвариант

Симуляция должна быть **бит-в-бит воспроизводимой**:
- Один и тот же seed + те же inputs → тот же результат
- НИКОГДА не использовать `Math.random()` в игровой логике
- НИКОГДА не использовать `Date.now()` внутри тика (один timestamp на тик передаётся снаружи)
- Итерации `Set` / `Map` без сортировки — запрещены
- Floating-point арифметика — только когда другого варианта нет, и тогда документировать

ESLint правило `no-restricted-globals` ловит `Math.random` и `Date.now` в этой папке.

### 2. Нет зависимостей от Node-only и Browser-only API

`core/` должен компилироваться и работать одинаково:
- В Node.js на сервере
- В браузере на клиенте

Запрещено: `fs`, `child_process`, `process.env`, `window`, `document`, `localStorage`.

### 3. Контракт > legacy

Все типы в `contract/` соответствуют `docs/interface-contract.md §3-5`
буква-в-букву. Любое изменение типов = bump версии контракта = согласование
с фронтенд-командой.

## Использование

### Бэкенд (Node.js)

```typescript
import { stepLangton, makeLangtonState } from '@core/langton/engine';
import { encodeMessage, decodeMessage } from '@core/protocol/codec';
import type { MatchState } from '@core/contract/state';

const sim = makeLangtonState({ w: 100, h: 100, ants: [...] });
const events = stepLangton(sim);
```

### Фронтенд (браузер)

```typescript
// Тот же импорт, тот же код.
import { stepLangton } from '@langton/core/langton/engine';
```

## Тесты

См. `tests/unit/core/`. Особое внимание:
- `engine.test.ts` — детерминизм, edge cases, HP logic, birth
- `prng.test.ts` — статистическая равномерность mulberry32
- `codec.test.ts` — round-trip MessagePack для каждого типа сообщений
- `schema.test.ts` — JSON-schema валидация на образцах payload'ов

## Версионирование

Семантическая версия в `package.json`. **MAJOR bump** при любом изменении:
- Структуры `MatchState` или его sub-полей
- Поведения `stepLangton` (даже фикс бага считается breaking change для replays!)
- Сигнатур actions или events

После MAJOR bump старые replays могут перестать воспроизводиться корректно.
Если это произошло — сохраняем `server_version` в `.lreplay` файле и при
загрузке проверяем совместимость.
