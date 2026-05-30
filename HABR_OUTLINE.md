# Habr-статья: outline + материалы для самостоятельного написания

> Это **строительные блоки**, не готовая статья. `HABR_ARTICLE.md` остаётся как
> reference. Здесь — структура, цифры, code snippets и tips для habr-стиля.

---

## Targeted audience

- Russian-speaking devs, mostly backend/fullstack
- Хабр любит: deep tech detail, honest tradeoffs, реальные failure stories,
  конкретные benchmarks
- Хабр не любит: маркетинг, "best practices" без context, ChatGPT-стиль ("в этой
  статье мы рассмотрим..."), AI-generated content

---

## Stylistic dos / don'ts

### Habr-friendly
- Личная история: "Я сидел в кафе...", "Когда у меня сломалось..."
- Конкретные числа: "20 минут", "12 KB", "10 TPS"
- Acknowledged tradeoffs: "Я выбрал X не потому что лучше, а потому что Y"
- Failure with lesson: "Сначала я попробовал A. Не сработало потому что B. Перешёл на C"
- Code blocks с syntax highlighting

### Bot-detection triggers (избегай)
- Длинные структурированные lists с одинаковыми marker'ами
- Универсальные intro/outro фразы ("В этой статье мы рассмотрим...")
- Чрезмерная формальность ("Следует отметить, что...")
- Идеально структурированные параграфы каждый ~3 предложения
- Эмодзи в headers (👋 🚀 🎯)
- Корпоративный tone (всё в страдательном залоге)
- Markdown tables на каждый chunk данных

### Habr-style alternatives
- Вместо листа → narrative + 1-2 примера
- Вместо intro → сразу in media res ("Открыл я как-то...")
- Вместо "следует отметить" → "Тут есть нюанс"
- Variable paragraph length: одно предложение → 5 предложений → 2 предложения
- Без эмодзи в заголовках, можно изредка в тексте

---

## Suggested article structure (~ 3000-5000 words)

### Заголовок (варианты)
1. **"Real-time PvP на клеточном автомате: разбор архитектуры за 34 дня"**
2. **"Сделал из Langton's Ant multiplayer-игру. Что узнал про детерминизм, WebSocket и procedural audio"**
3. **"PvP на муравье Лэнгтона: как 94 дня кода превратились в 538 тестов и 71 КБ gzip"**

### Lead (первый абзац) — главное

Здесь должен быть hook. Не "В этой статье...", а сразу про **боль/идею**.

Пример (перепиши своим голосом):

> Зимой 2026 я думал про cellular automata. Точнее — про муравья Лэнгтона. Три
> правила, бесконечная сложность. И почему-то никто не делает из них PvP.
> Решил исправить.

Или:

> 94 дня назад я начал делать игру на Langton's Ant. 60 дней пилил песочницу,
> 34 — multiplayer. Сейчас она живёт на VPS в Aeza за $5/мес и слушает на
> wss://alshfu.com. Расскажу что построил, что облажалось, и куда дальше.

---

### Section 1: Что такое Langton's Ant и зачем PvP

**Цель**: ввести читателя в курс дела без перегруза.

**Содержание (300-500 слов):**
- Чем интересен Langton's Ant — 3 правила, эмерджентность через ~10k шагов
- Почему PvP на этом нетривиально:
  - Детерминизм должен быть perfect (иначе client/server desync)
  - Real-time inputs (deploy) надо apply'ть консистентно
  - Win condition не очевиден — кто победил в эмерджентной системе?
- Краткое описание result: 2 игрока, 60×60 поле, 30 секунд, capture territory

**Code/visual:**
```
Базовое правило одного муравья:
1. Если клетка белая → поверни направо, перекрась в чёрный, шагни вперёд
2. Если клетка чёрная → поверни налево, перекрась в белый, шагни вперёд

После ~10000 шагов появляется "highway" — упорядоченный паттерн из хаоса.
```

Если можешь — вставь свой gif с двух-муравьёвой симуляцией. Если нет —
ссылка на live demo.

---

### Section 2: Архитектура (monorepo + shared engine)

**Цель**: объяснить главное design decision.

**Содержание (500-700 слов):**
- Структура repo (можно показать tree)
- Почему shared engine между client и server — **главный insight**
- Stack кратко: React+Vite, Node+ws, TypeScript strict, без Fastify/Express

**Ready-to-use snippets:**

```
langton-arena-backend/
  core/                  ← @langton/core (engine, contracts)
  services/mvp-server/   ← WebSocket PvP server
langton-arena-web/       ← Vite + React frontend
```

**Тон для twist'а**: "Сначала я думал client и server иметь свой engine, потом
понял что любая мелкая дивергенция через 100 ticks даст накапливающийся drift.
Перенёс в shared workspace package — и оно окупилось в 3 разных местах."

---

### Section 3: Детерминизм — главное архитектурное решение

**Цель**: объяснить почему deterministic engine = unlock для всех advanced features.

**Содержание (500-700 слов):**
- Личная история: сначала был `Math.random()` в hot path
- Что сломалось когда хотел добавить step-back (Stage 3)
- Как переделал — детерминированная функция от `(seed, tick, ant.id)`

**Что unlocked:**
1. Replay = inputs (не states) → 200 байт вместо MB
2. Replay сам себя validates (bit-identical playback = детерминизм OK)
3. URL-shareable через `lz-string` + base64
4. Server-driven ticks без full state sync — client держит свой engine,
   server шлёт только tick number + new deploys

**Cool number**: 15/15 встроенных presets play back bit-identical через replay.

---

### Section 4: PvP-протокол — discriminated unions через TypeScript

**Цель**: показать что строгая типизация = живая документация.

**Содержание (400-600 слов):**

**Code (можно вставить как есть):**

```typescript
type ClientMessage =
  | { type: 'join_room'; roomCode: string; nickname: string; locale: string;
      resumeToken?: string }
  | { type: 'set_ready'; ready: boolean }
  | { type: 'deploy'; x: number; y: number; tick: number }
  | { type: 'request_rematch' }
  | { type: 'ping'; t: number }
  | { type: 'leave_room' };

type ServerMessage =
  | { type: 'room_joined'; clientId: string; players: PlayerInfo[];
      resumeToken: string; resumed?: boolean }
  | { type: 'match_starting'; countdownMs: number; config: SandboxConfig;
      seed: number; matchId: string }
  | { type: 'match_tick'; tick: number; deploys: DeployAction[] }
  | { type: 'match_ended'; result: MatchResult; replayUrl: string;
      replay?: Replay }
  // ... остальные 8 типов
```

**Key point**: exhaustive switch через `never`-trick. Если добавлю новый kind и
забуду handler — компилятор orёт.

```typescript
default: {
  const _exhaustive: never = msg;
  void _exhaustive;
}
```

**Анекдот**: "Когда добавлял rematch flow (Day 23), забыл handle новых
сообщений на client — TypeScript показал точные две локации где сломал.
Если бы не strict union, отлавливал бы баги в production вместо compile-time."

---

### Section 5: Client-side prediction — optimistic ghosts

**Цель**: rассказать про latency hiding pattern.

**Содержание (400-600 слов):**

**Проблема**: между click и появлением ant'а ~100ms (RTT/2 + tick interval).
На 10 TPS это полтика — заметно лагает.

**Решение**: translucent "ghost" рисуется сразу. Server echo → ghost удаляется
(real ant спавнится). Server reject → ghost откатывается + toast.

**Хитрость**: matching ghost к server echo не "по индексу" а **по {x, y, tick}
context**. Server может reorder deploys в одном tick'е.

**Code**:

```typescript
export function reconcileGhosts(
  ghosts: Ghost[],
  serverDeploys: DeployAction[],
): Ghost[] {
  return ghosts.filter((g) => {
    return !serverDeploys.some(
      (d) => d.playerIdx === g.playerIdx
          && d.x === g.x && d.y === g.y
          && Math.abs(d.tick - g.tick) <= 2  // small jitter tolerance
    );
  });
}
```

**Insight**: помогло то что я извлёк это в pure functions. 26 тестов покрыли
edge cases без real WebSocket.

---

### Section 6: Reconnect grace + resume tokens

**Цель**: production reliability pattern.

**Содержание (300-500 слов):**

**Сценарий**: Wi-Fi мигнул на 5 секунд. Если матч сразу заканчивает с forfeit
— UX мусор. Если ждёт forever — оппонент в spinner.

**Решение**: grace period 15 секунд + resume token (UUID в sessionStorage).

**Flow**:
1. WS close → `player.disconnected = true`, `setTimeout(forfeit, 15000)`
2. Server broadcast → opponent видит "Opponent reconnecting..."
3. Client auto-reconnect (exponential backoff)
4. Send `join_room` с saved `resumeToken`
5. Server matches token → восстанавливает slot
6. Send `match_resume_state` (config + seed + deployTimeline)
7. Client replays engine forward → catches up

**Key insight**: без детерминизма (Section 3) это бы не работало. Client может
replay forward только если engine идентичен server'у.

---

### Section 7: Procedural audio — zero ассетов

**Цель**: показать non-obvious архитектурное решение.

**Содержание (700-1000 слов) — может быть longest section, тема рідко покрыта.**

#### Subsection 7.1: Layered SFX

**Code (можно use):**

```typescript
function playDeploy(c: AudioContext, t: number): void {
  // Body click: sine с pitch sweep 800→300Hz
  osc(c, 'sine', 800, 300, t, 0.001, 0.005, 0.04, 0.35, 1, 0);
  // High transient: square 2200→1400Hz
  osc(c, 'square', 2200, 1400, t, 0.001, 0.003, 0.025, 0.18, 1, 0);
  // Tactile noise через 1200Hz HP filter
  noiseBurst(c, t, 0.018, 0.15, 1200, 1, 0);
}
```

Victory sound = 16 oscillators. Bus topology: master → dry+wet через
ConvolverNode IR (synthesized 1.4s noise decay).

#### Subsection 7.2: FM-bell для "tie" sound

**Insight**: frequency modulation даёт inharmonic overtones — как у настоящего
колокола.

```typescript
function fmBell(c: AudioContext, carrierFreq: number, modRatio: number,
                modIndex: number, t: number, ...): void {
  const carrier = c.createOscillator();
  const mod = c.createOscillator();
  mod.frequency.value = carrierFreq * modRatio;
  const modGain = c.createGain();
  modGain.gain.value = modIndex;
  mod.connect(modGain);
  modGain.connect(carrier.frequency);  // ← magic here
  // ... envelope, routing
}
```

#### Subsection 7.3: Dynamic music — lookahead scheduler

**Главный technical point**: pattern из Chris Wilson 2013 (ссылка на оригинал).

**Проблема**: `setTimeout` имеет 4ms grain + GC pauses → audio jitter.

**Решение**: two clocks. JavaScript timer проверяет каждые 25ms что нужно schedule
на следующие 100ms через `AudioContext.currentTime`. Sample-accurate.

```typescript
function tick() {
  while (this.nextStepTime < this.ctx.currentTime + 0.1) {
    this.scheduleStep(this.currentStep, this.nextStepTime);
    this.nextStepTime += 0.125;  // 16th note at 120 BPM
    this.currentStep = (this.currentStep + 1) % 32;
  }
}
setInterval(tick, 25);
```

4 voices (bass + pad + drum + lead), 3 chord progressions по mood (neutral /
winning / losing). Intensity driven by tick progress + scoreboard delta.

**Lesson** (для финала section): procedural audio стоит ~8 KB кода. Один mp3
backing track — ~500 KB. Tradeoff обоснован для web-game.

---

### Section 8: Smart bot (опционально, можно пропустить если длинно)

**Цель**: показать что shared engine окупается ещё раз.

**Содержание (400-600 слов):**

**Архитектура**: client-side bot через **secondary WebSocket** в той же tab.
Joins room как regular player, server видит как обычного — ZERO server changes.

**Sim tracking**: бот имеет свой `SimState` через тот же shared engine. На
каждый `match_tick` catches up + applyDeployAction.

**Frontier targeting** (Hard difficulty):
```typescript
findFrontierCells(sim, mySlotIdx, strictEnemy=true)
```

Returns мои клетки adjacent к enemy. Hard deploys 70% времени на frontier
(остальные 30% random для unpredictability).

**Adaptive panic mode**: если opp leads >5% → interval halved.

**Tests**: 41 unit-test без real WS. Custom RNG parameter для determinism:
```typescript
expect(pickDeployLocation(60, 60, 0, 'hard', () => 0.5))
  .toEqual({ x: 45, y: 45 });
```

---

### Section 9: VPS deploy story (можно сделать standalone мини-секцией)

**Цель**: real-world experience report.

**Содержание (300-400 слов):**

**Initial plan**: Render.com free tier для mvp-server.

**Reality**: Render требует credit card "for verification" даже на free.
Карта не привязалась с первой попытки. Потерял день.

**Pivot**: Aeza VPS, ~$5/мес, Ubuntu 24.04.

**Setup (полдня):**
```bash
apt install nodejs npm nginx certbot python3-certbot-nginx
# nginx config с WS upgrade + reverse proxy на 8080
certbot --nginx -d alshfu.com  # Let's Encrypt cert
systemctl enable --now langton-arena
# DNS пропагация 2 часа
```

**Lesson**: для MVP backend сервиса **VPS > PaaS**. Render заявлял free,
требовал кредитку. VPS требует ssh+nginx+certbot — навыки которые не уйдут.

---

### Section 10: Numbers

**Цель**: концентрированные metrics для впечатления.

**Готовый блок (можно use):**

- **Bundle**: 231 KB raw JS / 71 KB gzip
- **538 unit tests**: 301 web + 131 core + 106 mvp-server
- **0 TypeScript errors** в strict mode (noUncheckedIndexedAccess)
- **94 days** total (Sandbox 60 + PvP 34)
- **Server**: 192 MB Docker image, 50 MB RAM idle, 80 MB peak
- **Latency**: ~30ms RTT (Aeza → EU client), 10 TPS server tick
- **Audio**: 0 ассетов, 8 KB raw синтезатора, 16 voices в victory fanfare
- **Determinism**: 15/15 presets play back bit-identical через replay

---

### Section 11: Lessons learned

**Цель**: что унесёт читатель.

**Структура**: 3-5 lessons, каждая 2-3 предложения. Не больше — long lists
утомительны.

**Готовые lessons (выбери 3-5 которые resonate):**

1. **Детерминизм окупается через 5+ фич** — replay, bot, reconnect, debug,
   test reproducibility. Заплати один раз, бери дивиденды.

2. **Shared engine между client и server** — самое важное архитектурное
   решение. Без него bot был бы primitive, replay был бы heavy, sync был
   бы fragile.

3. **Bot fallback — MVP requirement** для multiplayer. Без него 99% drop-off
   на "wait for friend". Не "later feature".

4. **Win condition определяет всю стратегию**. Time-based = race optimization.
   Hold-based = sustained dominance. Это game design decision, не
   implementation detail.

5. **Procedural audio scales 10x perceived quality per 2x code**.
   Day 1: 60 строк, 6 events (basic). Day later: 400 строк, dynamic music.
   Non-linear quality scaling.

---

### Section 12: Links + closing

**Готовый блок:**

- 🎮 Play: https://alshfu.github.io/Langton_Ants_PVP/
- 📦 GitHub (MIT): https://github.com/alshfu/Langton_Ants_PVP
- 📓 Devlog (94 days): https://github.com/alshfu/Langton_Ants_PVP/blob/main/DEVLOG.md
- 🗺️ Roadmap: https://github.com/alshfu/Langton_Ants_PVP/blob/main/ROADMAP.md

**Closing tone**: invite engagement без маркетинга.

> Если поиграешь — отпишись в комментариях что показалось confusing или
> delightful. Bug reports → GitHub issues. Если форкнешь и сделаешь что-то
> крутое — пиши, посмотрю.

---

## Tips для habr-формы

### Заголовок
- Длина: 60-100 символов
- Без эмодзи (Habr рендерит их странно в title)
- Конкретика > обобщения. **"Сделал PvP на муравье Лэнгтона за 94 дня"** >
  "Опыт разработки игры"

### Хабы (выбрать 3-4 минимум)
Рекомендую:
1. **Разработка игр** — основной
2. **JavaScript** или **TypeScript**
3. **WebSocket** или **Совершенный код**
4. Optional: **React**, **Node.js**, **Open source**

Не бери "Учебный процесс в ИТ" или похожие если не academic — не зайдёт.

### Теги (5-10)
- `langton's ant`
- `cellular automata`
- `клеточные автоматы`
- `pvp`
- `websocket`
- `react`
- `typescript`
- `webaudio`
- `multiplayer`
- `procedural generation`
- `game development`

### Сложность
Скорее всего **"Средний"** — для дев-аудитории.

### Превью текст (первые 4-5 предложений)
Это что показывается в hub feed. **Самое важное**. Не "В этой статье...",
а сразу про проект + hook. Используй открывающий параграф из Section 1
вместо стандартного introductory paragraph.

### Перед publish
1. Save as draft → preview → проверить:
   - Code blocks с syntax highlighting OK?
   - Headers иерархия консистентна (h2 → h3 → h4)
   - Лishes (списки) рендерятся правильно
   - URLs кликабельны
2. Прочитать вслух — звучит ли как ты говоришь
3. Заменить любые "следует отметить", "в данной статье", "вышесказанное"
4. Запостить в момент peak Хабра — будни 10-12 МСК или 18-21 МСК

---

## Что я могу делать пока ты пишешь

- Если нужно — переписать конкретную секцию своими словами (но не всю
  статью — это снова AI-flagged)
- Подгенерить дополнительные code snippets из любой части кодовой базы
- Проверить факты (например "правда ли что Reddit поймал нас на user-agent"
  — могу подтвердить из git log)
- Подсчитать ещё metrics из проекта
- Help с tag selection
- Помочь с заголовком (3-5 вариантов)

Открой Habr publish-форму, начни заполнять. Когда упрёшься во что-то —
напиши, помогу с куском.
