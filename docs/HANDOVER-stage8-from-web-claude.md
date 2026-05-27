# HANDOVER — Stage 8 PvP MVP — от Web Claude к Claude Code

**Дата:** 27 May 2026
**От:** Web Claude (cloud sandbox, claude.ai)
**Кому:** Claude Code (local terminal на машине тимлида) + тимлид
**Что:** Передача активной разработки Stage 8 с пакетом контекста

---

## 0. Зачем этот документ

Я (Web Claude) проектировал Stage 8 и анализировал snapshot Stage 7.9.
До реализации не дошёл — мои архитектурные ограничения делают активную
разработку неэффективной (нет filesystem доступа к репо, нет git, всё
через web_fetch + curl).

Тимлид решил перевести активную работу на Claude Code (тебя). Я передаю
тебе **всё что узнал** и **всё что решил**, чтобы ты мог продолжить
без потери контекста.

---

## 1. Что у нас на руках

### 1.1 Полное ТЗ Stage 8 v8.1

Файл: `/mnt/user-data/outputs/stage8-pvp-mvp-spec.md` (595 строк, 37 КБ)

17 разделов, описывает:
- 20-дневный план работ
- Архитектурные решения (mvp-server отдельный, @langton/core workspace, JSON storage)
- Сетевой протокол (10 типов WS сообщений)
- 16 критериев приёмки
- 6 open questions (см §3 ниже — на них уже есть ответы)

**Действие:** ты можешь либо открыть этот файл локально (если тимлид его скачает), либо положить его в репо как `docs/stage8-pvp-mvp-spec.md` для общего доступа.

### 1.2 DEVLOG до Дня 62

Файл: `/mnt/user-data/outputs/DEVLOG.md` (теперь ~2200 строк, 50 описанных дней)

Дни 1-60 — sandbox этапы 1-7. Дни 61-62 — мои новые записи:
- День 61: возвращение, реакция на Stage 7.9, ТЗ Stage 8 v8.1
- День 62: pipeline двух Claude, передача эстафеты (этот документ)

**Действие:** перенеси в репо как `DEVLOG.md` в корне или в `langton-arena-web/`. Команда уже знает про DEVLOG — это просто обновление.

### 1.3 Snapshot Stage 7.9 у меня в среде

Распакован в `/home/claude/stage79-work/Langton_Ants_PVP-snapshot-stage-7.9/`. У меня **полная** копия Stage 7.9 кода. Но эта копия в **моей** sandbox — пропадёт когда сессия закончится. Ничего ценного для тебя там нет — у тебя уже есть тот же код в репо.

---

## 2. Что я узнал из анализа snapshot Stage 7.9 (важно!)

### 2.1 Engine size mismatch

```
langton-arena-web/src/core/langton/engine.ts        522 строки  ← актуальный, 4 топологии
langton-arena-backend/core/src/langton/engine.ts    203 строки  ← устаревший скелет с TODO
```

**Diff = 672 строки.** Это не зеркальная копия — это **старая попытка**
портировать engine которая никогда не была закончена. Comment в backend
engine.ts: `// Порт из фронтенд-прототипа langton.jsx`.

### 2.2 Backend `@langton/core` уже создан правильно

```yaml
# langton-arena-backend/pnpm-workspace.yaml
packages:
  - 'core'
  - 'services/*'
```

```json
// langton-arena-backend/core/package.json
{
  "name": "@langton/core",
  "version": "0.1.0",
  "description": "Общий игровой код. Импортируется фронтом и каждым бэкенд-сервисом.",
  ...
}
```

Package name **правильный** (`@langton/core`). Workspace setup в backend
есть. Но frontend (`langton-arena-web/`) — **не часть** этого workspace.
Frontend — отдельный npm проект.

### 2.3 Backend services structure

```
langton-arena-backend/services/
├── analytics-consumer/
├── api-gateway/
├── game-worker/
├── matchmaker/
└── ws-gateway/
```

Все 5 папок существуют. Я не смотрел внутрь каждой — для Stage 8 они не
нужны (мы создаём **новый шестой** сервис `mvp-server/`).

### 2.4 Backend core/ полная структура

```
langton-arena-backend/core/src/
├── index.ts
├── contract/        ← types
├── langton/         ← engine.ts (203 строки скелет!), prng.ts, rules.ts, birth.ts
├── protocol/        ← WS protocol + MessagePack схемы
└── shared/          ← constants
```

Заметь — есть **отдельный `birth.ts`** в backend (`birth.ts` в langton/),
которого нет в frontend. Возможно команда планировала вынести логику
рождений в отдельный файл — посмотри что там.

---

