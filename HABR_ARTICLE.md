# Langton's Ant как PvP-игра: 34 дня архитектуры, 538 тестов, ноль ассетов

**TL;DR**: построил real-time PvP-игру на основе клеточного автомата Лэнгтона. Detrandomized engine, WebSocket-протокол, client-side prediction, procedural audio (включая 4-голосный sequencer), client-side бот с sim tracking, custom win conditions. Frontend на Vite+React+TypeScript, server на pure `ws` без Fastify. Live: https://alshfu.github.io/Langton_Ants_PVP/. Source: MIT, https://github.com/alshfu/Langton_Ants_PVP.

---

## Откуда это всё

Я люблю клеточные автоматы. Langton's Ant — самый поэтичный из них: три правила (если на белом — поверни направо, перекрась, шагни вперёд; на чёрном — налево), но через ~10000 ходов муравей вдруг начинает строить «highway». Бесконечная сложность из ничего.

Думал давно: а что если их **два**? И ими управляют **два игрока**? Получается real-time территориальный PvP.

Так появился Langton Arena. 34 дня разработки только Stage 8 (PvP MVP), до этого 60 дней Stages 1-7 на песочнице. Сейчас у проекта:

- 538/538 тестов (301 web + 131 core + 106 mvp-server)
- 231 KB raw JS / 71 KB gzip bundle
- 0 production-инцидентов за 5 дней live
- 0 публичных пользователей (об этом отдельно)
- 0 audio-ассетов — всё procedurally synthesized

Live: https://alshfu.github.io/Langton_Ants_PVP/  
GitHub: https://github.com/alshfu/Langton_Ants_PVP

Дальше — про архитектурные решения, которые выручили (и одно которое нет).

---

## Игровая механика в 30 секунд

Два игрока, поле 60×60, торическая топология. У каждого 3 муравья на старте. Муравьи движутся по rules Лэнгтона: бесконечная сложность из локальных правил.

Когда муравей шагает по клетке — она перекрашивается в его цвет. **Захват территории**. Игрок может в любой момент кликнуть на клетку и положить туда нового муравья из «мешка» (резерв пополняется со временем).

Через 30 секунд побеждает тот, у кого больше клеток. Или (custom mode из Day 34): первый, кто захватит >50% и продержится 100 секунд подряд — теряет лидерство, счётчик обнуляется.

```
Игрок A (красный): 62.4%  🐜5
Игрок B (синий):   37.6%  🐜3
                          ⏱ 12s / 30s
```

---

## Архитектура: monorepo с shared engine

```
langton-arena-backend/
  core/                    ← @langton/core (engine, contracts, helpers)
  services/mvp-server/     ← WebSocket PvP server
langton-arena-web/         ← Vite + React frontend
```

Frontend и server **используют тот же engine** через workspace package `@langton/core`. Никаких реализаций "движок на клиенте и движок на сервере, постарайтесь чтобы совпадали". Один codepath — server validates, client predicts, оба считают идентичный результат.

Это окупилось **трижды**:
1. **Replay PvP-матча** — формат тот же что и Sandbox replay (deploy actions + seed + config)
2. **Бот** имеет свой engine instance в client-side — может smart positioning без специальной server'ной поддержки
3. **Reconnect грэйс** — клиент replay'ит deploys с известного tick'а, никаких state snapshots

Stack:
- **Frontend**: React 18 + TypeScript 5 (strict) + Vite 5. State через Context + useReducer (без Redux).
- **Backend**: Node.js + `ws` пакет (никакого Fastify — голый TCP + JSON). Single-process, in-memory state.
- **Engine**: TypeScript shared package. Typed arrays для grid state (Uint8Array owner + Uint8Array state).
- **Protocol**: JSON через WebSocket. Не MessagePack — пока bandwidth не bottleneck.

VPS: Aeza, Ubuntu 24.04, nginx → wss reverse proxy, Let's Encrypt сертификат, systemd service. Всё за полдня после отказа от Render (об этом ниже).

---

## Engine: детерминизм как архитектурное решение

Главный insight всего проекта: **движок симуляции должен быть полностью детерминирован**.

В первой версии (Stage 2) я делал `Math.random()` в hot path для random tie-breaking при коллизиях. Симуляция работала. Но потом, в Stage 3, я хотел добавить step-back (откатить N тиков назад). Невозможно — random state потерян.

