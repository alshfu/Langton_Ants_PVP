# Langton Arena · Интерфейсный контракт v1.0

**Назначение документа:** полная спецификация данных, которые UI получает от логики, и команд, которые UI отправляет обратно. Всё, что должно быть на экране — типизировано. Всё, что игрок может сделать — описано как action с сигнатурой.

**Принцип:** UI = чистая функция от `data` и `actions`. Никаких побочных эффектов, никакой бизнес-логики. Все вычисления (рейтинг, проценты, время, форматирование) делаются на стороне логики и приходят в готовом виде.

**Аудитория:**
- Frontend-разработчик (рисует интерфейс)
- Backend/Engine-разработчик (обеспечивает данные)
- Геймдизайнер (понимает что и где видно)

---

## Оглавление

1. [Глоссарий и нотация](#1-глоссарий-и-нотация)
2. [Базовые типы данных](#2-базовые-типы-данных)
3. [Глобальный объект состояния `AppState`](#3-глобальный-объект-состояния-appstate)
4. [Состояния по экранам](#4-состояния-по-экранам)
5. [Действия (`actions`)](#5-действия-actions)
6. [События (`events`)](#6-события-events)
7. [Форматирование значений](#7-форматирование-значений)
8. [Локализация](#8-локализация)
9. [Цвета и темы](#9-цвета-и-темы)
10. [Анимации и переходы](#10-анимации-и-переходы)
11. [Звуки](#11-звуки)
12. [Жизненный цикл](#12-жизненный-цикл)
13. [Ошибки и edge cases](#13-ошибки-и-edge-cases)
14. [Чек-лист интеграции](#14-чек-лист-интеграции)

---

## 1. Глоссарий и нотация

### Термины

| Термин | Определение |
|---|---|
| **Tick** | Единица времени симуляции. Default: 10 тиков/сек (TPS). |
| **Match** | Один сетевой PvP-матч от старта до подведения итогов. |
| **Round** | Одна симуляция между двумя обновлениями score (для будущих best-of форматов). |
| **Ant** | Игровая сущность — муравей с правилом и HP. |
| **Cell** | Одна клетка поля. Имеет state (бинарное, для физики) и owner (игрок). |
| **Rule** | Строка из букв `R`/`L`/`U` — определяет повороты муравья. |
| **Owner** | ID игрока, владеющего клеткой. 0 = ничья, 1..N = player, 99 = wild. |
| **HP** | Очки здоровья муравья. 0 = смерть. |
| **Reserve** | Резерв муравьёв игрока (рождённые, но не выпущенные). |
| **Charge** | Игровой ресурс для активных манипуляций (recall, change rule). |
| **Heatmap** | Аналитический оверлей поверх поля. |
| **SR** | Skill Rating, ELO-подобный рейтинг. |
| **XP** | Очки опыта аккаунта. |
| **TPS** | Ticks Per Second, скорость симуляции. |

### Нотация типов

Используется TypeScript-подобная нотация. Все типы — immutable structures.

- `T?` — поле опционально, может быть `undefined`
- `T \| null` — поле может быть `null` (явный «нет данных»)
- `T[]` — массив
- `Map<K, V>` — словарь
- `enum`-значения пишутся как union: `'a' | 'b' | 'c'`
- Числа всегда конечные (`Number.isFinite`)
- Строки — UTF-8, без ограничения по длине если не указано

### Соглашения по именованию

- Поля состояния: `camelCase` (`playerId`, `currentTick`)
- Действия: `onCamelCase` (`onPlay`, `onReady`)
- События: `SNAKE_UPPER` (`MATCH_START`, `ANT_DEATH`)
- Константы: `SNAKE_UPPER` (`MAX_PLAYERS`, `DEFAULT_HP`)
- ID полей: всегда суффикс `Id` (`playerId`, `matchId`, `antId`)
- Время в тиках: суффикс `Tick` (`startTick`, `lastDamageTick`)
- Длительность в тиках: суффикс `Ticks` (`birthCooldownTicks`)
- Время в мс: суффикс `Ms` (`pingMs`, `elapsedMs`)
- Проценты как доли: 0..1 (НЕ 0..100) — кроме явно подписанных
- Цвета: hex-строка с `#` — `'#FF5470'`

---

## 2. Базовые типы данных

### 2.1 `PlayerColor`

```typescript
type PlayerColor = {
  id: number;          // 0..9 — индекс в палитре
  hex: string;         // '#FF5470'
  name: string;        // 'Crimson' (для дальтоников видна форма + название)
  shape: 'circle' | 'triangle' | 'diamond' | 'hexagon' | 'square'
       | 'star' | 'cross' | 'pentagon' | 'octagon' | 'ring';
};
```

Палитра фиксированная, 10 цветов:

| id | name | hex | shape |
|---|---|---|---|
| 0 | Crimson | `#FF5470` | circle |
| 1 | Azure | `#4DA8FF` | triangle |
| 2 | Mint | `#39D98A` | diamond |
| 3 | Amber | `#FFD60A` | hexagon |
| 4 | Violet | `#C77DFF` | square |
| 5 | Tangerine | `#FF8A3D` | star |
| 6 | Teal | `#00E5D1` | cross |
| 7 | Magenta | `#FF4D9E` | pentagon |
| 8 | Sunflower | `#FFCC00` | octagon |
| 9 | Sky | `#7DD3FC` | ring |

### 2.2 `Rule`

```typescript
type Rule = {
  id: string;             // 'classic' | 'spiral' | 'reverse' | 'flower' | 'mirror'
                          // | 'jumper' | 'uturn' | 'random' | 'custom_xxx'
  label: string;          // 'Classic' (локализуется)
  pattern: string;        // 'RL', 'LRR', 'LR', etc.
  color: string;          // hex для бейджа правила
  description: string;    // короткое описание (локализуется)
  unlocked: boolean;      // доступно ли игроку
  unlockHint?: string;    // 'Capture 15% territory' если не разблокировано
  cost: number;           // в очках отряда (для драфта); 0 = free
  isCustom?: boolean;     // пользовательское правило?
};
```

Стандартные правила (всегда `unlocked: true` для прототипа):

| id | label | pattern | cost | описание |
|---|---|---|---|---|
| `classic` | Classic | `RL` | 2 | Highway after ~10k ticks |
| `reverse` | Reverse | `LR` | 2 | Inverts neighbour state |
| `spiral` | Spiral | `LRR` | 2 | Tight expanding spirals |
| `flower` | Flower | `RLR` | 3 | Symmetric petal pattern |
| `mirror` | Mirror | adaptive | 4 | Right on own cell, left on enemy |
| `jumper` | Jumper | special | 4 | Teleports 5 cells every 10 ticks |
| `uturn` | U-turn | `RR` | 1 | Patrols small areas |
| `random` | Random | dynamic | 1 | Picks L/R randomly |

### 2.3 `Vector2`

```typescript
type Vector2 = { x: number; y: number };
```

Координаты на поле: `x ∈ [0, fieldWidth)`, `y ∈ [0, fieldHeight)`.
Целочисленные.

### 2.4 `Direction`

```typescript
type Direction = 0 | 1 | 2 | 3;  // N=0, E=1, S=2, W=3
```

### 2.5 `Timestamp`

```typescript
type Timestamp = number;  // unix milliseconds
```

### 2.6 `TickCount`

```typescript
type TickCount = number;  // integer, can be negative for "never" sentinels (-9999)
```

---

## 3. Глобальный объект состояния `AppState`

UI читает всё состояние из одного корневого объекта. Он плоский на верхнем уровне — каждое поле соответствует одному из подразделов.

```typescript
type AppState = {
  // Метаинформация
  version: string;             // 'v0.6'
  buildHash: string;           // 'a47bc89'
  serverRegion: string;        // 'eu-west' | 'us-east' | 'asia' | 'local'
  serverTime: Timestamp;       // для синхронизации
  clientTime: Timestamp;
  pingMs: number;              // 0 = local, >0 = server

  // Сетевое состояние
  connection: ConnectionState;

  // Пользователь
  user: User;

  // Глобальная статистика сервиса
  status: ServiceStatus;

  // Текущая локализация
  locale: Locale;

  // Текущий экран и предыдущий (для анимаций перехода)
  currentScreen: ScreenId;
  previousScreen: ScreenId | null;

  // Состояния по экранам — каждое доступно ВСЕГДА, даже если не текущий экран
  // (потому что данные могут приходить заранее: matchmaking может работать в фоне)
  menu: MenuState;
  matchmaking: MatchmakingState;
  lobby: LobbyState;
  match: MatchState;
  result: ResultState;
  reward: RewardState;
  tutorial: TutorialState;
  profile: ProfileState;
  sandbox: SandboxState;       // только в web
  settings: SettingsState;

  // Toast-уведомления (общие)
  toasts: Toast[];

  // Модальные окна
  modal: Modal | null;
};
```

### 3.1 `ConnectionState`

```typescript
type ConnectionState = {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  attemptsRemaining: number;   // 0..N при reconnecting
  lastError: string | null;    // 'Connection timeout', 'Server unreachable' etc.
  serverUrl: string;           // 'wss://eu.langton-arena.com'
  protocol: 'ws' | 'wss';
  latencyMs: number;           // средний пинг за последние 10 секунд
  jitterMs: number;            // разброс пинга
};
```

Что UI с этим делает:
- При `disconnected` показывает баннер «Reconnecting...»
- При `error` показывает модальное окно с возможностью retry
- В углу матча — индикатор пинга цветом: зелёный <50ms, жёлтый 50-150, красный >150

### 3.2 `ScreenId`

```typescript
type ScreenId =
  | 'menu'
  | 'matchmaking'
  | 'lobby'
  | 'tutorial'
  | 'match'
  | 'result'
  | 'reward'
  | 'profile'
  | 'sandbox'        // web-only
  | 'settings'
  | 'credits'        // about screen
  | 'changelog';     // patch notes
```

### 3.3 `Locale`

```typescript
type Locale = {
  current: LocaleCode;
  available: LocaleCode[];
  fallback: LocaleCode;        // 'en' если ключ перевода не найден
};

type LocaleCode = 'en' | 'ru' | 'uk' | 'de' | 'es' | 'fr' | 'zh' | 'ja' | 'ko' | 'pt';
```

### 3.4 `Toast`

```typescript
type Toast = {
  id: string;                  // uuid для key
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;             // уже локализованный текст
  durationMs: number;          // 2500 default, 0 = sticky
  icon?: string;               // emoji или иконка
  action?: {
    label: string;
    handler: string;           // имя action из списка
  };
  createdAt: Timestamp;
};
```

UI отображает их стопкой в правом верхнем углу. Старые исчезают после `durationMs`.

### 3.5 `Modal`

```typescript
type Modal = {
  id: string;
  type: 'confirm' | 'alert' | 'input' | 'custom';
  title: string;
  body: string;                // может содержать \n
  cancelable: boolean;         // можно ли закрыть кнопкой Esc / фоном
  buttons: ModalButton[];
};

type ModalButton = {
  label: string;
  variant: 'primary' | 'ghost' | 'danger';
  actionId: string;            // ID action из actions
  autoFocus?: boolean;
};
```

---

## 4. Состояния по экранам

### 4.1 `User`

Профиль игрока. Всегда доступен.

```typescript
type User = {
  // Идентификация
  id: string;                  // server-issued uuid
  username: string;            // отображаемое имя, 3-20 символов
  usernameChangedAt: Timestamp | null;  // null = ещё не менял
  email: string | null;        // null = guest account

  // Внешний вид
  colorId: number;             // 0..9
  shapeId: number;             // 0..9 — может отличаться от colorId если кастомизировал
  avatarFrameId: string;       // 'default' | 'gold_s1' | ...
  trailEffectId: string;       // 'default' | 'sparkle' | ...

  // Прогресс
  level: number;               // 1..100
  xp: number;                  // в текущем уровне
  xpForNextLevel: number;      // сколько нужно набрать
  totalXp: number;             // за всё время

  // Рейтинг
  sr: number;                  // 0..4000
  rank: RankTier;              // computed from sr
  peakSr: number;
  peakRank: RankTier;
  matchesPlayed: number;
  wins: number;                // только победы
  winRate: number;             // 0..1 = wins / matchesPlayed

  // Серии
  currentStreak: number;       // победы подряд (отрицательное = поражения)
  bestStreak: number;

  // Косметика
  unlockedItems: string[];     // ['avatar_1', 'trail_sparkle', ...]
  equippedItems: {             // current loadout
    avatarFrame: string;
    trail: string;
    cellSkin: string;
  };

  // Достижения
  achievements: AchievementProgress[];

  // Метаданные
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  isPremium: boolean;
  premiumUntil: Timestamp | null;
  isGuest: boolean;            // если true — нет сохранения между устройствами
};

type RankTier = {
  id: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grandmaster';
  division: 'I' | 'II' | 'III' | 'IV' | null;  // null для master/grandmaster
  label: string;               // 'Diamond III' (локализуется)
  color: string;               // '#4DA8FF'
  iconUrl: string;             // путь к SVG-иконке ранга
  minSr: number;
  maxSr: number;
};

type AchievementProgress = {
  id: string;
  unlocked: boolean;
  progress: number;            // текущий прогресс
  target: number;              // нужное значение
  unlockedAt: Timestamp | null;
  hidden: boolean;             // скрытые до разблокировки
};
```

### 4.2 `ServiceStatus`

Глобальная информация о сервисе. Обновляется раз в 30 секунд.

```typescript
type ServiceStatus = {
  online: number;              // игроков онлайн
  activeMatches: number;
  inQueueByMode: Map<MatchMode, number>;  // 'arena' → 1234
  seasonId: string;            // 'season_02'
  seasonName: string;          // 'Spiral Season'
  seasonEndsAt: Timestamp;
  daysRemaining: number;
  serverHealth: 'healthy' | 'degraded' | 'maintenance';
  announcement: string | null; // shown as banner on main menu
};
```

### 4.3 `MenuState`

Главное меню. Минимум данных — оно почти полностью UI.

```typescript
type MenuState = {
  backgroundRule: string;      // правило для фоновой симуляции, например 'spiral'
  backgroundTps: number;       // скорость фона (12-20)
  showNews: boolean;
  newsItems: NewsItem[];       // карусель новостей
  dailyReward: DailyReward | null;  // если есть невзятая
  primaryCtaText: string;      // 'Play' или 'Continue match' если есть незавершённый
  primaryCtaAction: 'play' | 'resume_match' | 'play_tutorial';
};

type NewsItem = {
  id: string;
  type: 'patch' | 'event' | 'season' | 'community';
  title: string;
  body: string;
  imageUrl: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  publishedAt: Timestamp;
};

type DailyReward = {
  day: number;                 // 1..7 streak
  rewardType: 'xp' | 'cosmetic' | 'currency';
  rewardValue: number | string;
  available: boolean;
  expiresAt: Timestamp;
};
```

### 4.4 `MatchmakingState`

Поиск матча.

```typescript
type MatchmakingState = {
  inQueue: boolean;
  queueStartedAt: Timestamp | null;
  elapsedMs: number;           // время в очереди
  estimatedWaitMs: number;     // прогноз сервера
  mode: MatchMode;
  modeLabel: string;           // 'Arena · Ranked · 5 min'

  // Параметры искомого матча
  targetPlayers: number;       // 2/4/6/8/10
  foundPlayers: number;
  slots: MatchmakingSlot[];    // длина = targetPlayers

  // Регион
  region: string;
  regionLabel: string;
  alternativeRegions: { region: string; label: string; pingMs: number }[];

  // Прогресс
  status: 'idle' | 'searching' | 'matching' | 'found' | 'cancelled' | 'error';
  errorMessage: string | null;
};

type MatchMode = 'arena' | 'arena_ranked' | 'arena_team' | 'tutorial' | 'private' | 'sandbox';

type MatchmakingSlot = {
  index: number;
  state: 'empty' | 'filling' | 'filled' | 'reserved';
  player: SlotPlayer | null;
};

type SlotPlayer = {
  playerId: string;
  username: string;
  level: number;
  sr: number;
  rank: RankTier;
  colorId: number;
  shapeId: number;
  isYou: boolean;
  isPremium: boolean;
};
```

### 4.5 `LobbyState`

Pre-match лобби.

```typescript
type LobbyState = {
  matchId: string;
  countdownTicks: number;      // оставшиеся тики, обновляется каждый тик
  countdownLabel: string;      // '0:42' уже отформатированный
  modeLabel: string;           // 'Arena · 8 players'
  mode: MatchMode;
  fieldWidth: number;
  fieldHeight: number;
  matchDurationTicks: number;

  // Игроки в лобби
  players: LobbyPlayer[];

  // Твой отряд
  squad: SquadAnt[];           // массив фиксированной длины (по MVP = 5)
  squadBudget: number;         // не используется в MVP, для драфта
  squadBudgetSpent: number;
  squadValid: boolean;         // false если превышен бюджет (для v0.2+)

  // Доступные правила для выбора
  availableRules: Rule[];

  // Превью отряда
  previewEnabled: boolean;
  previewFieldWidth: number;   // 20×20 default
  previewFieldHeight: number;
  previewTps: number;
  previewSeed: number;
  showPreview: boolean;

  // Чат
  chatEnabled: boolean;
  chatMessages: ChatMessage[];

  // Готовность
  yourReady: boolean;
  allReady: boolean;
  canStart: boolean;
};

type LobbyPlayer = {
  playerId: string;
  username: string;
  level: number;
  sr: number;
  rank: RankTier;
  colorId: number;
  shapeId: number;
  ready: boolean;
  isYou: boolean;
  isPremium: boolean;
  pingMs: number;
  isHost: boolean;             // для приватных лобби
};

type SquadAnt = {
  index: number;               // 0..4
  ruleId: string;              // ссылка на Rule.id
  ruleLabel: string;           // pre-formatted для отображения
  ruleColor: string;
  rulePattern: string;
  startHp: number;             // обычно 3
  cost: number;                // для драфта
  customName?: string;         // если игрок назвал ('Striker')
};

type ChatMessage = {
  id: string;
  playerId: string;
  username: string;
  colorId: number;
  text: string;
  type: 'normal' | 'system' | 'quickchat';
  sentAt: Timestamp;
};
```

### 4.6 `MatchState`

Активный матч. Самая большая структура — за обновление этого UI следит постоянно.

```typescript
type MatchState = {
  // Идентификация
  matchId: string;
  mode: MatchMode;
  startedAt: Timestamp;
  serverTick: number;          // последний тик с сервера
  clientTick: number;          // тик клиента (может быть слегка выше — экстраполяция)
  isReplay: boolean;           // если true — это просмотр реплея

  // Тайминг
  tps: number;                 // 10 default
  elapsedTicks: number;
  remainingTicks: number;
  totalDurationTicks: number;
  timerLabel: string;          // '4:23' уже отформатировано
  isOvertime: boolean;         // если ничья в конце — продлеваем

  // Поле
  field: FieldState;

  // Все муравьи
  ants: Ant[];

  // Игроки в матче
  players: MatchPlayer[];

  // Сортированный лидерборд (для UI)
  leaderboard: LeaderboardRow[];

  // Локальный игрок
  you: YouState;

  // События для feed-панели
  recentEvents: MatchEvent[];

  // Combo / Streak (для juice)
  currentCombo: ComboState | null;

  // Состояние матча
  phase: 'starting' | 'running' | 'paused' | 'finishing' | 'finished';
  finishedReason: 'time_up' | 'last_standing' | 'forfeit' | null;
  winnerId: string | null;
  pauseReason: string | null;  // 'Player disconnected' / 'Host paused'

  // Камера (для синхронизации с UI камерой)
  cameraSuggestion: CameraSuggestion | null;
};

type FieldState = {
  width: number;               // 100 default
  height: number;
  topology: 'torus' | 'bounce' | 'wall' | 'void';

  // Сами данные клеток приходят как дельты,
  // но UI получает текущее состояние:
  ownerGrid: Uint8Array;       // длина = width * height
  stateGrid: Uint8Array;       // длина = width * height

  // Метаданные
  lastDeltaTick: number;       // последний тик, когда было обновление
  totalCells: number;          // width * height
  capturedCells: number;       // сумма захваченных
  neutralCells: number;
};

type Ant = {
  id: string;                  // 'ant_p0_001'
  playerId: string;            // null для wild
  ownerIndex: number;          // 0..N-1 для player, 99 для wild
  position: Vector2;
  direction: Direction;

  // Атрибуты
  ruleId: string;
  rulePattern: string;
  hp: number;
  maxHp: number;
  hpRatio: number;             // hp/maxHp, computed
  isWild: boolean;
  isHybrid: boolean;           // рождён как гибрид
  isEvolved: boolean;          // прожил 1000+ тиков
  generation: number;          // 0 для стартовых, 1+ для рождённых
  parentIds: string[] | null;  // [parent1, parent2] для рождённых

  // Состояние
  alive: boolean;
  bornAtTick: number;
  diedAtTick: number | null;
  lastDamageTick: number;      // -9999 если ни разу
  lastBirthTick: number;       // -9999 если ни разу
  immunityUntilTick: number;   // -9999 если нет иммунитета
  ticksAlive: number;

  // Для интерполяции движения
  previousPosition: Vector2;
  previousDirection: Direction;

  // Визуал
  displayColor: string;        // hex
  displayShape: string;        // 'circle' | ... — может быть особая для hybrid
  hasGoldGlow: boolean;        // для evolved
  trailEffectId: string;       // от владельца
};

type MatchPlayer = {
  playerId: string;
  username: string;
  level: number;
  sr: number;
  rank: RankTier;
  colorId: number;
  shapeId: number;
  hex: string;                 // дублирует PLAYER_COLORS[colorId].hex
  isYou: boolean;
  isPremium: boolean;
  isHost: boolean;
  pingMs: number;

  // Игровая статистика в матче
  cellsCount: number;
  cellsPercent: number;        // 0..1
  cellsPercentChange: number;  // дельта за последние 30 тиков (для тренда)
  trend: 'up' | 'down' | 'stable';

  // Муравьи
  antsAlive: number;
  antsMax: number;             // изначальный лимит
  antsBorn: number;
  antsLost: number;
  antsInReserve: number;       // для v0.5+
  reserveSlots: number;
  avgHp: number;

  // Бои
  kills: number;               // убил чужих муравьёв
  deaths: number;              // потерял своих
  damageDealt: number;
  damageTaken: number;

  // Камбо
  bestCombo: number;
  comboMultiplier: number;     // текущий

  // Лидерство
  isLeader: boolean;
  leaderSince: number | null;  // tick когда стал лидером
  totalLeaderTicks: number;    // сколько суммарно лидировал

  // Состояние
  status: 'active' | 'eliminated' | 'disconnected' | 'spectating';
  disconnectedSinceTick: number | null;
  charges: number;             // для v0.5+
  maxCharges: number;
};

type LeaderboardRow = {
  rank: number;                // 1..N
  player: MatchPlayer;         // ссылка на полную инфу
  isYou: boolean;
  isLeader: boolean;
  positionChangeFromLastTick: number;  // 0, +1, -1
  highlighted: boolean;        // мигание если только что сменил позицию
};

type YouState = {
  player: MatchPlayer;         // ссылка на свой ряд
  yourAnts: AntCardState[];    // карточки внизу
  selectedAntId: string | null; // если кликнул на муравья
  cameraTarget: Vector2 | null;
  notifications: YouNotification[];
};

type AntCardState = {
  antId: string;
  index: number;               // 0..4
  ruleLabel: string;
  ruleColor: string;
  rulePattern: string;
  hp: number;
  maxHp: number;
  hpRatio: number;
  isCritical: boolean;         // hp <= 1 → пульсация
  isDead: boolean;
  position: Vector2;
  ticksAlive: number;
  cellsClaimed: number;        // сколько клеток этот муравей лично закрасил
};

type YouNotification = {
  type: 'low_hp' | 'leading' | 'losing_lead' | 'ant_died' | 'combo_max';
  message: string;
  ticksRemaining: number;      // сколько тиков ещё показывать
  severity: 'info' | 'warning' | 'critical';
};

type MatchEvent = {
  id: string;                  // uuid для key
  tick: number;
  type: MatchEventType;
  primaryPlayerId: string | null;
  secondaryPlayerId: string | null;
  position: Vector2 | null;
  // Параметры события (зависит от type)
  payload: {
    cells?: number;            // для 'capture'
    damage?: number;           // для 'damage'
    antId?: string;
    ruleId?: string;
    [key: string]: any;
  };
  // Готовый локализованный текст для feed
  displayText: string;
  // Иконка
  icon: string;                // '🥚' | '⚠' | '✨' | '☠' | '⚡' | '🏆'
  iconColor: string;
  // Должно ли играться звук
  playSound: boolean;
  // Должна ли быть короткая всплывающая надпись над полем
  showOverlay: boolean;
};

type MatchEventType =
  | 'capture'        // муравей захватил серию клеток
  | 'clash'          // столкновение
  | 'damage'         // получение урона
  | 'birth'          // рождение муравья
  | 'hybrid'         // гибридное рождение
  | 'wild'           // появление дикого
  | 'wild_die'       // дикий умер
  | 'death'          // муравей убит
  | 'evolution'      // муравей эволюционировал
  | 'phoenix'        // феникс активирован
  | 'lead_change'    // смена лидера
  | 'combo'          // комбо достигло порога
  | 'totem_built'    // тотем сформирован
  | 'storm'          // споровый шторм
  | 'player_disconnect'
  | 'player_reconnect';

type ComboState = {
  count: number;                       // сколько подряд
  label: 'COMBO' | 'WAVE' | 'STORM' | 'APOCALYPSE';
  level: 1 | 2 | 3 | 4;
  multiplier: number;                  // 1, 1.5, 2, 3
  expiresAtTick: number;
  pulseAnimationKey: number;           // инкрементируется при каждом тике комбо
};

type CameraSuggestion = {
  target: Vector2;
  zoom: number;                // 0.5..2.0
  duration: number;            // тиков на переход
  reason: 'combat' | 'lead_change' | 'critical_event' | 'auto_follow';
  importance: 'low' | 'medium' | 'high';
};
```

### 4.7 `ResultState`

Экран результатов матча.

```typescript
type ResultState = {
  matchId: string;
  finishedAt: Timestamp;
  durationLabel: string;       // '5:00'
  durationTicks: number;
  mode: MatchMode;

  // Твой исход
  outcome: 'victory' | 'defeat' | 'placed';
  yourPlace: number;           // 1..N
  totalPlayers: number;

  // Изменения
  xpGained: number;
  xpFromWin: number;
  xpFromKills: number;
  xpFromTerritory: number;
  xpFromAchievements: number;

  srBefore: number;
  srAfter: number;
  srDelta: number;             // знаковое: +12, -8
  rankBefore: RankTier;
  rankAfter: RankTier;
  rankChanged: boolean;
  rankPromoted: boolean;       // повысился
  rankDemoted: boolean;        // понизился

  // Достижения, разблокированные в этом матче
  achievementsUnlocked: Achievement[];

  // Полная таблица итогов
  rows: ResultRow[];

  // Твои персональные статы (для Hero-варианта результата)
  yourStats: StatCard[];

  // Графики
  charts: ResultChart[];

  // Реванш
  rematchEnabled: boolean;
  rematchReady: Map<string, boolean>;  // playerId → готов ли к реваншу
  rematchCountdownTicks: number;       // тиков до автостарта реванша

  // Награда после матча
  reward: PostMatchReward | null;
};

type ResultRow = {
  rank: number;
  player: MatchPlayer;         // снапшот в момент окончания
  cellsPercent: number;
  cellsCount: number;
  kills: number;
  deaths: number;
  srDelta: number;
  xpGained: number;
  peakDescription: string;     // 'led 2:14→5:00' | 'never led'
  isYou: boolean;
  isMvp: boolean;              // мост valuable player (для Hero-варианта)
  achievements: string[];      // ID разблокированных в этом матче
};

type StatCard = {
  id: string;
  label: string;               // 'Territory'
  value: string;               // '45.3%' (уже отформатировано)
  rawValue: number;
  delta: string;               // '+12% in 30s'
  trend: 'up' | 'down' | 'stable';
  accent: boolean;             // выделить цветом
  icon?: string;
};

type ResultChart = {
  id: string;
  type: 'line' | 'area' | 'bar' | 'heatmap';
  title: string;
  series: ChartSeries[];
  xLabel: string;
  yLabel: string;
};

type ChartSeries = {
  name: string;
  color: string;
  points: Array<{ x: number; y: number }>;
};

type Achievement = {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  xpReward: number;
};

type PostMatchReward = {
  type: 'lootbox' | 'currency' | 'cosmetic' | 'xp_boost';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  preview: {
    name: string;
    description: string;
    iconUrl: string;
    primaryColor: string;
    secondaryColor: string;
  };
  opened: boolean;
};
```

### 4.8 `RewardState`

Экран открытия награды.

```typescript
type RewardState = {
  reward: PostMatchReward | null;
  opening: boolean;            // анимация открытия идёт
  opened: boolean;
  openedContents: RewardContent[];  // что выпало
  alreadyOwned: boolean;       // если дубликат — показать конверсию в валюту
  duplicateCompensation: number;    // сколько валюты дали взамен
  serialNumber: string;        // '#0247 / 5000'
  shareEnabled: boolean;       // можно ли поделиться
};

type RewardContent = {
  id: string;
  category: 'ant_skin' | 'trail' | 'avatar_frame' | 'cell_skin' | 'emote' | 'currency';
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  iconUrl: string;
  previewAnimationUrl?: string;
  primaryColor: string;
  secondaryColor: string;
};
```

### 4.9 `TutorialState`

```typescript
type TutorialState = {
  currentStep: number;         // 1..N
  totalSteps: number;
  eyebrowText: string;         // 'step 02 — collision'
  title: string;
  body: string;
  hint: {
    title: string;
    subtitle: string;
    iconType: 'arrow' | 'target' | 'time' | 'warning';
  } | null;

  // Интерактивная мини-сцена
  sceneActive: boolean;
  sceneConfig: TutorialScene | null;
  sceneCompleted: boolean;

  // Прогресс
  canSkip: boolean;
  canReplay: boolean;
  canNext: boolean;
  nextAutomatic: boolean;      // переходит сам по выполнению условия
  conditionMet: boolean;       // условие шага выполнено?

  // Награда за прохождение
  completionReward: PostMatchReward | null;
  showCompletionScreen: boolean;
};

type TutorialScene = {
  fieldWidth: number;
  fieldHeight: number;
  yourAnts: SquadAnt[];
  botAnts: SquadAnt[];
  rulesetOverride: {
    hpEnabled: boolean;
    birthEnabled: boolean;
    tps: number;
  };
  targetCondition: {
    type: 'survive_ticks' | 'capture_cells' | 'kill_count' | 'avoid_damage';
    value: number;
  };
};
```

### 4.10 `ProfileState`

Экран профиля игрока (себя или другого).

```typescript
type ProfileState = {
  viewedPlayerId: string;      // может быть свой или чужой
  isOwnProfile: boolean;

  // Базовый профиль
  player: ProfilePlayer;

  // Активный таб
  activeTab: 'overview' | 'history' | 'stats' | 'achievements' | 'heatmaps' | 'social';

  // Данные для overview
  overview: ProfileOverview;

  // История матчей
  matchHistory: {
    items: MatchHistoryItem[];
    hasMore: boolean;
    loading: boolean;
    error: string | null;
  };

  // Статистика
  stats: ProfileStats;

  // Достижения
  achievements: AchievementProgress[];

  // Тепловые карты (personal)
  heatmaps: ProfileHeatmap[];

  // Социальное
  social: {
    isFriend: boolean;
    friendRequestSent: boolean;
    canMessage: boolean;
    canBlock: boolean;
    blocked: boolean;
  };
};

type ProfilePlayer = User & {
  isOnline: boolean;
  currentActivity: 'menu' | 'in_match' | 'in_lobby' | 'idle' | 'offline';
  lastSeenAt: Timestamp;
};

type ProfileOverview = {
  recentForm: ('W' | 'L' | 'D')[];  // последние 10 матчей
  topRules: RuleStats[];            // топ-5 любимых правил
  playStyle: 'aggressor' | 'defender' | 'expansionist' | 'balanced';
  playStyleConfidence: number;      // 0..1
  bestRank: RankTier;
  totalPlayTimeMs: number;
};

type RuleStats = {
  ruleId: string;
  ruleLabel: string;
  matches: number;
  winRate: number;
  avgTerritory: number;
  survivalRate: number;
};

type MatchHistoryItem = {
  matchId: string;
  playedAt: Timestamp;
  durationLabel: string;
  mode: MatchMode;
  playerCount: number;
  outcome: 'victory' | 'defeat' | 'placed';
  place: number;
  totalPlayers: number;
  cellsPercent: number;
  kills: number;
  deaths: number;
  srDelta: number;
  comboMax: number;
  hasReplay: boolean;
  isHighlight: boolean;             // топовый матч за последние 10
};

type ProfileStats = {
  // По времени
  byTimeOfDay: { hour: number; winRate: number; matches: number }[];
  byDayOfWeek: { day: number; winRate: number; matches: number }[];

  // По устройству
  byPlatform: { platform: string; matches: number; winRate: number }[];

  // Графики прогресса
  srOverTime: { timestamp: Timestamp; sr: number }[];
  winRateOverTime: { week: string; winRate: number }[];

  // Сравнение со средним
  benchmark: {
    yourWinRate: number;
    averageWinRate: number;
    top10WinRate: number;
    rank: 'below' | 'average' | 'above' | 'top';
  };

  // Расширенные метрики
  averageAccuracy: number;     // 0..1
  averageApm: number;
  totalCellsClaimed: number;
  totalAntsBorn: number;
  totalAntsKilled: number;
  longestStreak: number;
};

type ProfileHeatmap = {
  id: 'deaths' | 'kills' | 'activity' | 'leadership';
  title: string;
  description: string;
  width: number;
  height: number;
  data: Float32Array;          // длина = width * height, нормализованные значения
  totalSamples: number;        // матчей включено
  generatedAt: Timestamp;
};
```

### 4.11 `SandboxState`

Состояние веб-only лаборатории. Локальное, не передаётся на сервер.

```typescript
type SandboxState = {
  // Конфигурация (то что в текущей реализации screens-sandbox)
  config: SandboxConfig;

  // Симуляция (только для display)
  simulation: SandboxSimulation;

  // Доступные пресеты
  presets: SandboxPreset[];
  currentPresetId: string | null;
  configDirty: boolean;        // изменена после загрузки пресета

  // Сохранённые слоты
  savedSlots: SandboxSavedSlot[];

  // UI-состояние
  ui: {
    paused: boolean;
    showSettings: boolean;
    showStats: boolean;
    activeSection: string;     // какая секция настроек развёрнута
    fullScreen: boolean;
  };
};

type SandboxConfig = {
  // Поле
  width: number;
  height: number;
  topology: 'torus' | 'bounce' | 'wall' | 'void';
  bgColor: string;

  // Игроки
  players: SandboxPlayerConfig[];

  // Размножение
  birthEnabled: boolean;
  birthMinNeighbors: number;
  birthCooldownTicks: number;
  maxAntsPerPlayer: number;
  hybridChance: number;        // 0..1
  wildBirthChance: number;     // 0..1

  // Бой
  hpEnabled: boolean;
  collisionCooldownTicks: number;
  cellsSurviveDeath: boolean;

  // Тепловые карты
  heatmapMode: 'none' | 'activity' | 'collisions' | 'deaths' | 'territory';
  heatmapIntensity: number;    // 0..3 (для 100% = 1.0)
  heatmapOpacity: number;      // 0..1
  heatmapDecay: boolean;

  // Симуляция
  baseTps: number;             // 1..60
  speedMultiplier: number;     // 0.25, 0.5, 1, 2, 4, 8, 16
  matchDurationTicks: number | null;

  // Визуал
  showGrid: boolean;
  showGlow: boolean;
  showTrails: boolean;
  showHpDots: boolean;
  antScale: number;            // 0.3..1.5

  // Meta
  seed: number;
};

type SandboxPlayerConfig = {
  color: string;
  antCount: number;
  ruleId: string;
  startHp: number;
  spawnPattern: 'radial' | 'corner' | 'random' | 'cluster' | 'center';
};

type SandboxSimulation = {
  tick: number;
  effectiveTps: number;        // baseTps × speedMultiplier
  totalAnts: number;
  wildCount: number;
  stats: SandboxPlayerStats[];
  eventCounts: {
    births: number;
    hybrids: number;
    wilds: number;
    deaths: number;
  };
  events: MatchEvent[];        // последние ~50, без damage-спама
};

type SandboxPlayerStats = {
  playerIndex: number;
  color: string;
  ruleId: string;
  cellsCount: number;
  cellsPercent: number;
  antsAlive: number;
  avgHp: number;
  isEliminated: boolean;
};

type SandboxPreset = {
  id: string;
  name: string;
  description: string;
  configPatch: Partial<SandboxConfig>;
  recommendedDuration: number; // тиков
  iconUrl?: string;
};

type SandboxSavedSlot = {
  id: string;
  name: string;
  config: SandboxConfig;
  savedAt: Timestamp;
  thumbnail?: string;          // base64 png?
};
```

### 4.12 `SettingsState`

```typescript
type SettingsState = {
  // Видео
  graphics: {
    quality: 'low' | 'medium' | 'high';
    glowEnabled: boolean;
    trailsEnabled: boolean;
    particleEffects: boolean;
    backgroundSimulation: boolean;
    fpsLimit: number | null;   // null = unlimited
  };

  // Звук
  audio: {
    masterVolume: number;      // 0..1
    musicVolume: number;
    sfxVolume: number;
    uiVolume: number;
    muteWhenInBackground: boolean;
  };

  // Управление
  controls: {
    cameraInvertX: boolean;
    cameraInvertY: boolean;
    cameraSensitivity: number; // 0.5..2.0
    autoCameraEnabled: boolean;
    hotkeys: Map<string, string>; // 'centerOnAnt1' → 'Digit1'
  };

  // Геймплей
  gameplay: {
    showDamageNumbers: boolean;
    showHpDots: boolean;
    autoPanToEvents: boolean;
    quickChatEnabled: boolean;
  };

  // Доступность
  accessibility: {
    colorblindMode: 'off' | 'protanopia' | 'deuteranopia' | 'tritanopia';
    highContrast: boolean;
    largeText: boolean;
    reducedMotion: boolean;
    screenReader: boolean;
    fontSize: 'small' | 'normal' | 'large' | 'xlarge';
  };

  // Уведомления
  notifications: {
    showFriendOnline: boolean;
    showAchievements: boolean;
    showRankPromotions: boolean;
  };

  // Приватность
  privacy: {
    profileVisibility: 'public' | 'friends' | 'private';
    showOnlineStatus: boolean;
    allowFriendRequests: boolean;
    allowChatRequests: boolean;
  };

  // Аккаунт
  account: {
    locale: LocaleCode;
    timezone: string;          // 'Europe/Berlin'
    use24hClock: boolean;
    region: string;
  };
};
```

---

## 5. Действия (`actions`)

Все действия — это асинхронные функции с фиксированной сигнатурой. UI вызывает их через callback, логика обрабатывает.

### 5.1 Соглашение

```typescript
type ActionResult<T = void> = Promise<{
  success: boolean;
  data?: T;
  error?: ActionError;
}>;

type ActionError = {
  code: string;                // 'NOT_AUTHENTICATED' | 'INVALID_INPUT' | ...
  message: string;             // локализованный
  recoverable: boolean;
  retryAfterMs?: number;
};
```

Все действия должны возвращать promise. UI может показывать загрузчик пока promise не разрешён.

### 5.2 Полный список действий

#### Меню и навигация

| Action | Сигнатура | Когда вызывается |
|---|---|---|
| `onScreenChange` | `(screenId: ScreenId)` | Изменение текущего экрана |
| `onPlay` | `()` | Кнопка Play в меню |
| `onResumeMatch` | `(matchId: string)` | Если есть незавершённый матч |
| `onOpenProfile` | `(playerId: string)` | Тап на ник игрока где угодно |
| `onOpenSettings` | `()` | Шестерёнка в любом экране |
| `onOpenSandbox` | `()` | Кнопка Sandbox (web only) |
| `onOpenTutorial` | `()` | Training в меню |
| `onOpenChangelog` | `()` | Версия в footer |
| `onLogout` | `()` | Выйти из аккаунта |
| `onQuit` | `()` | Закрыть приложение (desktop only) |

#### Матчмейкинг

| Action | Сигнатура | Эффект |
|---|---|---|
| `onStartMatchmaking` | `(mode: MatchMode, options?: MatchOptions)` | Войти в очередь |
| `onCancelMatchmaking` | `()` | Выйти из очереди |
| `onChangeRegion` | `(region: string)` | Сменить регион поиска |
| `onAcceptMatch` | `()` | Принять найденный матч (для ranked) |
| `onDeclineMatch` | `()` | Отказаться от найденного матча |

```typescript
type MatchOptions = {
  preferredPlayerCount?: 2 | 4 | 6 | 8 | 10;
  inviteFriends?: string[];    // playerIds для приватного лобби
  customSettings?: Partial<MatchSettings>;
};
```

#### Лобби

| Action | Сигнатура | Эффект |
|---|---|---|
| `onLobbyReady` | `()` | Отметить готовность |
| `onLobbyUnready` | `()` | Снять готовность |
| `onLobbyLeave` | `()` | Покинуть лобби |
| `onSquadChange` | `(antIndex: number, ruleId: string)` | Сменить правило конкретного муравья |
| `onSquadShuffle` | `()` | Случайно перетасовать правила |
| `onSquadLoadPreset` | `(presetId: string)` | Загрузить сохранённую раскладку |
| `onSquadSavePreset` | `(name: string)` | Сохранить текущую как пресет |
| `onLobbyPreviewToggle` | `(enabled: boolean)` | Включить/выключить превью |
| `onLobbyChatSend` | `(text: string)` | Отправить сообщение в чат |
| `onLobbyQuickChat` | `(quickChatId: string)` | Быстрый чат |
| `onLobbyKickPlayer` | `(playerId: string)` | Только для хоста private |

#### Матч

| Action | Сигнатура | Эффект |
|---|---|---|
| `onMatchPause` | `()` | Пауза (только в singleplayer) |
| `onMatchResume` | `()` | Снять паузу |
| `onMatchForfeit` | `()` | Сдаться (с подтверждением) |
| `onSelectAnt` | `(antId: string)` | Тап на муравья |
| `onDeselectAnt` | `()` | Снять выделение |
| `onCameraPan` | `(delta: Vector2)` | Сдвинуть камеру |
| `onCameraZoom` | `(delta: number, center: Vector2)` | Зум |
| `onCameraReset` | `()` | Вернуться к обзору всего поля |
| `onCameraCenterOn` | `(target: Vector2 \| string)` | Центрировать на точке или муравье |
| `onCameraToggleAutoFollow` | `(enabled: boolean)` | Авто-следование за событиями |
| `onSendQuickChat` | `(emoteId: string)` | Эмоция в матче |

**Для v0.5+ (управление муравьями):**

| Action | Сигнатура | Эффект |
|---|---|---|
| `onChangeAntRule` | `(antId: string, newRuleId: string)` | Сменить правило активного муравья |
| `onRecallAnt` | `(antId: string)` | Вернуть муравья в резерв |
| `onDeployFromReserve` | `(reserveAntId: string, position: Vector2)` | Выпустить из резерва в точку |
| `onDeployStrategy` | `(reserveAntId: string, strategy: DeployStrategy)` | Выпустить по стратегии |
| `onSwapReserveRule` | `(reserveAntId: string, newRuleId: string)` | Сменить правило в резерве |
| `onDiscardReserve` | `(reserveAntId: string)` | Выкинуть муравья из резерва |
| `onCreateCustomRule` | `(name: string, pattern: string)` | Создать кастомное правило |

```typescript
type DeployStrategy = 'home' | 'near_enemy' | 'in_chaos' | 'ambush' | 'sacrifice' | 'squad';
```

#### Результаты

| Action | Сигнатура | Эффект |
|---|---|---|
| `onRematch` | `()` | Запустить реванш с теми же игроками |
| `onCancelRematch` | `()` | Отказаться от реванша |
| `onNewMatch` | `()` | Найти новый матч |
| `onReturnToMenu` | `()` | В главное меню |
| `onOpenReward` | `()` | Открыть награду |
| `onShareResult` | `()` | Поделиться результатом |
| `onWatchReplay` | `(matchId: string)` | Запустить реплей |
| `onDownloadReplay` | `(matchId: string)` | Скачать реплей файлом |
| `onReportPlayer` | `(playerId: string, reason: string)` | Жалоба |

#### Награда

| Action | Сигнатура | Эффект |
|---|---|---|
| `onOpenLootbox` | `()` | Запустить анимацию открытия |
| `onClaimReward` | `()` | Подтвердить получение |
| `onEquipReward` | `(itemId: string)` | Сразу экипировать |
| `onSkipRewardAnimation` | `()` | Пропустить анимацию |

#### Туториал

| Action | Сигнатура | Эффект |
|---|---|---|
| `onTutorialNext` | `()` | На следующий шаг |
| `onTutorialPrev` | `()` | На предыдущий |
| `onTutorialReplay` | `()` | Повторить текущий шаг |
| `onTutorialSkip` | `()` | Пропустить весь туториал |
| `onTutorialComplete` | `()` | Финальный экран |

#### Профиль

| Action | Сигнатура | Эффект |
|---|---|---|
| `onProfileTabChange` | `(tab: string)` | Переключение табов |
| `onLoadMoreHistory` | `()` | Подгрузить старые матчи |
| `onFilterHistory` | `(filters: HistoryFilters)` | Фильтрация |
| `onAddFriend` | `(playerId: string)` | Запрос дружбы |
| `onRemoveFriend` | `(playerId: string)` | Удалить друга |
| `onBlockPlayer` | `(playerId: string)` | Заблокировать |
| `onUnblockPlayer` | `(playerId: string)` | Разблокировать |
| `onChangeUsername` | `(newName: string)` | Сменить никнейм |
| `onChangeColor` | `(colorId: number)` | Сменить цвет |
| `onEquipCosmetic` | `(slot: string, itemId: string)` | Экипировать предмет |

#### Sandbox

| Action | Сигнатура | Эффект |
|---|---|---|
| `onSandboxConfigChange` | `(patch: Partial<SandboxConfig>)` | Любое изменение настройки |
| `onSandboxPlay` | `()` | Снять паузу |
| `onSandboxPause` | `()` | Поставить на паузу |
| `onSandboxStep` | `()` | Один тик вперёд (на паузе) |
| `onSandboxReset` | `()` | Сбросить симуляцию |
| `onSandboxLoadPreset` | `(presetId: string)` | Применить пресет |
| `onSandboxSaveSlot` | `(name: string)` | Сохранить текущее |
| `onSandboxLoadSlot` | `(slotId: string)` | Загрузить |
| `onSandboxDeleteSlot` | `(slotId: string)` | Удалить слот |
| `onSandboxExportConfig` | `()` | В буфер или файл |
| `onSandboxImportConfig` | `(json: string)` | Из буфера |
| `onSandboxAddPlayer` | `()` | Добавить игрока |
| `onSandboxRemovePlayer` | `(index: number)` | Убрать игрока |
| `onSandboxPlayerChange` | `(index: number, patch: Partial<SandboxPlayerConfig>)` | Изменить игрока |
| `onSandboxResetHeatmaps` | `()` | Очистить накопленные heatmap-данные |
| `onSandboxExportHeatmap` | `(type: string)` | Скачать heatmap как PNG |

#### Настройки

| Action | Сигнатура | Эффект |
|---|---|---|
| `onSettingsChange` | `(category: string, key: string, value: any)` | Любое изменение |
| `onSettingsReset` | `(category?: string)` | Сбросить раздел или всё |
| `onSettingsApply` | `()` | Применить (для тех что требуют рестарт) |
| `onChangeLocale` | `(locale: LocaleCode)` | Сменить язык |
| `onChangeHotkey` | `(action: string, newKey: string)` | Перебиндить хоткей |

#### Модалки и тосты

| Action | Сигнатура | Эффект |
|---|---|---|
| `onModalClose` | `()` | Закрыть текущую модалку |
| `onModalAction` | `(actionId: string)` | Нажатие кнопки в модалке |
| `onToastDismiss` | `(toastId: string)` | Закрыть toast |
| `onToastAction` | `(toastId: string)` | Кликнуть на action в toast |

#### Системные

| Action | Сигнатура | Эффект |
|---|---|---|
| `onReconnect` | `()` | Попытка реконнекта |
| `onCancelReconnect` | `()` | Отменить попытку |
| `onSendBugReport` | `(text: string, includeLogs: boolean)` | Жалоба о баге |
| `onContactSupport` | `()` | Открыть форму поддержки |

---

## 6. События (`events`)

В отличие от actions (UI → логика), события идут от логики к UI как уведомления.

```typescript
type GameEvent =
  | { type: 'state_update'; patch: Partial<AppState> }
  | { type: 'screen_transition'; from: ScreenId; to: ScreenId; reason: string }
  | { type: 'toast'; toast: Toast }
  | { type: 'modal'; modal: Modal }
  | { type: 'play_sound'; soundId: SoundId; volume?: number; pan?: number }
  | { type: 'play_animation'; animationId: string; payload?: any }
  | { type: 'camera_event'; suggestion: CameraSuggestion }
  | { type: 'haptic'; intensity: 'light' | 'medium' | 'heavy' };
```

Логика подписывается на UI через колбэк `onEvent: (event: GameEvent) => void`, который UI выставляет при инициализации.

---

## 7. Форматирование значений

UI **не должен** форматировать значения сам. Логика отдаёт уже готовое.

### 7.1 Формат времени матча

| Тики | Строка |
|---|---|
| 3000 | `5:00` |
| 1530 | `2:33` |
| 60 | `0:06` |
| 9 | `0:00` |

Формула: `mm:ss` где `mm = floor(ticks / TPS / 60)`, `ss = floor(ticks / TPS) % 60`.

### 7.2 Формат процентов

| Значение | Строка |
|---|---|
| 0.453 | `45.3%` |
| 0.045 | `4.5%` |
| 0.004 | `0.4%` |
| 1.000 | `100%` |

Округление до 1 знака после запятой кроме 100% (без точки).

### 7.3 Формат больших чисел

| Значение | Строка |
|---|---|
| 1234567 | `1.2M` |
| 12345 | `12.3k` |
| 1234 | `1,234` |
| 123 | `123` |

### 7.4 Формат изменения SR

| Дельта | Строка |
|---|---|
| 12 | `+12` |
| -8 | `-8` |
| 0 | `±0` |

### 7.5 Формат времени относительного

| Прошло | Строка |
|---|---|
| <60s | `just now` / `только что` |
| <1h | `5 min ago` / `5 мин назад` |
| <24h | `3 hours ago` / `3 часа назад` |
| <7d | `Tuesday` / `во вторник` |
| <30d | `Mar 15` / `15 марта` |
| ≥30d | `Jan 23, 2026` / `23 янв 2026` |

### 7.6 Формат пинга

Цвет зависит от значения:
- 0-30 ms — зелёный `#39D98A`, иконка ●●●●●
- 30-80 ms — жёлтый `#FFD60A`, ●●●●○
- 80-150 ms — оранжевый `#FF8A3D`, ●●●○○
- >150 ms — красный `#FF453A`, ●●○○○

### 7.7 Формат правил

В лобби и в матче правило отображается как:

```
[chip color] Spiral · LRR
```

Где `Spiral` — `Rule.label`, `LRR` — `Rule.pattern`. Чип фона использует `Rule.color` с альфой 0.15.

---

## 8. Локализация

### 8.1 Ключи переводов

Используется flat-структура с точками-разделителями:

```
menu.button.play
menu.button.training
menu.cta.continueMatch

lobby.title
lobby.countdown.label
lobby.squad.title
lobby.squad.changeRule
lobby.player.ready
lobby.player.picking

match.timer.label
match.event.capture           // {n} cells captured
match.event.death             // {playerName} lost an ant
match.event.wild              // ⚠ WILD APPEARS

result.title.victory
result.title.defeat
result.title.placed           // {place} of {total}

errors.network.timeout
errors.network.disconnected
errors.match.fullArena
```

### 8.2 Подстановки

Используются именованные плейсхолдеры:

```
match.event.capture = "{playerName} captured {n} cells"
// → "BraveSpiral42 captured 14 cells"
```

UI получает уже подставленное значение через переводчик.

### 8.3 Плюрализация

Для русского нужны 3 формы:

```
match.event.cellsCount = {
  one: "{n} клетка",         // 1, 21, 31
  few: "{n} клетки",         // 2-4, 22-24
  many: "{n} клеток"         // 0, 5-20, 25-30
}
```

UI выбирает форму по правилам locale.

### 8.4 Направление текста

В MVP — только LTR (left-to-right). RTL (арабский, иврит) — на v1.0.

---

## 9. Цвета и темы

### 9.1 Семантические цвета (theme tokens)

Все компоненты используют **семантические токены**, а не хардкод-хексы.

```typescript
type Theme = {
  // Поверхности
  bg: string;                  // основной фон
  bgElevated: string;          // карточки, панели
  bgOverlay: string;           // hover, активные состояния
  bgInverted: string;          // для light-on-dark

  // Текст
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverted: string;
  textOnAccent: string;

  // Линии и обводки
  border: string;
  borderStrong: string;
  borderFocus: string;

  // Акценты
  accent: string;              // main color (yellow по умолчанию)
  accentHover: string;
  accentMuted: string;

  // Состояния
  success: string;
  warning: string;
  danger: string;
  info: string;

  // Радиусы
  radiusXs: number;            // 4
  radiusSm: number;            // 6
  radiusMd: number;            // 10
  radiusLg: number;            // 16
  radiusFull: number;          // 9999

  // Тени
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  shadowGlow: string;          // для главных кнопок

  // Spacing (8pt grid)
  space1: number;              // 4
  space2: number;              // 8
  space3: number;              // 12
  space4: number;              // 16
  space5: number;              // 20
  space6: number;              // 24
  space8: number;              // 32
  space10: number;             // 40
  space12: number;             // 48
  space16: number;             // 64
};
```

### 9.2 Темы

```typescript
const themes = {
  dark: { /* ... текущая палитра ... */ },
  light: { /* ... светлая ... */ },
  highContrast: { /* ... для accessibility ... */ },
  colorblindProtanopia: { /* ... */ },
  colorblindDeuteranopia: { /* ... */ },
  colorblindTritanopia: { /* ... */ },
};
```

UI читает текущую тему через `useTheme()` или contextProvider.

---

## 10. Анимации и переходы

### 10.1 Easing-функции

| Имя | Кубическая Безье | Применение |
|---|---|---|
| `easeOut` | `cubic-bezier(0.16, 1, 0.3, 1)` | Появление элементов |
| `easeIn` | `cubic-bezier(0.7, 0, 0.84, 0)` | Исчезновение |
| `easeInOut` | `cubic-bezier(0.65, 0, 0.35, 1)` | Перемещение |
| `bouncy` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Появление с легким отскоком |
| `sharp` | `cubic-bezier(0.4, 0, 0.6, 1)` | Быстрая реакция |

### 10.2 Длительности

| Имя | мс | Применение |
|---|---|---|
| `instant` | 0 | Без анимации |
| `fast` | 120 | Hover, тапы |
| `normal` | 240 | Появление элементов |
| `slow` | 400 | Переходы экранов |
| `dramatic` | 800 | Финал матча |

### 10.3 Список именованных анимаций

UI должен поддерживать вызов через `playAnimation(id, target)`:

| ID | Описание | Где играется |
|---|---|---|
| `fadeIn` | Появление с opacity 0→1 | Toast, modal |
| `fadeOut` | Исчезновение | Toast dismiss |
| `slideUpIn` | Из-под низа экрана | Bottom sheet |
| `popIn` | scale 0.7→1 с bouncy easing | Кнопки, награды |
| `pulse` | Бесконечная пульсация opacity | HP=1 индикатор |
| `shake` | Тряска по X | Ошибка, отказ |
| `glow` | Циклическое свечение | Главная кнопка |
| `confetti` | Конфетти-частицы | Победа |
| `screenShake` | Тряска всего экрана | Критическое событие |
| `countdownFlash` | Большие цифры 3-2-1 | Старт матча |
| `victoryReveal` | Замедление + zoom + flash | Финал матча |
| `defeatFade` | Десатурация | Поражение |
| `flashScreen` | Короткая белая вспышка | Капчура |
| `ringPulse` | Расходящееся кольцо | Спецсобытие |

---

## 11. Звуки

### 11.1 Список звуков

UI вызывает `playSound(soundId, options)`.

| ID | Описание | Громкость default |
|---|---|---|
| `ui_hover` | Hover на кнопку | 0.3 |
| `ui_tap` | Тап на кнопку | 0.4 |
| `ui_open` | Открытие модалки | 0.5 |
| `ui_close` | Закрытие | 0.4 |
| `ui_notification` | Toast | 0.5 |
| `ui_error` | Ошибка | 0.6 |
| `ui_select` | Выбор опции | 0.4 |
| `ui_toggle` | Включение чего-то | 0.4 |
| `match_countdown` | 3-2-1 GO | 0.7 |
| `match_start` | Начало матча | 0.7 |
| `match_tick_short` | Шаг муравья (рандомный pitch) | 0.15 |
| `match_capture` | Захват клетки | 0.2 |
| `match_clash` | Столкновение | 0.5 |
| `match_birth` | Рождение муравья | 0.6 |
| `match_hybrid` | Гибрид появился | 0.7 |
| `match_wild_alert` | Дикий появился | 0.8 |
| `match_death` | Гибель муравья | 0.6 |
| `match_combo_1` | Combo достигнуто | 0.5 |
| `match_combo_2` | Wave | 0.6 |
| `match_combo_3` | Storm | 0.7 |
| `match_combo_4` | Apocalypse | 0.9 |
| `match_lead_change` | Сменился лидер | 0.5 |
| `match_critical_hp` | HP=1 (loop) | 0.4 |
| `match_finish` | Финал матча | 0.8 |
| `match_victory` | Победа | 1.0 |
| `match_defeat` | Поражение | 0.7 |
| `reward_open` | Открытие лутбокса | 0.8 |
| `reward_common` | Common rarity | 0.6 |
| `reward_rare` | Rare | 0.7 |
| `reward_epic` | Epic | 0.8 |
| `reward_legendary` | Legendary | 1.0 |
| `rank_promotion` | Повышение ранга | 0.9 |
| `achievement_unlock` | Достижение | 0.7 |

### 11.2 Музыка

Тоже идёт через `playSound`, но с особым префиксом `music_`:

| ID | Описание |
|---|---|
| `music_menu` | Главное меню (loop) |
| `music_lobby` | Лобби (loop) |
| `music_match_phase1` | Матч первая минута |
| `music_match_phase2` | Матч середина |
| `music_match_phase3` | Матч последние 30 сек |
| `music_match_finale` | Последние 5 секунд |
| `music_victory` | Победа |
| `music_defeat` | Поражение |
| `music_sandbox` | Sandbox-лаборатория |

Логика отдаёт UI команды на crossfade между ними через события `play_sound` с дополнительным флагом `crossfadeMs`.

---

## 12. Жизненный цикл

### 12.1 Инициализация приложения

```
1. UI монтируется
2. UI загружает кешированный AppState (из localStorage / preferences)
3. UI отображает loading screen
4. UI инициализирует engine
5. Engine коннектится к серверу (или в offline для sandbox)
6. Engine отдаёт первый полный AppState
7. UI переходит на main menu
```

### 12.2 Жизненный цикл матча

```
state: matchmaking.status = 'idle'
  → onStartMatchmaking →
state: matchmaking.status = 'searching', inQueue = true
  ↓ (slots fill)
state: matchmaking.status = 'matching'
  ↓ (all accepted)
state: matchmaking.status = 'found'
  ↓ (auto transition)
state: currentScreen = 'lobby', lobby.* populated
  ↓ (all players ready, countdown reaches 0)
state: match.phase = 'starting' (3-2-1 countdown)
state: match.phase = 'running'
  ↓ (timer ends or last-standing)
state: match.phase = 'finishing'
state: match.phase = 'finished', result.* populated
  ↓ (auto transition after 2s)
state: currentScreen = 'result'
  → onOpenReward (если есть) →
state: currentScreen = 'reward'
  → onReturnToMenu →
state: currentScreen = 'menu'
```

### 12.3 Подписка UI на updates

UI получает обновления состояния через события `state_update`. Это патчи (не полная замена), для эффективного re-render.

```typescript
// UI side
engine.onEvent((event) => {
  if (event.type === 'state_update') {
    setAppState((prev) => deepMerge(prev, event.patch));
  }
});
```

Частота обновлений:
- В матче: 10 Hz (синхронно с тиками сервера)
- В лобби: при изменениях (event-driven)
- В меню: 1 Hz для ping/online, при изменениях для остального

---

## 13. Ошибки и edge cases

### 13.1 Загрузка состояния

| Ситуация | Поведение UI |
|---|---|
| `data === null` | Показать loading skeleton, не отдавать действия |
| `data.connection.status === 'connecting'` | Loading + текст «Connecting…» |
| `data.connection.status === 'error'` | Полноэкранный error с retry |
| Поле `data.match` приходит позже | Skeleton-ленты вместо настоящих данных |
| `actions === undefined` | UI рендерит как read-only |

### 13.2 Конкурентность

Если приходит обновление пока пользователь печатает (например, в чате) — текущий ввод НЕ перезаписывается. UI должен иметь local state для input-полей.

### 13.3 Граничные значения

| Поле | Min | Max | Что делать вне диапазона |
|---|---|---|---|
| `player.sr` | 0 | 4000 | Кламп без алерта |
| `match.tps` | 1 | 60 | Принять, но в UI показать предупреждение если >30 |
| `field.width` | 10 | 200 | Не принимать, error toast |
| `players` length | 1 | 10 | Не принимать, error toast |
| `username` length | 3 | 20 | Не принимать input |

### 13.4 Сбои сети

| Длительность | Поведение |
|---|---|
| 0-3s | Тихо, попытка реконнекта |
| 3-10s | Баннер сверху «Reconnecting...» |
| 10-30s | Модалка «Connection lost — retry or leave» |
| >30s | Принудительный exit матча с сохранением SR (treat as DC) |

### 13.5 Сбои логики (баги)

Если UI получает `state` с неконсистентными данными (например, `selectedAntId` указывает на несуществующего муравья):
- Не падать
- Восстановить sane default (selectedAntId = null)
- Залогировать в console и (если в проде) отправить телеметрию
- Возможно показать sticky toast «Internal error, please report»

---

## 14. Чек-лист интеграции

Для каждого экрана UI должен пройти этот чек-лист:

### Общие пункты

- [ ] Экран рендерит с `data === null` (loading state)
- [ ] Экран рендерит с `actions === noopActions` (preview / readonly mode)
- [ ] Экран корректно перерисовывается при partial update state
- [ ] Все строки идут через локализацию (нет хардкода)
- [ ] Все цвета идут через theme tokens
- [ ] Все размеры в `space*` (нет magic numbers)
- [ ] Все клавиатурные shortcut'ы работают
- [ ] Screen reader читает основные элементы
- [ ] Tap targets ≥44×44 px на mobile
- [ ] Все async actions показывают loader пока pending
- [ ] Все async actions обрабатывают `error.recoverable` отдельно
- [ ] Все списки виртуализированы при >50 элементов
- [ ] Все экраны корректно работают при ширине от 320px (mobile)

### Для матч-HUD дополнительно

- [ ] FPS ≥30 при 100 муравьях на поле 100×100
- [ ] Камера плавно интерполируется при автоследовании
- [ ] HP-индикаторы корректно показывают damage flash
- [ ] Heatmap включается/выключается без пересоздания canvas
- [ ] При disconnect показывается оверлей-пауза, не ломая state
- [ ] Spectator-режим (после смерти) визуально отличается

### Для лобби дополнительно

- [ ] Превью отряда работает на минимум 5 разных правилах
- [ ] Чат фильтрует ругательства
- [ ] Quick-chat не спамится (rate limit на клиенте)
- [ ] Когда игрок выходит, его слот корректно становится пустым

---

## Приложение А: Полные дефолты `defaultActions()`

```typescript
function noopActions(): AppActions {
  const noop = async () => ({ success: true });
  return {
    onPlay: noop,
    onScreenChange: noop,
    onResumeMatch: noop,
    onOpenProfile: noop,
    onOpenSettings: noop,
    onOpenSandbox: noop,
    onOpenTutorial: noop,
    onLogout: noop,
    onQuit: noop,
    onStartMatchmaking: noop,
    onCancelMatchmaking: noop,
    onChangeRegion: noop,
    onAcceptMatch: noop,
    onDeclineMatch: noop,
    onLobbyReady: noop,
    onLobbyUnready: noop,
    onLobbyLeave: noop,
    onSquadChange: noop,
    onSquadShuffle: noop,
    onSquadLoadPreset: noop,
    onSquadSavePreset: noop,
    onLobbyPreviewToggle: noop,
    onLobbyChatSend: noop,
    onLobbyQuickChat: noop,
    onLobbyKickPlayer: noop,
    onMatchPause: noop,
    onMatchResume: noop,
    onMatchForfeit: noop,
    onSelectAnt: noop,
    onDeselectAnt: noop,
    onCameraPan: noop,
    onCameraZoom: noop,
    onCameraReset: noop,
    onCameraCenterOn: noop,
    onCameraToggleAutoFollow: noop,
    onSendQuickChat: noop,
    onChangeAntRule: noop,
    onRecallAnt: noop,
    onDeployFromReserve: noop,
    onDeployStrategy: noop,
    onSwapReserveRule: noop,
    onDiscardReserve: noop,
    onCreateCustomRule: noop,
    onRematch: noop,
    onCancelRematch: noop,
    onNewMatch: noop,
    onReturnToMenu: noop,
    onOpenReward: noop,
    onShareResult: noop,
    onWatchReplay: noop,
    onDownloadReplay: noop,
    onReportPlayer: noop,
    onOpenLootbox: noop,
    onClaimReward: noop,
    onEquipReward: noop,
    onSkipRewardAnimation: noop,
    onTutorialNext: noop,
    onTutorialPrev: noop,
    onTutorialReplay: noop,
    onTutorialSkip: noop,
    onTutorialComplete: noop,
    onProfileTabChange: noop,
    onLoadMoreHistory: noop,
    onFilterHistory: noop,
    onAddFriend: noop,
    onRemoveFriend: noop,
    onBlockPlayer: noop,
    onUnblockPlayer: noop,
    onChangeUsername: noop,
    onChangeColor: noop,
    onEquipCosmetic: noop,
    onSandboxConfigChange: noop,
    onSandboxPlay: noop,
    onSandboxPause: noop,
    onSandboxStep: noop,
    onSandboxReset: noop,
    onSandboxLoadPreset: noop,
    onSandboxSaveSlot: noop,
    onSandboxLoadSlot: noop,
    onSandboxDeleteSlot: noop,
    onSandboxExportConfig: noop,
    onSandboxImportConfig: noop,
    onSandboxAddPlayer: noop,
    onSandboxRemovePlayer: noop,
    onSandboxPlayerChange: noop,
    onSandboxResetHeatmaps: noop,
    onSandboxExportHeatmap: noop,
    onSettingsChange: noop,
    onSettingsReset: noop,
    onSettingsApply: noop,
    onChangeLocale: noop,
    onChangeHotkey: noop,
    onModalClose: noop,
    onModalAction: noop,
    onToastDismiss: noop,
    onToastAction: noop,
    onReconnect: noop,
    onCancelReconnect: noop,
    onSendBugReport: noop,
    onContactSupport: noop,
  };
}
```

---

## Приложение Б: Хоткеи (desktop)

| Action | Default key | Описание |
|---|---|---|
| `centerOnAnt1..5` | `1`..`5` | Центрировать на муравье N |
| `cameraReset` | `Space` | Вернуться к обзору |
| `cameraPanUp` | `W` / `ArrowUp` | Сдвиг камеры |
| `cameraPanDown` | `S` / `ArrowDown` | |
| `cameraPanLeft` | `A` / `ArrowLeft` | |
| `cameraPanRight` | `D` / `ArrowRight` | |
| `cameraZoomIn` | `Q` / `+` | Зум вблизи |
| `cameraZoomOut` | `E` / `-` | Зум обзор |
| `toggleLeaderboard` | `Tab` (hold) | Полноэкранный лидерборд |
| `toggleMinimap` | `M` | Показать/скрыть |
| `openSettings` | `Esc` | Меню |
| `quickChat1..6` | `F1`..`F6` | Эмоции |
| `forfeit` | `Ctrl+Q` | Сдаться (с конфирмом) |
| `quickRematch` | `Enter` | Реванш на result-экране |

---

*Конец документа v1.0.*

*При вопросах или предложениях — оставляй комментарии прямо в этом файле перед интеграцией.*