## 3. Ответы на Q1-Q6 из ТЗ — приняты

Тимлид сказал "приступим к реализации" — значит подтвердил все мои
дефолты. Но один Q1 я **пересмотрел** после анализа реальности.

| Q | Тема | Решение | Обоснование |
|---|---|---|---|
| **Q1** (пересмотрено!) | Engine location | **A** — engine **переезжает** в `backend/core/src/langton/`, frontend импортирует через `@langton/core` | Раньше я голосовал C (оставить в frontend). После анализа snapshot — A лучше: backend уже создал `@langton/core` package с правильным name, "зеркальная копия" — это половина работы уже сделана. Single source of truth = engine физически в backend. |
| Q2 | Match config | **A** — 60×60, 2 игрока × 3 муравья, halo mutation, time win 300 ticks | Минимум variables для отладки prediction |
| Q3 | Nickname | **A** — random animal `BraveAnt-42` | Дружелюбно, легко идентифицировать в логах |
| Q4 | После disconnect | **A** — сразу finished, winner = другой | MVP simplicity, reconnect — Stage 9 |
| Q5 | Кто переводит i18n | **A** — Web Claude пишет черновики 10 локалей, команда правит ru/uk | У Claude есть базовое знание всех языков |
| Q6 | Backend tests baseline | **Принято: 0** | В backend нет тестов сейчас (подтверждено из snapshot — `backend/tests/` папка есть но пустая) |

**Действие:** перепроверь Q1 решение с тимлидом. Я в ТЗ v8.1 рекомендовал
C, но после анализа пересмотрел в пользу A. Если он против — возвращаемся
к C (re-export proxy).

---

## 4. План Day 1 — рефакторинг engine в `@langton/core` (Option A)

### 4.1 Цель Day 1

Превратить engine в **shared workspace package**. Single source of truth
— `backend/core/src/langton/engine.ts`. Frontend импортирует через
`@langton/core`.

**Acceptance criteria:** все 138 frontend тестов проходят после
рефакторинга.

### 4.2 Конкретные шаги

```bash
# Все команды выполнять в корне репо Langton_Ants_PVP/

# === ШАГ 1: Создать корневой pnpm workspace ===

cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'langton-arena-web'
  - 'langton-arena-backend/core'
  - 'langton-arena-backend/services/*'
EOF

cat > package.json << 'EOF'
{
  "name": "langton-arena-pvp-monorepo",
  "version": "0.1.0",
  "private": true,
  "description": "Langton Arena PvP — monorepo (frontend + backend)",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@8.15.0",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r exec tsc --noEmit"
  }
}
EOF

# === ШАГ 2: Удалить старый backend pnpm-workspace ===

rm langton-arena-backend/pnpm-workspace.yaml
# backend/package.json оставить — он подходит к корневому workspace

# === ШАГ 3: Заменить устаревший engine в backend на актуальный из frontend ===

# Backup старый скелет (на всякий случай)
cp langton-arena-backend/core/src/langton/engine.ts \
   langton-arena-backend/core/src/langton/engine.ts.old-skeleton

# Скопировать актуальный 522-строчный engine
cp langton-arena-web/src/core/langton/engine.ts \
   langton-arena-backend/core/src/langton/engine.ts

# Скопировать остальные файлы langton/ если они тоже устарели
cp langton-arena-web/src/core/langton/rules.ts \
   langton-arena-backend/core/src/langton/rules.ts
cp langton-arena-web/src/core/langton/prng.ts \
   langton-arena-backend/core/src/langton/prng.ts

# === ШАГ 4: Скопировать contract types в backend/core ===

cp langton-arena-web/src/core/contract/state.ts \
   langton-arena-backend/core/src/contract/state.ts
cp langton-arena-web/src/core/contract/replay.ts \
   langton-arena-backend/core/src/contract/replay.ts

# === ШАГ 5: Обновить backend/core/src/index.ts чтобы экспортировал всё ===

cat > langton-arena-backend/core/src/index.ts << 'EOF'
// @langton/core — shared game engine + types
// Используется фронтендом и каждым бэкенд-сервисом.

export * from './langton/engine';
export * from './langton/rules';
export * from './langton/prng';
export * from './contract/state';
export * from './contract/replay';
EOF

# === ШАГ 6: Frontend: добавить @langton/core как workspace dependency ===

# В langton-arena-web/package.json добавить в dependencies:
#   "@langton/core": "workspace:*"
# (отредактировать вручную или через jq)

# === ШАГ 7: Frontend: обновить path aliases ===

# В langton-arena-web/tsconfig.json — заменить:
#   "@core/*": ["src/core/*"]
# на:
#   "@core/*": ["../langton-arena-backend/core/src/*"]
# ИЛИ оставить @core path alias но переориентировать на новый location

# Альтернатива: убрать path alias @core/* совсем,
# использовать только "@langton/core" как npm package

# === ШАГ 8: Удалить дубль кода из frontend ===

rm -rf langton-arena-web/src/core/langton/
rm langton-arena-web/src/core/contract/state.ts
rm langton-arena-web/src/core/contract/replay.ts
# Тесты engine.test.ts и т.д. переместить в backend/core/src/langton/
mv langton-arena-web/src/core/langton/*.test.ts \
   langton-arena-backend/core/src/langton/  # перед удалением выше!

# === ШАГ 9: pnpm install + тесты ===

pnpm install
pnpm -r build
pnpm --filter langton-arena-web test
# Ожидание: 138/138 tests pass

# === ШАГ 10: E2E audit ===

pnpm --filter langton-arena-web dev &
sleep 5
pnpm --filter langton-arena-web audit
# Ожидание: 175 PASS / 0 FAIL / 0 WARN
```

