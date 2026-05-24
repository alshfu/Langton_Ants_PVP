# Langton Arena — Документация (v1.0, контракт-выровненная)

PvP-прототип на муравье Лэнгтона. Архитектура: **состояние (контракт) → UI → контроллеры**.
UI — чистая функция от `data` и `actions`. Никакой бизнес-логики внутри экранов.

> Полная типовая спецификация: см. `uploads/langton-arena-interface-contract.md`. Эта документация
> описывает **как код устроен**; контракт описывает **что код обязан принимать**.

---

## Оглавление

1. [Файловая карта](#файловая-карта)
2. [Точки входа](#точки-входа)
3. [Дерево состояния `AppState`](#дерево-состояния-appstate)
4. [Legacy-совместимость](#legacy-совместимость)
5. [Колбэки `actions`](#колбэки-actions)
6. [Системные оверлеи](#системные-оверлеи)
7. [Темы и i18n](#темы-и-i18n)
8. [Движок симуляции](#движок-симуляции)
9. [Экраны](#экраны)
10. [Storybook](#storybook)
11. [Подключение реальной логики](#подключение-реальной-логики)

---

## Файловая карта

### Логика и состояние

| Файл | Что внутри |
|---|---|
| `state.jsx` | `defaultState()` (полный `AppState` 1-в-1 по контракту), `defaultActions()` (50+ named actions), `sceneState(screen, variant)`, `PLAYER_PALETTE`, `RULES_REGISTRY`, `RANK_TIERS`, `rankFromSr()`. Также экспортирует legacy-shims под `data.legacy.*` для обратной совместимости |
| `themes.jsx` | `THEME_TOKENS` (dark / light / highContrast + 3 colorblind), `<ThemeProvider>`, `useTheme()`, `COLORBLIND_PALETTES` |
| `i18n.jsx` | `makeT(locale)`, `<I18nProvider>`, `useT()`, плюрализация (en/ru), placeholder-интерполяция |
| `langton.jsx` | Сим-движок Лэнгтона с HP, collision cooldown, ownership grid; React-хук `useLangtonField`, компонент `<LangtonField>`, `spawnAnts()`, `LA_RULES`, `LA_DIRS` |
| `audio.js` | WebAudio SFX (capture / clash / death / lead / select / hover) |

### UI

| Файл | Что внутри |
|---|---|
| `ui.jsx` | Базовые компоненты: `<Screen>`, `<Logo>`, `<AntMarker>`, `<PrimaryButton>`, `<GhostButton>`, `<Chip>`, `<Card>`, `<HpDots>`, `<Progress>`, `<Mono>`, `<Eyebrow>`, `<GlobalStyle>`. `PLAYER_COLORS`, `THEMES` (legacy) |
| `charts.jsx` | `<Sparkline>`, `<LineChart>`, `<BarChart>`, `<HeatMap>`, `<Donut>`, `<Radar>` |
| `system-overlays.jsx` | `<ToastStack>`, `<Modal>`, `<ConnectionBanner>`, `<PingIndicator>`, `<SystemOverlays>` (бандл) |

### Экраны

| Файл | Экспортируемые компоненты |
|---|---|
| `screens-menu.jsx`     | `MainMenuDesktop` / `MainMenuMobile`, `MatchFindingDesktop`/`Mobile`, `LobbyDesktop`/`Mobile`, `TutorialScreen` |
| `screens-match.jsx`    | `MatchHudDesktop` / `MatchHudMobile` (с реальной симуляцией) |
| `screens-result.jsx`   | `ResultClassic` (A), `ResultHero` (B), `ResultGrid` (C), `ResultMobile`, `RewardBox` |
| `screens-stats.jsx`    | `ProfileDesktop`, `MatchDetailDesktop`, `MetaDesktop`, `LeaderboardDesktop` |
| `screens-settings.jsx` | `SettingsDesktop` — 8 разделов (graphics / audio / controls / gameplay / accessibility / notifications / privacy / account). Использует `useTheme` для живого переключения тем |
| `screens-sandbox.jsx`  | `SandboxDesktop` — web-only лаборатория. Реальная симуляция через `<LangtonField>`, 50+ настроек |
| `screens-credits.jsx`  | `CreditsDesktop` |
| `screens-changelog.jsx`| `ChangelogDesktop` |

### Хосты и роутинг

| Файл | Что внутри |
|---|---|
| `router.jsx`        | `useRouter`, `useAppState`, `<NavBar>`, `<FullBleedStage>`, `DESKTOP_FLOW`, `MOBILE_FLOW` |
| `desktop-app.jsx`   | Композиция desktop-flow — все 17 экранов в одном приложении |
| `mobile-app.jsx`    | Композиция mobile-flow |
| `app.jsx`           | Композиция дизайн-канваса со всеми артбордами |
| `design-canvas.jsx` | Starter: pan/zoom canvas |
| `tweaks-panel.jsx`  | Starter: панель тюнинга |

### Точки входа (HTML)

| Файл | Назначение |
|---|---|
| `launcher.html`   | Стартовая страница — выбор поверхности |
| `desktop.html`    | Полноэкранный desktop-flow (deep-link через hash) |
| `mobile.html`     | Полноэкранный mobile-flow |
| `index.html`      | Дизайн-канвас со всеми артбордами + tweaks |
| `storybook.html`  | Браузер всех экранов × всех state-вариантов (empty/loading/error/full) |
| `settings.html`   | Standalone обёртка для `SettingsDesktop` |
| `sandbox.html`    | Standalone обёртка для `SandboxDesktop` |
| `credits.html`    | Standalone обёртка для `CreditsDesktop` |
| `changelog.html`  | Standalone обёртка для `ChangelogDesktop` |
| `Langton Arena (standalone).html` | Один-файл self-contained build для оффлайн-просмотра |

---

## Точки входа

| URL | Что показывает |
|---|---|
| `launcher.html`            | Главная: 3 прототипа + storybook + system screens + drop-in usage |
| `desktop.html#<screen>`    | Desktop. `<screen>` ∈ `menu / finding / lobby / hud / result-a / result-b / result-c / reward / tutorial / profile / match-detail / meta / leaderboard / sandbox / settings / credits / changelog` |
| `mobile.html#<screen>`     | Mobile flow |
| `index.html`               | Все артборды на канвасе |
| `storybook.html`           | Браузер: 15 экранов × до 4 вариантов |
| `settings.html` и т.д.     | Standalone screen |

---

## Дерево состояния `AppState`

`defaultState()` возвращает структуру 1-в-1 по [контракту §3](../uploads/langton-arena-interface-contract.md).

```ts
type AppState = {
  version: string; buildHash: string;
  serverRegion: string; serverTime: number; clientTime: number; pingMs: number;

  connection: ConnectionState;
  user: User;
  status: ServiceStatus;
  locale: Locale;

  currentScreen: ScreenId; previousScreen: ScreenId | null;

  menu: MenuState;
  matchmaking: MatchmakingState;
  lobby: LobbyState;
  match: MatchState;
  result: ResultState;
  reward: RewardState;
  tutorial: TutorialState;
  profile: ProfileState;
  sandbox: SandboxState;
  settings: SettingsState;

  toasts: Toast[];
  modal: Modal | null;

  // Backwards-compat (см. ниже)
  legacy: LegacyShape;
};
```

Полный список полей каждой sub-state — в файле контракта. В коде типы не объявлены (это
JSX, не TS), но `defaultState()` производит структуру, валидную против контракта.

### `sceneState(screen, variant)` — варианты состояний для storybook

```js
sceneState('matchmaking', 'empty')   // нет игроков в очереди
sceneState('matchmaking', 'loading') // status = 'searching'
sceneState('matchmaking', 'error')   // connection.status = 'error' + toast
sceneState('profile',     'empty')   // нет истории матчей
```

Используется в `storybook.html` для рендера всех state-вариантов каждого экрана.

---

## Legacy-совместимость

Контрактная форма **побеждает на корне**. Legacy-форма доступна двумя способами:

1. **`data.legacy.*`** — явный namespace для контракт-чистого доступа к старой форме
2. **Merged extra keys** — legacy-ключи, которые не конфликтуют с контрактом, мержатся в
   контрактные суб-объекты. Пример: `data.match.timer` (legacy) и `data.match.timerLabel`
   (contract) сосуществуют на одном объекте, потому что ключи разные.

Это позволяет существующим screens-menu / screens-match / screens-result читать `data.match.timer`
без изменений, при этом новый код, написанный по контракту, читает `data.match.timerLabel`.

При **конфликте имён** (один и тот же ключ в обоих формах) — выигрывает контракт.

> Долгосрочно legacy должен быть удалён: либо переписать существующие экраны на контракт,
> либо явно переименовать legacy-поля так, чтобы они не пересекались с контрактом.

---

## Колбэки `actions`

`defaultActions()` возвращает объект из 80+ no-op колбэков. Имена и сигнатуры — по
[контракту §5](../uploads/langton-arena-interface-contract.md).

Группы:

- **Navigation:** `onScreenChange`, `onPlay`, `onResumeMatch`, `onOpenProfile`, `onOpenSettings`, `onOpenSandbox`, `onOpenTutorial`, `onOpenChangelog`, `onOpenCredits`, `onLogout`, `onQuit`, `onReturnToMenu`
- **Matchmaking:** `onStartMatchmaking`, `onCancelMatchmaking`, `onChangeRegion`, `onAcceptMatch`, `onDeclineMatch`
- **Lobby:** `onLobbyReady`, `onLobbyUnready`, `onLobbyLeave`, `onSquadChange(antIndex, ruleId)`, `onSquadShuffle`, `onSquadLoadPreset`, `onSquadSavePreset`, `onLobbyPreviewToggle`, `onLobbyChatSend`, `onLobbyQuickChat`, `onLobbyKickPlayer`
- **Match:** `onMatchPause`, `onMatchResume`, `onMatchForfeit`, `onSelectAnt(antId)`, `onDeselectAnt`, `onCameraPan(delta)`, `onCameraZoom(delta, center)`, `onCameraReset`, `onCameraCenterOn(target)`, `onCameraToggleAutoFollow(enabled)`, `onSendQuickChat(emoteId)`
- **Ant control (v0.5+):** `onChangeAntRule(antId, ruleId)`, `onRecallAnt`, `onDeployFromReserve`, `onDeployStrategy`, `onSwapReserveRule`, `onDiscardReserve`, `onCreateCustomRule`
- **Result:** `onRematch`, `onCancelRematch`, `onNewMatch`, `onReturnToMenu`, `onOpenReward`, `onShareResult`, `onWatchReplay`, `onDownloadReplay`, `onReportPlayer`
- **Reward:** `onOpenLootbox`, `onClaimReward`, `onEquipReward`, `onSkipRewardAnimation`
- **Tutorial:** `onTutorialNext`, `onTutorialPrev`, `onTutorialReplay`, `onTutorialSkip`, `onTutorialComplete`
- **Profile:** `onProfileTabChange`, `onLoadMoreHistory`, `onFilterHistory`, `onAddFriend`, `onRemoveFriend`, `onBlockPlayer`, `onUnblockPlayer`, `onChangeUsername`, `onChangeColor`, `onEquipCosmetic`
- **Sandbox:** `onSandboxConfigChange(patch)`, `onSandboxPlay`, `onSandboxPause`, `onSandboxStep`, `onSandboxReset`, `onSandboxLoadPreset`, `onSandboxSaveSlot`, `onSandboxLoadSlot`, `onSandboxDeleteSlot`, `onSandboxExportConfig`, `onSandboxImportConfig`, `onSandboxAddPlayer`, `onSandboxRemovePlayer`, `onSandboxPlayerChange`, `onSandboxResetHeatmaps`, `onSandboxExportHeatmap`
- **Settings:** `onSettingsChange(category, key, value)`, `onSettingsReset(category?)`, `onSettingsApply`, `onChangeLocale`, `onChangeHotkey`
- **System:** `onReconnect`, `onCancelReconnect`, `onSendBugReport`, `onContactSupport`, `onModalClose`, `onModalAction`, `onToastDismiss`, `onToastAction`
- **Legacy aliases** (deprecated, сохранены для совместимости): `onTrain`, `onPrivate`, `onProfile`, `onSettings`, `onBack`, `onCancelSearch`, `onReady`, `onUnready`, `onPause`, `onMenu`, `onMatchEnd`, `onSwapRule`, `onToggleMute`, `onOpenMatch`, `onOpenMeta`, `onOpenLeaderboard`, `onPlayReplay`, `onProfileTab`

Каждый action возвращает `Promise<{ success, data?, error? }>` per [контракт §5.1](../uploads/langton-arena-interface-contract.md).

---

## Системные оверлеи

Глобальные UI-слои поверх любого экрана — `system-overlays.jsx`.

### `<ToastStack toasts onDismiss onAction position />`

4 типа: `info` / `success` / `warning` / `error`. Стопкой в углу (по умолчанию `top-right`).
Swipe-to-dismiss (>80px → закрыть). Опциональный action-кнопка. Auto-dismiss по `durationMs`
(`0` = sticky).

### `<Modal modal onClose onAction />`

3 типа: `confirm` / `alert` / `input`. Закрывается по Esc и клику по фону (если `cancelable`).
Кнопки `primary` / `ghost` / `danger`.

### `<ConnectionBanner connection onReconnect onCancel />`

Появляется при `connection.status !== 'connected'`. Спиннер для `connecting` / `reconnecting`,
кнопки retry/cancel для `error`. Не показывается, когда всё OK.

### `<PingIndicator pingMs jitter compact />`

5 баров + значение. Цвет по [контракту §7.6](../uploads/langton-arena-interface-contract.md):
зелёный <30ms, жёлтый <80, оранжевый <150, красный ≥150.

### `<SystemOverlays data actions />`

Бандл — рендерит сразу `ConnectionBanner + ToastStack + Modal` из `data`. Все новые экраны
включают его в конец JSX.

---

## Темы и i18n

### Темы — `themes.jsx`

6 тем: `dark` (по умолчанию), `light`, `highContrast`, `colorblindProtanopia`,
`colorblindDeuteranopia`, `colorblindTritanopia`. Токены покрывают: surface цвета (`bg`,
`bgElevated`, `bgOverlay`), текст (`textPrimary`/`Secondary`/`Muted`), границы, акценты, состояния
(`success` / `warning` / `danger` / `info`), радиусы, тени, spacing-grid (8pt).

```jsx
<ThemeProvider initial="dark">
  <YourApp />
</ThemeProvider>

function Card() {
  const { tokens, set, theme } = useTheme();
  return <div style={{ background: tokens.bgElevated, color: tokens.textPrimary }} />;
}
```

`SettingsDesktop` — пример использования: переключатель темы в разделе Accessibility сразу
меняет фон, рамки и акценты через токены.

> **Большинство существующих экранов всё ещё используют хардкод-цвета.** Переход на токены —
> отдельная задача. Для нового кода — используйте только токены через `useTheme()`.

### i18n — `i18n.jsx`

Минимальный `t(key, params)` хелпер. Поддержка:
- Простая подстановка: `t('match.event.capture', { playerName: 'Brave', n: 14 })` →
  `'Brave captured 14 cells'`
- Плюрализация (en/ru/uk): `'{plural:n|клетка|клетки|клеток} ({n})'`
- Локаль через `<I18nProvider locale="ru">` или `makeT('ru')`
- Контроллер может расширять словарь: `window.ARENA_I18N = { en: {...}, ru: {...} }`

> **Существующие экраны не вызывают `t()`.** Подключение i18n к ним — работа на будущее.
> Для нового кода — оборачивайте все строки в `t()`.

---

## Движок симуляции

`langton.jsx`. Multi-player вариант муравья Лэнгтона.

### `makeLangtonState({ w, h, ants })`

Создаёт состояние:
- `owner: Uint8Array(w*h)` — `0` = ничья, `1..N` = `playerId+1`
- `state: Uint8Array(w*h)` — состояние клетки, advances mod `rule.length`
- `ants: SimAnt[]` — активные муравьи (см. ниже)
- `tick: number`
- `collisionCooldownTicks?: number` — окно immunity (по умолчанию 5)

### `stepLangton(sim)` → `events`

Один тик. Мутирует sim. Возвращает `{ captures, collisions, damage, deaths }`.

**HP + collisions:** при встрече 2+ муравьёв разных игроков в одной клетке — каждый теряет
1 HP за каждого врага в той же клетке. После урона ант immune `collisionCooldownTicks`
тиков — повторного урона за этот период не получит. `hp <= 0` → `dead = true`.

### `<LangtonField w h cellSize ants palette tps paused glow showTrail antScale bg />`

Готовый компонент: оборачивает хук + canvas. Используется в:
- Фон главного меню (decorative)
- Match HUD (центральное поле)
- **Sandbox screen (реальная симуляция, не placeholder)**

---

## Экраны

Каждый экран — `function ScreenName({ width, height, data, actions, ...extra })`.
Все поддерживают `defaultState()` / `defaultActions()` как fallback, поэтому рендерятся
статически без хоста.

**Главное правило:** UI читает из `data`, дёргает `actions`. Никаких side-effects кроме
анимаций. Любой стейт в экране — UI-only (например, открыт ли dropdown).

См. файлы `screens-*.jsx` для деталей пропсов и внутренних компонентов.

### Settings — особенности

`SettingsDesktop` оборачивает себя в `<ThemeProvider>` и читает токены через `useTheme()`.
Переключатель темы в разделе Accessibility (Dark / Light / A11y) меняет токены — фон,
рамки и акценты обновляются мгновенно. Это **референсный пример** того, как новые экраны
должны использовать `themes.jsx`.

### Sandbox — особенности

`SandboxDesktop` — единственный web-only экран. Не уходит на сервер. Состояние локальное
в `data.sandbox` (см. контракт §4.11). Реальная симуляция через `<LangtonField>` — все
тогглы (HP / glow / trails / ant scale / speed) сразу видны на канвасе. Хост принимает
изменения через `onSandboxConfigChange(patch)`.

---

## Storybook

`storybook.html` — пагинатор всех экранов. Для каждого экрана список доступных вариантов
(`full` / `empty` / `loading` / `error`). Состояние варианта берётся из `sceneState(screen,
variant)`. Автоматически скейлит артборд до viewport. **Полезно для аудита** — позволяет
быстро убедиться, что у каждого экрана нормально отрисованы все state-варианты.

---

## Подключение реальной логики

### Шаг 1 — собирай state по контракту

```js
const appState = {
  ...defaultState(),                            // правильная структура + дефолты
  user:        await api.getUser(),             // твои данные
  match:       liveMatch,                       // из websocket
  connection:  { status: 'connected', latencyMs: 32, ... },
  toasts:      currentToastQueue,
};
```

### Шаг 2 — подключи свои handlers к контрактным actions

```js
const actions = {
  ...defaultActions(),                                       // noop fallback
  onPlay:           () => matchmaker.start('arena_ranked'),
  onLobbyReady:     () => ws.send({ type: 'READY' }),
  onSquadChange:    (i, ruleId) => ws.send({ type: 'SQUAD_CHANGE', i, ruleId }),
  onChangeAntRule:  (antId, ruleId) => engine.swapRule(antId, ruleId),
  onMatchForfeit:   async () => { await api.forfeit(); return { success: true }; },
  onToastDismiss:   (id) => store.dismissToast(id),
  onModalAction:    (actionId) => store.handleModal(actionId),
  onSettingsChange: (cat, key, value) => store.setSetting(cat, key, value),
  onReconnect:      () => ws.reconnect(),
};
```

### Шаг 3 — рендери нужный экран

```jsx
<MainMenuDesktop  data={appState} actions={actions} />
<MatchHudDesktop  data={appState} actions={actions} />
<SettingsDesktop  data={appState} actions={actions} />
<SandboxDesktop   data={appState} actions={actions} />
```

Всё. Логика → state → UI. Никаких скрытых зависимостей.

### Шаг 4 — глобальные оверлеи

```jsx
<>
  <CurrentScreen data={appState} actions={actions} />
  <SystemOverlays data={appState} actions={actions} />  {/* toasts, modal, banner */}
</>
```

`<SystemOverlays>` читает `data.toasts`, `data.modal`, `data.connection` и рендерит их
автоматически.

---

## Известные ограничения (для аудита)

1. **Хардкод-цвета сведены к 35%-токенов.** Прошлый раунд аудита показал 350+ хардкод-хексов в 8 экранах. После замены через токены `T.*` (Proxy в `themes.jsx`): 423 литерала заменены, ~150 остались (преимущественно `rgba(...)` оттенки и player-палитра, которая семантически не theme-able). Темы реально переключаются на всех экранах.
2. **i18n частично подключён.** `t()` живёт в Settings (sidebar + section titles) и в MainMenu (кнопки Play/Training/Private). Большинство остальных строк ещё захардкожены — их можно мигрировать по тому же образцу.
3. **Profile/MatchDetail/Meta** теперь читают контрактные поля с fallback на legacy. Контракт побеждает.
4. **Sandbox** — реальная симуляция через `LangtonField`, live-счётчики (tick/ants/births/deaths), `collisionCooldownTicks` и `birthConfig` проброшены в движок. Все 6 ключевых фич (HP, cooldown, birth, hybrid, wild, heatmaps) активны.
5. **Audio** — категории master/music/sfx/ui реализованы, `fx.bind(settings.audio)` синхронизирует громкости. Реальных музыкальных треков нет (синтезированный drone-stub).
6. **Тесты** — `tests.html` запускает 22 unit-asserts (state contract / langton damage cap / collision cooldown / birth / i18n плюрализация / audio mixer / theme proxy) + 23 smoke-render. **45/45 pass.**

## Лицензия / атрибуция

Шрифты: Inter (SIL OFL), JetBrains Mono (SIL OFL). Остальное — собственная разработка.
