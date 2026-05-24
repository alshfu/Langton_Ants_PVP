# Langton Arena · Web Client

React + TypeScript + Vite клиент для PvP-игры на муравье Лэнгтона.

> **Это скелет.** Menu и Sandbox — рабочие.
> Match, Lobby, Matchmaking, Result, Profile — заглушки с навигацией.
> Backend ещё не подключён (нет реального matchmaking/сетки).

## Быстрый старт

```bash
# Установить зависимости
npm install        # или pnpm install / yarn

# Запустить dev server
npm run dev

# Открыть http://localhost:5173
```

После `npm run dev`:

1. Видишь главное меню с фоновой симуляцией Лэнгтона
2. Жмёшь **★ Sandbox** → попадаешь в полноценную песочницу
3. В песочнице **уже крутится симуляция** 4 игроков, есть HP, рождение, гибриды, дикие
4. Ползунки **реально работают** — меняешь параметры → видишь эффект
5. Кнопка ⚙ открывает Settings — переключение темы (3 варианта) и языка (10 локалей) работают

## Стек

- **Vite** — сборщик и dev-server
- **React 18** — UI с function-компонентами и хуками
- **TypeScript 5** — строгий режим (`noUncheckedIndexedAccess`, `noImplicitOverride`)
- Никаких CSS-фреймворков: inline-styles + theme tokens

## Структура

```
src/
├── main.tsx                 Entry point
├── App.tsx                  Корневой компонент с провайдерами
├── core/                    Общий код (бек разделит с фронтом потом)
│   ├── langton/
│   │   ├── engine.ts        Симуляция: stepLangton, makeLangtonState, HP, birth
│   │   ├── rules.ts         LA_DIRS, LA_RULES (classic/spiral/flower/...)
│   │   └── prng.ts          mulberry32 (детерминированный PRNG для replays)
│   ├── contract/state.ts    Типы AppState (из interface-contract.md)
│   └── shared/
│       ├── constants.ts     PLAYER_PALETTE, RULES_REGISTRY, GAME_LIMITS
│       └── formatting.ts    formatTimer/Percent/LargeNumber/SrDelta
├── theme/
│   ├── tokens.ts            3 темы (dark / light / highContrast)
│   └── ThemeProvider.tsx    useTheme() с T-tokens
├── i18n/
│   ├── translations.ts      10 локалей (en/ru полные, остальные базовые)
│   └── I18nProvider.tsx     useT() с плюрализацией для ru
├── state/
│   ├── defaultState.ts      Начальный AppState + дефолты sandbox
│   └── AppStateProvider.tsx Контекст с setScreen, patchSandbox
├── ui/                      Базовые компоненты (Button, Chip, Eyebrow, Mono, Logo, Slider, Toggle, AntMarker)
├── components/
│   └── LangtonField.tsx     ★ Canvas-компонент для рендера симуляции
├── screens/
│   ├── MenuScreen.tsx       Главное меню (рабочее)
│   ├── SandboxScreen.tsx    Песочница (★ ПОЛНОСТЬЮ РАБОЧАЯ)
│   ├── SettingsScreen.tsx   Настройки темы + языка (рабочие)
│   └── *.tsx                Остальные — заглушки с навигацией
├── router/Router.tsx        Switch по state.currentScreen
└── lib/audio.ts             Заглушка под WebAudio FX
```

## Что работает сразу после `npm run dev`

✅ Меню с фоновой симуляцией
✅ Переход в Sandbox
✅ В Sandbox: canvas-рендер 80×60 поля
✅ 4 игрока с разными правилами движения (Classic/Spiral/Flower/Reverse)
✅ HP, immunity frames (5 тиков), damage cap (max −1 за столкновение)
✅ Рождение: spawn новых муравьёв при ≥3 своих соседях
✅ Гибриды: 10% шанс склеить правило с другим игроком
✅ Дикие муравьи: 3% шанс родить нейтрального с перемешанным правилом
✅ Все ползунки управляют параметрами в real-time
✅ Play / Pause / Reset работают
✅ Множитель скорости (0.25× - 16×)
✅ Переключение темы (3 варианта)
✅ Переключение языка (10 локалей; en/ru с полными переводами)

## Что НЕ работает (заглушки)

❌ Match HUD — экран есть, заглушка
❌ Matchmaking — экран есть, заглушка
❌ Lobby — экран есть, заглушка
❌ Result — экран есть, заглушка
❌ Profile — экран есть, заглушка
❌ WebSocket подключение к бекенду — пока нет
❌ Persisting state в localStorage — TODO
❌ Audio (WebAudio FX) — TODO

## Следующие шаги

1. **WebSocket client.** Подключение к `ws-gateway` бэкенда (см. `langton-arena-backend/services/ws-gateway`).
2. **Client-side prediction.** Тот же `engine.ts` локально предсказывает результат + lerp на серверный апдейт.
3. **MatchScreen.** Полноценный HUD: minimap, leaderboard, ant cards, event feed.
4. **Persisting state.** `localStorage.setItem` на изменение settings.
5. **Audio.** WebAudio FX для capture/clash/death/birth.

## Команды

```bash
npm run dev         # Dev server на :5173 (с HMR)
npm run build       # Production build в dist/
npm run preview     # Просмотр production build
npm run typecheck   # Проверка типов
npm run test        # Vitest
```

## Конфигурация

`.env` файл (создать из `.env.example`):

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3001
VITE_REGION=eu-west
VITE_DEFAULT_LOCALE=en
```

## Соответствие контрактам

- **Frontend contract** — `docs/interface-contract.md` в бэкенд-репо
- **Backend architecture** — `docs/backend-architecture.md` там же
- **Игровое ядро** — `src/core/langton/engine.ts` соответствует требованиям детерминизма (§5.3 backend)

## Лицензия

MIT