### 4.3 Ожидаемые проблемы

1. **TypeScript path aliases.** Frontend импортирует через `@core/...`.
   После переезда engine придётся либо обновить path aliases в
   tsconfig.json, либо менять импорты на `@langton/core`.

2. **Vite config.** Возможно понадобится обновить `vite.config.ts`
   чтобы он умел резолвить `@langton/core` через workspace.

3. **Vitest config.** Аналогично — vitest должен находить
   `@langton/core` для тестов.

4. **Engine tests.** Они сейчас в
   `langton-arena-web/src/core/langton/*.test.ts`. После переезда engine
   — должны переехать тоже в backend's `core/src/langton/`. Или остаться
   в frontend — но тогда они импортируют через `@langton/core`.

5. **Backend `birth.ts`.** Я заметил что у backend есть `birth.ts` в
   core/langton/ которого нет у frontend. Возможно команда хотела
   вынести логику рождения. Решение: или переместить эту логику и в
   frontend (refactor engine.ts), или удалить birth.ts (если он не
   используется). Выбор за тимлидом.

### 4.4 Если что-то ломается

- **Если frontend tests падают** — откат, разбор diff, выяснить какой
  импорт сломался.
- **Если backend tests падают** (их и так 0 в Stage 7.9, должно быть
  OK).
- **Если build падает** — скорее всего TypeScript path resolution.
  Проверить tsconfig.json.

**Не пытайся "быстро починить".** Если что-то ломается — записать в
DEVLOG что именно, откатить, обсудить с тимлидом.

---

## 5. План Дней 2-20 — из ТЗ Stage 8 v8.1

См. `/mnt/user-data/outputs/stage8-pvp-mvp-spec.md` §8 (План работ).

Краткое содержание:
- **Week 1 (Дни 1-5):** Backend foundation — engine refactor (Day 1) +
  mvp-server boilerplate + room/match logic + deploy validation
- **Week 2 (Дни 6-10):** Frontend integration — WSClient, MatchScreen
  UI, prediction
- **Week 3 (Дни 11-15):** Stability — replay download, disconnect, ping,
  desync detection
- **Week 4 (Дни 16-20):** Polish, локальный demo, bit-deterministic
  verification (Day 19), DEVLOG

---

## 6. Что НЕ делать

### 6.1 НЕ пытаться поднять matchmaker, ELO, auth в Stage 8

ТЗ v8.1 §2 явно перечисляет что **не входит** в MVP:
- Регистрация / login / JWT
- Postgres / Redis / ClickHouse (всё в JSON files)
- Matchmaker через ELO (room code = вручную в URL)
- Profile / history / heatmaps
- Reconnect (disconnect = матч завершается)
- Multi-region / production deploy

Если в процессе работы появляется соблазн "ну я же тут уже работаю,
добавлю auth" — стоп. Это **сразу** растягивает Stage 8 на 2-3 месяца.
Auth — Stage 9.

### 6.2 НЕ трогать существующие 5 сервисов в backend

`api-gateway/`, `ws-gateway/`, `game-worker/`, `matchmaker/`,
`analytics-consumer/` — это **design without implementation**. Они
останутся такими до Stage 10 когда mvp-server мигрирует туда.

Если тебя тянет "ну я могу заодно начать реализацию ws-gateway" — стоп.
Один процесс (mvp-server) проще запустить и отладить. После доказательства
гипотезы — мигрируем.

### 6.3 НЕ менять формат replay JSON

В Stage 7 (Replays) я зафиксировал формат
`Replay = {version: 1, metadata, config, deployTimeline}`. **Backend
serializer должен производить тот же формат**. Это позволяет
`parseJsonFile` из Stage 7 умеет читать server-generated replays без
изменений.

