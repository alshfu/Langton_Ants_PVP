# Stage 9 — Matchmaking & Persistence · Технические спецификации

> **Status**: Draft v1, 2026-05-30 (immediately after Stage 8 closure)  
> **Stage 8 baseline**: 546/546 tests, 134 KB main bundle, single-instance VPS  
> **Stage 9 goal**: превратить URL-shared rooms в полноценный multiplayer service с rankings  
> **Estimated effort**: ~30 рабочих дней (~6 недель)

---

## Содержание

1. [Концепция](#концепция)
2. [Stage 9.1 — Server-side per-room config (3 дня)](#91-server-side-per-room-config-3-дня)
3. [Stage 9.2 — Persistence layer (4 дня)](#92-persistence-layer-4-дня)
4. [Stage 9.3 — Matchmaker (5 дней)](#93-matchmaker-5-дней)
5. [Stage 9.4 — Spectator mode (3 дня)](#94-spectator-mode-3-дня)
6. [Stage 9.5 — Replay browser (3 дня)](#95-replay-browser-3-дня)
7. [Stage 9.6 — Authentication (3 дня, optional)](#96-authentication-3-дня-optional)
8. [Stage 9.7 — Leaderboards (4 дня)](#97-leaderboards-4-дня)
9. [Stage 9.8 — Infrastructure & scaling (5 дней)](#98-infrastructure--scaling-5-дней)
10. [Cross-cutting concerns](#cross-cutting-concerns)
11. [Acceptance criteria для Stage 9 closure](#acceptance-criteria-для-stage-9-closure)
12. [Open questions](#open-questions)

---

## Концепция

Stage 8 поставил **playable MVP** — два игрока с известным URL могут играть. Stage 9 поднимает это до **product-quality service**:

- Незнакомые игроки находят друг друга через matchmaker (без обмена URL'ами)
- Custom rules — host выбирает win condition, размер поля, мутации
- Persistent stats — игроки видят свою историю, рейтинг, top matches
- Community engagement — leaderboards, public replays browser
- Robust infrastructure — multi-instance, auto-scale, monitored

**Не-goals для Stage 9** (defer to Stage 10+):
- Public launch / community promotion (Stage 10)
- Tournament brackets (Stage 11)
- Mobile native apps (Stage 12)
- Voice/video chat (Stage 13)
- Monetization (никогда — MIT остаётся бесплатным)

---

## 9.1 Server-side per-room config (3 дня)

### Цель

Host (первый присоединившийся к room) выбирает game settings в lobby перед Ready click. Сейчас server использует fixed `defaultMatchConfig`.

### Protocol changes

`core/src/protocol/stage8.ts`:

```typescript
// Добавить новый ClientMessage:
| { type: 'set_room_config'; config: PartialMatchConfig }

// Новый ServerMessage (broadcast):
| { type: 'room_config_updated'; config: SandboxConfig }

// Constraints на PartialMatchConfig (валидируется server'ом):
interface PartialMatchConfig {
  width?: number;          // 20..120 (PVP_MAX_FIELD=200 already)
  height?: number;         // 20..120
  winCondition?: WinCondition;  // any kind
  topology?: 'torus' | 'wall' | 'void' | 'bounce';
  baseTps?: number;        // 5..20
  mutation?: { haloEnabled?: boolean; mirrorEnabled?: boolean; pathEnabled?: boolean };
  // ... другие safe-to-override fields
}
```

### Server changes

`services/mvp-server/src/room.ts`:
- Add `host: Connection | null` field — кто host (первый присоединившийся)
- `addPlayer(conn)`: если `players.length === 0` → `this.host = conn`

`services/mvp-server/src/router.ts`:
- Add `handleSetRoomConfig(conn, msg, ctx)`:
  - Validate: `conn.roomCode` exists, room in lobby phase, `conn === room.host`
  - Validate partial config (size limits, valid winCondition.kind, etc)
  - Merge into `room.pendingConfig` (deep merge with defaultMatchConfig)
  - Broadcast `room_config_updated` to all in room
- Add `handleStartMatch(conn, ctx)` — replaces auto-start on bothReady:
  - Validate: `conn === room.host`, all ready, room in lobby
  - Use `room.pendingConfig` (или default) для match
  - Start countdown

### Client changes

`langton-arena-web/src/screens/MatchScreen.tsx` LobbyView:
- Show config selector только для host (`me.clientId === firstPlayer.clientId` — frontend-side detection)
- Dropdowns / radio buttons для:
  - Win condition: time / hold_majority (with threshold + holdTicks inputs)
  - Grid size: 40×40, 60×60, 80×80, 100×100
  - Mutations: on/off toggles
- "Apply" button → sends `set_room_config`
- Opponent видит config readonly
- MatchPreviewCard теперь использует **dynamic** config из server, не STAGE8_DEFAULT_PREVIEW

### Tests

Server (mvp-server tests):
- Host sends set_room_config → broadcasts room_config_updated ✓
- Non-host attempts → server ignores or error 'NOT_HOST'
- Invalid config (size out of range) → error 'INVALID_CONFIG'
- Config persists через rematch_reset

Client (web tests):
- LobbyView shows config selector only for host
- Sends set_room_config on apply click
- Updates display on room_config_updated broadcast

### Acceptance

- Host can set any of: win condition kind/threshold, grid size, mutations
- Match starts with chosen config
- Opponent sees the same config in MatchPreviewCard
- Rematch preserves config from last match
- Tests: +6 server, +3 web

---

## 9.2 Persistence layer (4 дня)

### Цель

Сохранять матчи и replays в БД, чтобы:
- Stats tracking (per-user win/loss, total matches)
- Replay browser (Stage 9.5)
- Leaderboards (Stage 9.7)

### Database choice

**PostgreSQL 16+** (rationale):
- Native JSON support для config blobs + replay timelines
- Mature ecosystem, easy on Aeza VPS
- Простая migration story
- TypeScript-friendly (Prisma или Drizzle ORM)

**Alternative**: SQLite-on-VPS для simplicity. Defer Postgres до multi-instance need. **Recommended for Stage 9.2: start with SQLite, plan migration к Postgres в 9.8**.

### Schema

```sql
-- Anonymous identity via device-id (no auth required)
CREATE TABLE users (
  id TEXT PRIMARY KEY,           -- UUID v4
  device_id TEXT NOT NULL UNIQUE, -- от browser fingerprint + localStorage
  nickname TEXT NOT NULL,         -- saved last nickname
  created_at INTEGER NOT NULL,    -- Unix epoch ms
  last_active INTEGER NOT NULL,
  total_matches INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  rating INTEGER DEFAULT 1500     -- ELO start
);

CREATE INDEX idx_users_device ON users(device_id);
CREATE INDEX idx_users_rating ON users(rating DESC);

-- Match records
CREATE TABLE matches (
  id TEXT PRIMARY KEY,            -- matchId from server
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  duration_ticks INTEGER,
  config_json TEXT NOT NULL,      -- SandboxConfig as JSON
  winner_user_id TEXT REFERENCES users(id),
  reason TEXT NOT NULL,           -- 'time_expired' | 'held_majority_50pct_500t' | etc
  replay_size_bytes INTEGER       -- для quota tracking
);

CREATE INDEX idx_matches_started ON matches(started_at DESC);
CREATE INDEX idx_matches_winner ON matches(winner_user_id);

-- Per-player participation in matches
CREATE TABLE match_participants (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  player_idx INTEGER NOT NULL,    -- 0 or 1 in current 2-player
  final_territory_pct REAL NOT NULL,
  final_ants_alive INTEGER NOT NULL,
  rating_before INTEGER,
  rating_after INTEGER,
  PRIMARY KEY (match_id, user_id)
);

-- Replays (large blobs — store separately or in R2 with reference)
CREATE TABLE replays (
  match_id TEXT PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  payload_json TEXT,              -- inline для small; для large используем R2
  r2_key TEXT,                    -- если хранится в R2
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_replays_created ON replays(created_at DESC);
```

### Server changes

New service `services/mvp-server/src/persistence.ts`:

```typescript
export interface PersistenceLayer {
  upsertUser(deviceId: string, nickname: string): Promise<User>;
  recordMatchStart(matchId: string, config: SandboxConfig, participants: User[]): Promise<void>;
  recordMatchEnd(matchId: string, result: MatchResult, replay: Replay): Promise<void>;
  getUserStats(userId: string): Promise<UserStats>;
  getRecentMatches(limit: number): Promise<MatchSummary[]>;
}

// Implementations:
export class SqlitePersistence implements PersistenceLayer { ... }
export class PostgresPersistence implements PersistenceLayer { ... }
export class NoOpPersistence implements PersistenceLayer { ... } // для tests
```

Match.ts hooks:
- `startMatch()` → `persistence.recordMatchStart(matchId, config, participants)`
- `finishAndBroadcast()` → `persistence.recordMatchEnd(matchId, result, replay)`

### Client changes

`web/src/lib/deviceId.ts` new:
```typescript
// Generate stable device-id from localStorage + browser fingerprint
export function getDeviceId(): string {
  let id = localStorage.getItem('langton.deviceId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('langton.deviceId', id);
  }
  return id;
}
```

`join_room` теперь шлёт `deviceId`:
```typescript
{ type: 'join_room', roomCode, nickname, locale, deviceId, resumeToken? }
```

Server upsertUser(deviceId, nickname) на каждом join.

### Tests

- SqlitePersistence CRUD operations
- Match.ts integration (mocked persistence in unit tests)
- Server tests: deviceId tracked properly через resume

### Acceptance

- Каждый завершённый match записан в БД
- User stats обновляются (wins/losses/draws)
- Replay payload stored (inline или R2 reference)
- Deletion cascades корректно
- Tests: +12

---

## 9.3 Matchmaker (5 дней)

### Цель

"Find match" button → server matches unknown players in 30 sec average. Не требует URL share.

### Algorithm — ELO/SR rating с expanding window

Standard ELO с K-factor=32 для start:
```
E_a = 1 / (1 + 10^((R_b - R_a) / 400))
R_a' = R_a + K * (S_a - E_a)
```

Где S_a = 1 (win), 0.5 (draw), 0 (loss).

Matchmaking queue:
- При join queue, store `{ userId, ratingAtJoin, joinTime }`
- Каждые 2 секунды server runs matchmaking sweep:
  1. Sort queue by joinTime ascending
  2. Для каждого player: window = ±(50 + 30 * waitSeconds) — expands over time
  3. Find oldest pending player с rating в window → match
  4. Pair found → create room, send `match_found` to both

### Protocol additions

```typescript
| { type: 'find_match'; nickname: string; deviceId: string }
| { type: 'cancel_matchmaking' }

| { type: 'matchmaking_status'; waitTime: number; queuePosition: number }
| { type: 'match_found'; roomCode: string }
```

### Server new service

`services/mvp-server/src/matchmaker.ts`:

```typescript
export class Matchmaker {
  private queue: Array<QueueEntry> = [];
  private sweepHandle: NodeJS.Timeout | null = null;
  
  constructor(private readonly persistence: PersistenceLayer,
              private readonly rooms: RoomManager) {}
  
  enqueue(entry: QueueEntry): void;
  dequeue(userId: string): boolean;
  private sweep(): void;
  private match(a: QueueEntry, b: QueueEntry): void;
}
```

Sweep tick — каждые 2 sec:
- Iterate queue по joinTime
- Для каждого entry: window = 50 + 30 * (now - joinTime) / 1000
- Find oldest entry within ±window rating
- If found: create room, dequeue both, send `match_found`
- If wait > 60s and no match: offer bot fallback ("Play vs Bot" suggestion)

### Bot fallback

If matchmaking time > 60s:
- Send `matchmaking_suggestion`: "No human opponent yet. Play vs Bot?"
- Client shows modal → user accepts → spawn bot in current matchmaking room

### Client changes

New screen `MatchmakingScreen.tsx` (replaces stub):
- "Finding match..." spinner + estimated wait time
- Queue position display
- Cancel button
- Bot fallback offer после 60s

### Tests

- Matchmaker queue add/remove
- Sweep matches by rating window
- Expanding window over time
- Empty queue handles no-op
- Bot fallback after 60s threshold

### Acceptance

- "Find match" в menu → matchmaking screen → match starts in <30s average
- Players matched по similar rating (±50 initially)
- Bot fallback works после 60s wait
- Cancel works any time
- Tests: +10

---

## 9.4 Spectator mode (3 дня)

### Цель

3rd+ connection в room watches без playing. Stage 10 launches public broadcasts.

### Protocol additions

```typescript
| { type: 'join_room'; ...; spectator?: boolean }  // existing + new field

| { type: 'spectator_joined'; spectators: SpectatorInfo[] }
| { type: 'spectator_left'; clientId: string }
```

### Server changes

`Room.ts`:
- Add `spectators: Connection[]` field
- `addPlayer(conn, asSpectator=false)`: route to spectators array
- spectators get all broadcasts (room_updated, match_starting, match_tick, etc)
- spectators **не** count в room.players.length
- spectators **не** могут send: set_ready, deploy, request_rematch

`router.ts`:
- handleJoinRoom: if msg.spectator → addSpectator вместо addPlayer
- handleDeploy: validate sender is in room.players (not spectators) → error 'SPECTATOR_CANT_DEPLOY'
- handleSetReady: same

### Client changes

New URL param: `?spectate=ROOMCODE` → MatchScreen mounts с `isSpectator=true`
- ReadyToggle hidden
- DeployClick disabled (no canvas onClick)
- Show spectator count в top bar
- Display "👁 SPECTATOR" badge

### Tests

- Spectator joined → broadcasts room_updated without affecting players slots
- Spectator attempts deploy → error
- Multiple spectators OK
- Match runs normally with spectators watching

### Acceptance

- 3rd connection joins as spectator (via ?spectate URL param)
- Sees full match in real-time
- Cannot interact (no deploy, no ready)
- Players see "1 spectator watching" indicator
- Tests: +6

---

## 9.5 Replay browser (3 дня)

### Цель

Browse public replays на Sandbox → Replays tab. Filter, sort, share.

### Storage

Inline в SQLite (для MVP) или R2/S3 (для production):
- Replay JSON size typical ~2-5 KB inline-friendly
- For first 100k replays, SQLite fine
- Migration к R2 в 9.8 infrastructure pass

### Server endpoints

REST API на mvp-server:
```
GET /api/replays?limit=20&offset=0&kind=hold_majority&since=2026-01-01
GET /api/replays/:matchId
DELETE /api/replays/:matchId (только owner после auth Stage 9.6)
```

JSON responses:
```typescript
type ReplayListItem = {
  matchId: string;
  startedAt: number;
  duration: number;
  winnerNickname: string | null;
  participants: Array<{ nickname: string; territoryPct: number }>;
  reason: string;
};

type ReplayDetail = {
  metadata: ReplayMetadata;
  config: SandboxConfig;
  deployTimeline: DeployAction[];
};
```

### Client UI

Sandbox → Replays tab extension:
- "Public Replays" section (above existing local)
- Filter dropdowns: win condition kind, date range, winner
- Sort: newest / longest / most-contested
- Pagination: 20 per page
- Click replay → loads в Sandbox playback mode

### Tests

- API endpoint returns correct paginated data
- Filter combinations work
- Specific replay fetch returns full structure
- Click-to-play wiring

### Acceptance

- Browse 20 most recent public replays from Sandbox tab
- Filter by win condition / date works
- Click → instant Sandbox playback
- Tests: +8

---

## 9.6 Authentication (3 дня, optional)

### Цель

Optional cross-device identity. Anonymous device-id остаётся default.

### Tech choice

OAuth via Google + GitHub:
- No password management (security win)
- Familiar UX
- Server stores только OAuth-issued userId + email

Library: `passport.js` или custom (server is small enough для custom).

### Schema additions

```sql
ALTER TABLE users ADD COLUMN auth_provider TEXT;  -- 'google' | 'github' | null
ALTER TABLE users ADD COLUMN provider_user_id TEXT;
ALTER TABLE users ADD COLUMN email TEXT;

CREATE UNIQUE INDEX idx_users_provider 
  ON users(auth_provider, provider_user_id) 
  WHERE auth_provider IS NOT NULL;
```

### Flow

Client side:
- "Sign in with Google/GitHub" button on Profile screen
- OAuth redirect → server callback → JWT session cookie
- WS connection sends JWT в `join_room.authToken` field

Server side:
- HTTP `/auth/google`, `/auth/github` endpoints
- Validate OAuth callback, upsert user
- Issue JWT signed with secret
- WS validates JWT on join — if present, links connection к authenticated user

Linking anonymous → authenticated:
- При first sign-in user has device-id record
- New auth user record created
- Старый device-id record marked deprecated (или merged via stats)

### Acceptance

- Sign in with Google works
- Sign in with GitHub works
- After sign-in, stats persist across devices/browsers
- Anonymous use remains supported (no forced auth)
- Tests: +6

### **Note**: this whole sub-stage is OPTIONAL. Anonymous device-id может быть достаточным для Stage 9 closure. Skip if time pressure.

---

## 9.7 Leaderboards (4 дня)

### Цель

Top players visible, motivation for competitive play.

### Schema

Уже covered в 9.2 (users.rating column).

### Server endpoints

```
GET /api/leaderboard/global?limit=100
GET /api/leaderboard/weekly?limit=100
GET /api/leaderboard/monthly?limit=100
GET /api/users/:userId/stats
```

Aggregations:
- Global: just ORDER BY rating DESC LIMIT 100
- Weekly: WHERE matches_played > 5 AND played_in_last_7_days > 0
- Monthly: same idea для 30 days

Window для filtering активных:
- "Active in window" — at least 1 match played в этом окне
- Prevents stale 2k-rated player blocking real leaderboard

### Client screen

New screen `LeaderboardScreen.tsx`:
- Tabs: Global / Weekly / Monthly
- Table rows: rank, nickname, rating, W-L-D, win%
- My row highlighted
- "Play similar rated opponents" → enters matchmaking with same skill

Menu addition:
- "🏆 Leaderboard" button (между Sandbox и Profile)

### Tests

- API returns correctly sorted ranks
- Weekly filter excludes inactive
- My row appears with own rating

### Acceptance

- Public leaderboard accessible
- Rating updates after each match
- Weekly/monthly views work
- Tests: +6

---

## 9.8 Infrastructure & scaling (5 дней)

### Цель

Handle 1000+ concurrent matches without server falling over.

### Architecture changes

#### Multi-instance server

Single VPS → multiple replicas:
- Load balancer (nginx or Cloudflare) → distributes WS connections
- Server instances share room state через Redis
- Match state still in-memory (don't shard active matches — complex)
- Stickiness: clients reconnect to same instance via resumeToken

#### Redis для shared state

Operations:
- `SADD active_rooms roomCode`
- `HSET room:roomCode players ["p1", "p2"]`
- `SUBSCRIBE matchmaker_queue` — global queue
- `PUBLISH matchmaker_queue {userId, rating, joinTime}`

#### Monitoring

- Prometheus metrics endpoint `/metrics`:
  - `active_connections` gauge
  - `active_matches` gauge
  - `matches_completed_total` counter
  - `matchmaking_wait_seconds` histogram
  - `tick_duration_seconds` histogram
- Grafana dashboard для real-time visualization

#### CDN

Static frontend → Cloudflare:
- Cache `/assets/*` aggressively
- Cache `/index.html` с short TTL
- Reduce VPS bandwidth costs

#### Auto-scaling (later, Stage 10+)

- Kubernetes / Docker Swarm для server replicas
- HorizontalPodAutoscaler на CPU и active_matches metric

### Migration story

1. Day 1-2: Redis setup, shared room state pub/sub
2. Day 3: Multi-instance testing on staging
3. Day 4: Prometheus + Grafana
4. Day 5: Cloudflare CDN + deploy

### Tests

- Mock Redis client tests
- Multi-instance pub/sub flow
- Failover when one instance dies
- Metrics endpoint format

### Acceptance

- 2+ server instances handle traffic together
- One instance dying doesn't kill all matches
- Metrics visible в Grafana
- Tests: +10

---

## Cross-cutting concerns

### Testing strategy

- Unit tests for all new logic (target +50 в Stage 9)
- Integration tests for protocol changes
- E2E tests (Playwright) для full user journeys через staging:
  - Find match flow
  - Spectator viewing
  - Config selection in lobby
- Load tests (k6 or artillery) для multi-instance setup

### Migration strategy

- Stage 8 production data: keep, не breaking changes
- New SQLite/Postgres DB starts empty
- Anonymous users get auto-created on first connection (compat)
- URL-based rooms (Stage 8 style) keep working alongside matchmaker (Stage 9)

### Performance budget

- Server tick processing < 10ms (currently ~2ms)
- Matchmaking sweep < 50ms per cycle
- Database queries < 5ms p95
- WS message round-trip < 100ms p95
- Bundle size: main < 200 KB raw (currently 134 KB после Day 37)

### Observability

- Server logs structured JSON (Pino library, structured fields)
- Frontend errors → Sentry (optional, ~10 KB SDK)
- Audit trail: who joined what room, when

### Security

- Rate limiting (existing Stage 8 stays)
- JWT for auth (Stage 9.6) — short-lived (1 hour) + refresh tokens
- Input validation на все REST endpoints (zod schemas)
- SQL injection: parameterized queries (Drizzle / Prisma)
- XSS: React escapes by default, careful с dangerouslySetInnerHTML

---

## Acceptance criteria для Stage 9 closure

### Functional

- [ ] Host выбирает win condition в lobby (9.1)
- [ ] Каждый match сохранён в БД (9.2)
- [ ] "Find match" finds opponent в <30s avg (9.3)
- [ ] Spectator mode works через ?spectate URL (9.4)
- [ ] Public replays browsable в Sandbox tab (9.5)
- [ ] Sign-in works (9.6, optional)
- [ ] Leaderboard shows top 100 (9.7)
- [ ] Multi-instance server handles failover (9.8)

### Non-functional

- [ ] All tests pass (target 700+)
- [ ] E2E suite covers main journeys (5+ tests)
- [ ] Main bundle ≤ 200 KB raw
- [ ] p95 latency < 100ms
- [ ] 0 production incidents in 7 days после deploy
- [ ] Prometheus metrics live
- [ ] Documentation updated (wiki, CHANGELOG, ROADMAP)

### Tooling

- [ ] CI/CD pipeline для server (deploy on tag push)
- [ ] Database migration tool wired (Drizzle migrations)
- [ ] Backup strategy для DB (daily snapshot)

---

## Open questions

### Architectural

1. **SQLite vs Postgres для 9.2** — start with SQLite, migrate when scaling vs jump straight to Postgres?
   - **Recommended**: SQLite сначала. Postgres migration в 9.8 если стало нужно.

2. **R2 vs DB-stored replays** — inline в SQLite vs object storage?
   - **Recommended**: inline до 100k replays (~500 MB), затем migrate.

3. **Anonymous vs authenticated default** — auth required для leaderboards?
   - **Recommended**: anonymous OK, but rating only counts если пользователь posted ≥5 matches.

4. **JWT vs session cookies** — для auth flow?
   - **Recommended**: JWT для simplicity (no session store).

### Game design

5. **3-10 player matches** — push to Stage 10 (team modes) или сделать в Stage 9?
   - **Recommended**: defer to Stage 10. Stage 9 focuses на 2-player polish.

6. **Replay public/private** — default public или private?
   - **Recommended**: public default, optional private flag в Stage 9.6 (если auth).

7. **Rematch с custom config** — should rematch preserve config or reset to default?
   - **Recommended**: preserve (current Stage 8 behavior fits hold_majority too).

### Infrastructure

8. **Sticky sessions для multi-instance** — load balancer sticky vs Redis-based?
   - **Recommended**: Redis-based — survives load balancer failure too.

9. **Monitoring stack** — Prometheus self-hosted vs managed (Grafana Cloud)?
   - **Recommended**: self-hosted on same VPS first. Migrate если резко grows.

10. **Backup frequency** — daily snapshots достаточно?
    - **Recommended**: daily для start, hourly после Stage 10 launch.

---

## Estimated timeline

| Stage | Days | Calendar (5 days/week) |
|---|---|---|
| 9.1 Server config | 3 | Week 1 |
| 9.2 Persistence | 4 | Week 1-2 |
| 9.3 Matchmaker | 5 | Week 2 |
| 9.4 Spectator | 3 | Week 3 |
| 9.5 Replay browser | 3 | Week 3 |
| 9.6 Auth (optional) | 3 | Week 4 (skip if pressed) |
| 9.7 Leaderboards | 4 | Week 4-5 |
| 9.8 Infra | 5 | Week 5-6 |
| **Total** | **30** | **~6 calendar weeks** |

### Скип scenarios

Если pressed for time, skip в порядке убывания importance:
1. 9.6 Auth (full optional)
2. 9.8 Multi-instance (single VPS still handles 100+ concurrent if no leak)
3. 9.5 Replay browser (replays still saveable, just no UI to browse)

**Minimum viable Stage 9**: 9.1 + 9.2 + 9.3 + 9.7 = ~16 days. Adds matchmaker + leaderboards on top of saved persistence.

---

## Closure ceremony (Day 30 of Stage 9)

- CHANGELOG.md → v0.3.0 entry
- ROADMAP.md → Stage 9 marked closed, Stage 10 (public launch) planned
- DEVLOG.md → final summary
- v0.3.0 git tag
- Release notes posted to GitHub Releases
- Wiki: API pages для всех new modules
- Stage 10 prep: blog post draft, Discord setup

---

*Этот документ ​версии: draft v1, 2026-05-30. Living spec — updated по мере implementation discoveries.*