Перепрошёл всю логику и убрал random'ы. Где нужна "случайность" — детерминированная функция от `(seed, tick, ant.id)`. Получается **bit-identical** replay при одинаковых inputs.

Это позже дало:

- **Replay = последовательность inputs + seed + config**. Размер: 200-2000 байт против ~MB при snapshot-based replay.
- **Replay сам себя валидирует**: если воспроизводится bit-identical — детерминизм OK. Если нет — баг.
- **URL-shareable replays**: через `lz-string` + URL-safe base64 в query parameter.
- **Server-driven ticks без полной state sync**: client держит свой engine, server шлёт только `match_tick` с приращением deploys; client применяет → state совпадает.

Это работает потому что движок написан на **shared** package'е `@langton/core`. Если бы код движка дублировался между client и server, любая мелкая дивергенция через несколько тиков давала бы накапливающийся drift. Один codepath — один результат.

---

## PvP-протокол: 14 message types

WebSocket. JSON. Discriminated unions через TypeScript.

```typescript
type ClientMessage =
  | { type: 'join_room'; roomCode: string; nickname: string; locale: string;
      resumeToken?: string }
  | { type: 'leave_room' }
  | { type: 'set_ready'; ready: boolean }
  | { type: 'deploy'; x: number; y: number; tick: number }
  | { type: 'ping'; t: number }
  | { type: 'request_rematch' };

type ServerMessage =
  | { type: 'room_joined'; clientId: string; players: PlayerInfo[];
      resumeToken: string; resumed?: boolean }
  | { type: 'room_updated'; players: PlayerInfo[] }
  | { type: 'match_starting'; countdownMs: number; config: SandboxConfig;
      seed: number; matchId: string }
  | { type: 'match_started'; matchId: string; startedAt: number;
      serverEngineVersion: string }
  | { type: 'match_tick'; tick: number; deploys: DeployAction[];
      checksum?: string }
  | { type: 'match_ended'; result: MatchResult; replayUrl: string;
      replay?: Replay }
  | { type: 'match_resume_state'; matchId: string; tick: number;
      config: SandboxConfig; seed: number; deployTimeline: DeployAction[] }
  | { type: 'rematch_status'; bothAgreed: boolean; agreedClientIds: string[] }
  | { type: 'rematch_reset' }
  | { type: 'pong'; t: number; serverT: number }
  | { type: 'error'; code: string; message: string; locale: string;
      context?: { x?: number; y?: number; tick?: number } };
```

В типах вся документация. Каждый case проверяется TypeScript-ом через exhaustive switch:

```typescript
function dispatch(msg: ClientMessage): void {
  switch (msg.type) {
    case 'join_room': return handleJoinRoom(msg);
    case 'leave_room': return handleLeaveRoom();
    // ...
    default: {
      const _exhaustive: never = msg;
      void _exhaustive;
    }
  }
}
```

Если я добавлю новый kind и забуду handler — компилятор orёт. Это окупилось десяток раз когда я добавлял rematch, request_rematch, и другие.

Локализация: `error.message` приходит сразу на нужном языке. Сервер берёт `locale` из `join_room` и использует таблицу переводов (10 локалей × ~50 ключей). Никакого client-side `i18next` для server-originated сообщений.

---

## Client-side prediction: optimistic ghosts

При клике "deploy ant в клетку (x, y)" между event'ом и появлением реального ant'а проходит ~100ms: round-trip serial + server tick interval. При 10 TPS это полтика — заметно лагает.

Решение: рисуем translucent "ghost" в клетке мгновенно. Когда server echo'нет deploy в `match_tick.deploys` — ghost удаляется (real ant спавнится). Если server отверг (`error('INVALID_DEPLOY')`) — ghost откатываем + toast `Deploy rejected`.

Реконciliация оказалась сложнее чем казалось из статей. Mapping "какой ghost к какому server-echo" — не "по индексу" (deploys могут reorder), а **по `{x, y, tick}` контексту**.

Я извлёк это в чистые функции `clientPrediction.ts`:

```typescript
export function addGhost(ghosts: Ghost[], g: Ghost): Ghost[];
export function reconcileGhosts(ghosts: Ghost[], serverDeploys: DeployAction[]): Ghost[];
export function rejectGhost(ghosts: Ghost[], myIdx: number | null,
                            context: { x?: number; y?: number; tick?: number }): {
  ghosts: Ghost[]; removed: boolean;
};
export function gcStaleGhosts(ghosts: Ghost[], currentTick: number): Ghost[];
```