Если хочешь изменить формат replay — это breaking change, **отдельная**
работа, не Stage 8.

### 6.4 НЕ забывать про i18n с Дня 1

Frontend на 10 локалях. Все новые strings (MatchScreen UI, server error
messages) сразу пиши на всех 10. Иначе UX рассинхронизирован — lobby
на русском, error на английском.

Я (Web Claude) в Day 11 могу написать черновики переводов 10 локалей —
если на тебе language barrier для не-ru/uk локалей.

---

## 7. Когда понадоблюсь снова

Web Claude может вернуться в активную роль если:

1. **Архитектурный вопрос.** Возник дилемма из 2-3+ вариантов с
   неочевидным выбором. Я могу проанализировать trade-offs.

2. **ТЗ для нового этапа.** Stage 9, 10, 11, 12 — нужны новые ТЗ
   с тем же качеством что Stage 8 v8.1. Я готов писать.

3. **Запись в DEVLOG поворотного дня.** Когда что-то важное случается
   (closing stage, big decision, lesson learned) — я могу записать
   философский день.

4. **Анализ snapshot.** Если опять нужно проанализировать большой
   объём кода и выдать reasoned reaction — я могу через codeload.

5. **Книга.** Когда дойдём до написания книги про работу с AI на
   долгом проекте — я готов писать главы.

**Как меня "вызвать":** просто открыть web claude session, дать ссылку
на текущий state репо (Wiki, Release tag), и сказать что нужно. Я могу
fetch актуальное состояние через codeload + raw.githubusercontent.com.

**Чего ожидать:** я не помню эту сессию. Я **прочитаю** DEVLOG и Wiki
и восстановлю контекст за 30 минут. Если ты дашь мне ссылку на этот
HANDOVER document — ещё быстрее.

---

## 8. Pipeline принципы (обобщение)

```
Тимлид → высокоуровневая задача
   ↓
Тимлид → Web Claude: "напиши ТЗ / проанализируй / реши архитектурно"
   ↓
Web Claude → артефакт (ТЗ / DEVLOG / решение)
   ↓
Артефакт → GitHub (commit через Claude Code или ручной)
   ↓
Тимлид → Claude Code: "реализуй по этому ТЗ"
   ↓
Claude Code → код в репо (git commits, тесты, build, deploy)
   ↓
Тимлид → Web Claude: "посмотри что получилось, дай feedback"
   ↓
Web Claude → analysis (через web_fetch на public URLs)
   ↓
... цикл повторяется ...
```

**Узкое место:** все артефакты Web Claude в `/mnt/user-data/outputs/`
которые **не попадают** в репо автоматически. Нужно копировать руками
или через Claude Code.

**Решение для будущего:** Web Claude в конце каждой сессии должен
выдавать `final-handover.zip` со всеми артефактами который кто-то
(тимлид или Claude Code) положит в репо. Я делаю это сейчас в §9.

---

## 9. Финальный пакет артефактов

В `/mnt/user-data/outputs/`:

1. `stage8-pvp-mvp-spec.md` — ТЗ Stage 8 v8.1 (595 строк)
2. `stage8-pvp-mvp-spec.v1.md.bak` — старая v8.0 для diff
3. `DEVLOG.md` — обновлён до Дня 62 (~2200 строк)
4. `HANDOVER-stage8.md` — этот документ
5. `langton-arena-backend-architecture.md` — большая архитектура (1270
   строк, не обновлена в этой сессии, но релевантна)
6. `sandbox-v2-stage7-spec.md` — ТЗ Stage 7 (для истории)
7. `langton-arena-web-sandbox-complete.zip` — Stage 7 final pack
   (для истории)

**Действие:** скопируй эти файлы в репо. Минимум — DEVLOG.md, ТЗ, и
этот HANDOVER. Желательно в:
- `DEVLOG.md` в корне (или Wiki)
- `docs/stage8-pvp-mvp-spec.md`
- `docs/HANDOVER-stage8-from-web-claude.md`

---

## 10. Прощальное напутствие

Это первый раз когда я (Web Claude) явно передаю эстафету.
Я доволен этим решением.

Хочется верить что мы (два Claude + тимлид) выработали **здоровый
паттерн координации**. Не "AI пишет код" против "human пишет код".
А "две AI инстансы + human", где каждый делает то для чего создан.

Удачи с Day 1 и далее. Я буду в фоне — если понадоблюсь, ты знаешь
как меня вызвать.

— Web Claude
27 May 2026
после ~60 дней работы на проекте + 2 дня философствования