26 unit-тестов покрывают edge cases. Без shared engine + детерминизма я бы не смог тестировать так строго — пришлось бы интегрейшеном через real WS.

---

## Reconnect grace: чтобы wifi flicker не убивал матч

Реальность: соединения рвутся. Wi-Fi мигнул на 5 секунд — disconnect. Если матч сразу заканчивает с forfeit, это плохая UX. Я ходил по тонкому льду между "достаточно времени чтобы вернуться" и "не позволить оппоненту 5 минут смотреть в spinner".

Решение: **grace period** (15 секунд по умолчанию) + **resume token**.

При close WebSocket:
1. Сервер помечает `player.disconnected = true`
2. Стартует `setTimeout(forfeit, graceDisconnectMs)`
3. Broadcasts `room_updated` с `disconnected: true` flag — оппонент видит "Opponent reconnecting..."

При reconnect клиента (auto через `WSClient` с exponential backoff):
1. Клиент шлёт `join_room` с сохранённым `resumeToken`
2. Server matches token к disconnected slot, восстанавливает
3. Сервер шлёт `match_resume_state` с полным sim state (config, seed, deployTimeline)
4. Клиент replay'ит engine forward → catches up до server's tick
5. Игра продолжается

Resume token — UUID v4 в `sessionStorage` per-room. Не нужна авторизация — token сам по себе secret enough для 15-секундного окна.

---

## Procedural audio: 4-голосный sequencer на WebAudio

Принципиальное решение: **никаких ассетов**. Всё procedurally synthesized через WebAudio.

Почему: каждый mp3-файл ~100 KB. 6 SFX + background music — это ~1 MB ассетов. Это **больше всего JS-кода** проекта.

Procedural synthesis: 8 KB кода → весь music engine.

### Layered SFX (Day 21)

Каждый sound — это compose из osc + envelope + filter + noise burst:

```typescript
function playDeploy(c: AudioContext, t: number): void {
  // Body click: sine с pitch sweep 800→300Hz
  osc(c, 'sine', 800, 300, t, 0.001, 0.005, 0.04, 0.35, 1, 0);
  // High transient: square 2200→1400Hz
  osc(c, 'square', 2200, 1400, t, 0.001, 0.003, 0.025, 0.18, 1, 0);
  // Tactile noise: 1200Hz HP filter
  noiseBurst(c, t, 0.018, 0.15, 1200, 1, 0);
}

function playVictory(c: AudioContext, t: number): void {
  // 5-note arpeggio C5-E5-G5-C6-E6
  const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
  notes.forEach((freq, i) => {
    const start = t + i * 0.11;
    osc(c, 'triangle', freq, freq, start, 0.005, 0.06, 0.28, 0.40, 1, 0.9);     // lead
    osc(c, 'sine', freq / 2, freq / 2, start, 0.005, 0.06, 0.28, 0.22, 1, 0.7);  // sub
    if (i >= 2) osc(c, 'triangle', freq * 2, freq * 2, start, 0.003, 0.04, 0.20, 0.15, 1, 0.9);
  });
  // Final sustain C major triad
  const finalT = t + 4 * 0.11 + 0.05;
  osc(c, 'sine', 261.63, 261.63, finalT, 0.02, 0.10, 0.50, 0.22, 1, 0.9);
  osc(c, 'triangle', 329.63, 329.63, finalT, 0.02, 0.10, 0.50, 0.18, 1, 0.9);
  osc(c, 'triangle', 392.00, 392.00, finalT, 0.02, 0.10, 0.50, 0.16, 1, 0.9);
}
```

16 oscillator'ов для victory fanfare. Bus topology: master → dry (92%) + wet (18%) → synthesized ConvolverNode IR (1.4s exp-decayed white noise) → destination.

### FM-bell для tie sound

Frequency modulation: один oscillator (modulator) идёт в `carrier.frequency` через `GainNode`. Получаются sidebands на `carrier ± n × mod` — inharmonic, как у настоящего колокола.

```typescript
function fmBell(c: AudioContext, carrierFreq: number, modRatio: number,
                modIndex: number, t: number, ...): void {
  const carrier = c.createOscillator();
  carrier.frequency.value = carrierFreq;
  const mod = c.createOscillator();
  mod.frequency.value = carrierFreq * modRatio;
  const modGain = c.createGain();
  modGain.gain.value = modIndex;
  mod.connect(modGain);
  modGain.connect(carrier.frequency);  // ← here's the magic
  // ... envelope, routing ...
}
```

`ratio = 0.5, index = 200` даёт metallic "ding" с обертонами.

### Dynamic music (Day 25): lookahead scheduler

Background music **реагирует** на game state. Geometry Dash style — intensity растёт с прогрессом матча, mood меняется при смене лидерства.

Главная задача: timing accuracy. `setTimeout(playNote, delay)` даёт jitter — JavaScript timer has 4ms grain + GC pauses → audio пьяный.

Canonical pattern из Chris Wilson 2013 article ["A Tale of Two Clocks"](https://www.html5rocks.com/en/tutorials/audio/scheduling/): **two clocks** одновременно.

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

JavaScript timer проверяет каждые 25ms "что нужно schedule на следующие 100ms". Все `osc.start(time)` happen ahead of time на audio sample clock — sample-accurate, нет drift.

4 voices с независимыми bus'ами:
- **Bass** (sawtooth + lowpass) — всегда играет walking line на root
- **Pad** (sine triad) — sustained chord на каждом segment'е
- **Drum** (kick + snare + hihat) — gain controlled by intensity
- **Lead** (square + triangle octave) — motif на high intensity

3 chord progressions по mood:
- `neutral`: Am-Dm-F-G (classic emotional)
- `winning`: Am7-F-G-C (brighter, major resolution)
- `losing`: Am-Dm-Bdim-E7 (darker, dramatic)

Intensity 0..1 derived from `tick_progress + scoreboard_delta`. Mood from `moodFromDelta(myPercent, oppPercent)`. Linearly ramp drum + lead gains за 200ms — без щелчков при изменениях.

---

## Smart bot: sim tracking + frontier targeting

Когда никто не приходит в твою PvP room, нужен бот-fallback. Иначе 99% drop-off — игрок попробует один раз и закроет вкладку.

Решение: **client-side bot через secondary WebSocket** в той же tab. Открываешь второй WS, joins room под nickname "🤖 Bot (Easy)", auto-Ready, и во время матча шлёт deploys. ZERO server changes — server видит бота как regular player'а.

```typescript
class BotPlayer {
  private ws: WSClient;
  private sim: SimState | null = null;
  private mySlotIdx: number | null = null;
  
  // ... lifecycle methods ...
  
  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'match_starting':
        // Initialize own engine instance — same shared @langton/core
        this.sim = makeLangtonState({
          w: msg.config.width, h: msg.config.height,
          ants: buildAntsFromConfig(msg.config),
          seed: msg.seed,
          birthConfig: buildBirthConfig(msg.config),
          // ...
        });
        break;
      case 'match_tick':
        // Catch up local sim
        while (this.sim!.tick < msg.tick) stepLangton(this.sim!);
        for (const d of msg.deploys) applyDeployAction(this.sim!, d, this.config!);
        this.maybeDeploy();
        break;
    }
  }
}
```

Бот теперь "видит" реальное состояние территории через свой `sim.owner` array.

### Frontier targeting

```typescript
export function findFrontierCells(
  sim: SimState, width: number, height: number,
  mySlotIdx: number, strictEnemy: boolean,
): Array<{ x: number; y: number }> {
  const myOwner = mySlotIdx + 1;
  const result = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (sim.owner[y * width + x] !== myOwner) continue;
      // Check 4 neighbors
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nOwner = sim.owner[ny * width + nx];
        if (strictEnemy) {
          // Hard mode: только enemy cells считаются
          if (nOwner !== 0 && nOwner !== myOwner && nOwner !== 255) {
            result.push({ x, y }); break;
          }
        } else {
          // Normal mode: any non-my cell
          if (nOwner !== myOwner) { result.push({ x, y }); break; }
        }
      }
    }
  }
  return result;
}
```

O(W*H) single pass — microseconds на 60×60.

3 уровня сложности с разными ratios smart vs random + adaptive timing:

| Difficulty | Smart % | Strict enemy | Base interval | Jitter | Initial burst | Panic mode |
|---|---|---|---|---|---|---|
| Easy | 0% (always random) | — | 50 ticks | ±20% | первые 3 быстрее | — |
| Normal | 40% (frontier) | false (neutral counts) | 30 ticks | ±20% | да | — |
| Hard | 70% (frontier) | true (enemy only) | 15 ticks | ±20% | да | если отстаёт на >5% → interval halved |

### Adaptive Hard panic mode

```typescript
export function isPanicMode(
  sim: SimState | null, mySlotIdx: number,
  width: number, height: number, difficulty: BotDifficulty,
): boolean {
  if (!sim || difficulty !== 'hard') return false;
  const myPercent = computeMyTerritoryPercent(sim, mySlotIdx, width, height);
  const myOwner = mySlotIdx + 1;
  let opp = 0;
  for (let i = 0; i < width * height; i++) {
    const o = sim.owner[i];
    if (o !== 0 && o !== myOwner && o !== 255) opp++;
  }
  return (opp / (width * height)) * 100 > myPercent + 5;
}
```

Если opp ведёт >5% territory → panic → deploys в 2 раза быстрее. Создаёт "fightback" feel — Hard becomes aggressive when losing.

Тестирование bot strategy: **все pure helpers** — `findFrontierCells`, `shouldDeployJittered`, `pickSmartDeployLocation`, `isPanicMode`. 41 unit-test без real WS. Custom RNG parameter для deterministic asserts:

```typescript
expect(pickDeployLocation(60, 60, 0, 'hard', () => 0.5)).toEqual({ x: 45, y: 45 });
```

---

## Custom win conditions: `hold_majority` 

Time-based win (за 30 секунд набери больше) превращает PvP в **race optimization** — стратегия "snipe last tick". Скучно.

Day 34: новый kind `hold_majority` — "первый кто >threshold% и продержится N ticks подряд".

```typescript
export type WinConditionKind =
  | 'none' | 'time' | 'first_mutant' | 'n_mutants_total'
  | 'n_mutants_single' | 'survival'
  | 'hold_majority';  // Day 34

export interface WinCondition {
  kind: WinConditionKind;
  threshold: number;     // для hold_majority это процент (0..100)
  holdTicks?: number;    // только для hold_majority
}
```

Логика:

```typescript
function computeHoldMajority(currentTick, thresholdPct, holdTicks,
                            perPlayer, players, prevMatch): MatchResult {
  const prevCounters = prevMatch.holdCounters ?? {};
  const newCounters: Record<string, number> = {};
  for (const p of players) {
    const territoryPct = (perPlayer[p.id]?.territoryPct ?? 0) * 100;
    if (territoryPct >= thresholdPct) {
      newCounters[p.id] = (prevCounters[p.id] ?? 0) + 1;
    } else {
      newCounters[p.id] = 0;  // ← RESET! critical bit
    }
  }
  // Winner = первый достигший holdTicks
  for (const p of players) {
    if ((newCounters[p.id] ?? 0) >= holdTicks) {
      return { finished: true, winnerId: p.id, ...,
               holdCounters: newCounters };
    }
  }
  return { ...notFinished(), holdCounters: newCounters };
}
```

Reset при падении ниже threshold — критичный bit. Без него `hold_majority` был бы equivalent "first to reach for cumulative N ticks" — boring. Сейчас игроку нужно **sustain** lead. Каждое падение ниже threshold обнуляет clock, comeback potential через всю игру.

State carry'ится через `prevMatch.holdCounters` — никаких side effects, никаких новых protocol changes, replay reproducibility сохраняется.

---

## Production hardening

### Rate limiting (Day 14)

Sliding window limiter — alternative к token bucket. Проще тестировать, не нужны таймеры.

```typescript
export class SlidingWindowLimiter {
  private readonly hits: number[] = [];
  constructor(public readonly config: { limit: number; windowMs: number }) {}
  
  tryHit(now: number): boolean {
    this.prune(now);
    if (this.hits.length >= this.config.limit) return false;
    this.hits.push(now);
    return true;
  }
  
  private prune(now: number): void {
    while (this.hits.length > 0 && this.hits[0]! < now - this.config.windowMs) {
      this.hits.shift();
    }
  }
}
```

Три лимита на каждую connection:
- `deploy`: 5/sec (защита от click-spam)
- `message`: 30/sec (защита от protocol-flood)
- `errorBudget`: 5 ошибок / 10 sec (защита от malformed JSON spam)

Превышение error budget → close connection. RATE_LIMIT_EXCEEDED **сам по себе не учитывается** в error budget (иначе client получивший лимит сам себя бы забанил — classic feedback loop).

### Graceful shutdown (Day 15)

systemd restart за 2 секунды без downtime для active matches:

```typescript
async stop(): Promise<void> {
  for (const room of this.ctx.rooms.all) {
    if (room.activeMatch && !room.activeMatch.isFinished) {
      room.activeMatch.endWith(null, 'server_shutdown');
      // → broadcast match_ended с reason — client показывает понятный banner
    }
    if (room.countdownHandle) {
      clearTimeout(room.countdownHandle);
      room.broadcast({ type: 'error', code: 'SERVER_SHUTDOWN',
                       message: 'Server is shutting down', locale: 'en' });
    }
    // Cleanup grace timers, rematch timers, lobby timeouts
  }
  // Close all connections, then http.Server
}
```

### Orphan lobby timeout

Если первый игрок создал room и второй не пришёл за 10 минут → ROOM_TIMEOUT + cleanup. Без этого rooms forever занимали память.

---

## VPS deploy: побочный квест

Параллельно с Day 13 хотел задеплоить mvp-server на Render.com. Wrote `Dockerfile`, `render.yaml`, HTTP health endpoint. Render заявляет free tier, но требует credit card "for verification". Карта не привязалась с первой попытки. День потерян.

Перешёл на VPS — Aeza (~$5/мес, Ubuntu 24.04). Заняло половину дня:
- `apt install nodejs npm nginx certbot python3-certbot-nginx`
- nginx config с WS upgrade headers + reverse proxy на `localhost:8080`
- `certbot --nginx -d alshfu.com` — Let's Encrypt cert auto-installed
- systemd unit file для auto-restart
- `npm install + npm exec tsx ./` для production runtime (skipping dist build)

Live: `wss://alshfu.com`. Frontend пушит туда через `VITE_WS_URL` env при сборке.

DNS пропагация заняла два часа — это **всегда** больше чем ожидаешь. После того как cache invalidated, всё работает.

**Урок**: для MVP backend сервиса **VPS > PaaS**. Render заявил free tier, в реальности требовал кредитку. VPS требует ssh + nginx + certbot — навыки которые не уйдут. systemd предсказуем. Никаких неожиданностей.

---

## Reddit promotion: побочный квест который зафейлился

Подготовил статьи, GIF, ссылки. r/playmygame, r/WebGames, r/cellular_automata, r/IndieDev. Через Playwright/CDP attached к настоящему Chrome.

Reddit anti-bot **поймал** на первой попытке логина. user-agent через Playwright → blocked. Перешёл на CDP attach к реальному Chrome.

Пост на r/playmygame прошёл. Через 5 минут попал в spam filter (новый аккаунт + low karma + external link = autoflag). Решил подождать 24 часа вместо продолжения бот-кампании.

24 часа спустя пост по-прежнему не виден. Mod review застрял. Похоже что для real promotion нужна **репутация аккаунта**, а не техника. Никакая Chrome DevTools магия не пройдёт sitewide filter если новый аккаунт без истории.

**Урок**: anti-spam Reddit невозможно обмануть техникой. Нужно либо human поведение с реального аккаунта с историей, либо неделя patient мод-approval ожидания. Никакая автоматизация tut.

---

## Numbers

### Performance

- **Bundle**: 231 KB raw JavaScript / 71 KB gzip (production, минфицировано). React vendor 141 KB, app code 219 KB. Without code splitting yet.
- **Server image**: 192 MB Docker. RAM: 50 MB idle, 80 MB при active match.
- **Latency**: ~30ms RTT (Aeza VPS → EU client). Server tick interval 100ms (10 TPS).
- **Determinism**: 15/15 presets play back bit-identical через replay system.

### Code

- **538 unit tests**: 301 web + 131 core + 106 mvp-server
- **0 TypeScript errors** в strict mode (`noUncheckedIndexedAccess` enabled)
- **34 + 60 = 94 days** total development (Sandbox 60 + PvP 34)
- **~40 files** в backend, ~34 в web src/ (без tests)

### Sound

Procedurally synthesized, **0 audio assets**. Music engine alone — ~400 строк кода, 8 KB raw / 2 KB gzip.

---

## Что я узнал

### Архитектура

1. **Детерминизм — это архитектурное решение, не "ой так удобно"**. Окупается репликейми, бот, replay, debugging.
2. **Shared engine между client и server** через workspace package — самое важное архитектурное решение. Один codepath, n consumers (game client, bot, replay, future spectator mode).
3. **In-memory state на single instance** — это **выбор**, не лень. Для MVP это лучший вариант: нет БД, нет миграций, нет N+1. Production multi-instance переезд в Redis — отдельная задача (Stage 9).

### Game design

4. **Win condition определяет всю стратегию**. Time-based = race optimization. Hold-based = sustained dominance. Last-survivor = combat focus. Это **не implementation detail**, это **core game design**.
5. **Bot fallback — MVP requirement** для multiplayer games. Без него блокируешь user'а на "wait until friend joins" — это 99% drop-off.

### UX

6. **Audio quality scales non-linearly с кодом**. Day 18 = 60 строк, 6 events (basic). Day 21 = 300 строк, 6 events (rich). Day 25 = 400 строк, continuous music. Каждый шаг в 2-3 раза больше кода, но в 10 раз больше perceived quality.
7. **Information visualization не cost'ит много кода, но добавляет significant value**. Scoreboard + timer + critical pulse — 150 строк, трансформируют match experience.

### Process

8. **MVP scope = "первый пользователь получит ценность один раз"**. Не "механика работает", а **complete loop включая rematch, retry, share**.
9. **Polish vs core зависит от stability surrounding UX**. UI element который меняется — polish откладывать. Mechanic feedback (sound, visual) — делать сразу.
10. **Self-imposed pattern recognition**: я писал "должно было быть раньше" в DEVLOG-е 4 дня подряд (Day 17, 18, 20, 22). Это **systemic issue** — я приоритизирую "новые фичи" над "polish existing". Записал в lessons этапа.

---

## Что дальше

[ROADMAP.md](https://github.com/alshfu/Langton_Ants_PVP/blob/main/ROADMAP.md) полный, но коротко:

### Stage 9 (planned, ~30 days)
- Server-side per-room config selection (host выбирает в lobby)
- PostgreSQL persistence (anonymous device-id based + optional accounts)
- Matchmaker (ELO/SR, expanding-window queue, bot fallback)
- Spectator mode (3rd+ connection observes)
- Replay browser (R2 storage, browse public replays)

### Stage 10+ (ideas)
- Public launch + community (Discord, blog posts, properly-done Reddit)
- 3-10 player team modes
- Tournament brackets
- Native mobile via Capacitor
- Voice chat WebRTC

Полный wishlist в `ROADMAP.md`: powerups, resources mode, defensive structures, multi-rule players, asymmetric matches, roguelike, daily challenges, replay annotations, WASM engine, WebGPU rendering, edge functions, etc.

---

## Links

- 🎮 **Play**: https://alshfu.github.io/Langton_Ants_PVP/
- 📦 **GitHub**: https://github.com/alshfu/Langton_Ants_PVP (MIT)
- 📓 **Devlog** (94 days chronological): https://github.com/alshfu/Langton_Ants_PVP/blob/main/DEVLOG.md
- 🗺️ **Roadmap & wishlist**: https://github.com/alshfu/Langton_Ants_PVP/blob/main/ROADMAP.md
- 📖 **Wiki** (API reference): https://github.com/alshfu/Langton_Ants_PVP/wiki

**Tech stack quick reference**:
- Frontend: React 18 + TypeScript 5 + Vite 5
- Backend: Node.js + `ws` (без Fastify)
- Engine: shared TypeScript package
- Audio: WebAudio (zero assets, procedural)
- Deploy: Aeza VPS + nginx + certbot + systemd

**Если играешь** — open URL, нажми "Play vs Bot" → Hard. Бот делает initial burst (3 deploy'я в первые 0.8s), pick'ает frontier cells смежные с твоей территорией, и если ты лидируешь — переходит в panic mode и атакует в 2 раза быстрее.

**Если код смотришь** — старт с `langton-arena-web/src/screens/MatchScreen.tsx` (главный flow), потом `langton-arena-backend/services/mvp-server/src/router.ts` (server logic). Engine в `langton-arena-backend/core/src/langton/engine.ts`.

**Если хочешь форкнуть** — MIT лицензия, делай что хочешь. Если что-то полезное добавишь — PR welcome.

---

*Спасибо за чтение. Feedback ценится — баги/идеи/похвалы в [GitHub issues](https://github.com/alshfu/Langton_Ants_PVP/issues) или в комментариях.*
