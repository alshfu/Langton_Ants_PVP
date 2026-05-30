# Langton Arena · Roadmap & Wishlist

> Где мы сейчас, куда движемся, и что ждёт за горизонтом.

**Последнее обновление:** 2026-05-30, Day 34 of Stage 8

---

## 📍 Краткое резюме статуса

| | Значение |
|---|---|
| **Текущая стадия** | Stage 8 (PvP MVP), Day 34 of ~40 |
| **Готовность к публичному запуску** | ~85% — основные механики работают, требуется polish |
| **Tests** | 538/538 (301 web + 131 core + 106 mvp-server) |
| **Production deploy** | https://alshfu.github.io/Langton_Ants_PVP/ (frontend) · wss://alshfu.com (server) |
| **Bundle size** | 231 KB raw / 71 KB gzip |
| **Server image** | 192 MB Docker, ~50 MB RAM idle |
| **Active users** | 0 (pre-launch, нет публикации) |

**Что работает прямо сейчас:**
- Полный PvP цикл: lobby → countdown → matched → result
- Bot opponent (3 difficulty levels, smart sim tracking)
- Sandbox: 13 presets, replay recording/playback, snapshot step-back
- Audio: dynamic music + milestone stingers + SFX, per-channel volumes
- Mobile responsive, onboarding hints, rematch flow
- Live HUD: territory %, ant count, countdown timer, critical pulse

**Что не работает / отсутствует:**
- Custom win conditions в PvP (logic готов, но server использует fixed time)
- Spectator mode (только 2 players в room)
- Persistent stats / leaderboard / accounts
- Matchmaking (random opponents, не only по invite URL)
- More than 2 players в PvP matches

---

## 📊 Timeline & Stages

```
Stage 1-2:  ┃▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Sandbox v1, observe & setup
Stage 3:    ┃░░░░░░░░░░▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Detrandomization
Stage 4:    ┃░░░░░░░░░░░░░▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Analytics & insights
Stage 5:    ┃░░░░░░░░░░░░░░░░▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Mutations & win conditions
Stage 6:    ┃░░░░░░░░░░░░░░░░░░░▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Reserve & Deploy
Stage 7:    ┃░░░░░░░░░░░░░░░░░░░░░▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░  Replay & sharing
Stage 8:    ┃░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░  ← PvP MVP (текущий)
Stage 9:    ┃░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▓░░░░  Matchmaking + persistence
Stage 10:   ┃░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓  Public launch + community
```

---

## ✅ Stages 1-7 (Sandbox) — закрыто

**60 дней работы, фундамент.** Подробности в [DEVLOG.md](./DEVLOG.md).

### Что построено:

| Stage | Дни | Ключевое достижение |
|---|---|---|
| 1 — Прототип | 1-3 | Vanilla React через Babel-standalone, 1.7MB single HTML |
| 2 — Visual & stats | 38-40 | Skins, live stats, TerritoryChart, sparklines |
| 3 — Detrandomization | 41-43 | Step back + snapshots, **deterministic** PRNG |
| 4 — Analytics | 44-47 | Events log, heatmaps, highlights, E2E audit v3 |
| 5 — Mutations | 48-51 | Halo / Mirror / Path + 5 win conditions + MatchBanner |
| 6 — Reserve & Deploy | 52-55 | Mешки муравьёв, deploy click → instant ant |
| 7 — Replay | 57-60 | Replay = inputs (не states), URL share, JSON export/import |

**Bundle на конце Stage 7:** 132 KB JS / 39 KB gzip (без PvP).  
**Tests на конце Stage 7:** 115/115.

---

## 🚧 Stage 8 (PvP MVP) — текущий, ~85% готов

**34 дня работы, ~40 запланированы.** [Wiki Devlog](https://github.com/alshfu/Langton_Ants_PVP/wiki/Devlog)

### Что готово:

| Кластер | Дни | Что |
|---|---|---|
| **Backend foundation** | 1-7 | Monorepo (@langton/core), WS server, room manager, MatchScreen v1 |
| **Real matches** | 8-12 | Countdown, server-driven ticks, client prediction, replay save |
| **Production hardening** | 13-15 | Reconnect grace, rate limiting, graceful shutdown |
| **Side: VPS deploy** | 14 | Render → Aeza VPS, alshfu.com, certbot, systemd |
| **Side: Reddit promotion** | 15 | Bot-failed promotion (autospam filter) |
| **UX polish** | 16-22 | Palette, mobile responsive, audio FX, QR code, scoreboard, rematch, sandbox audio |
| **Audio refinement** | 23-28 | Onboarding hints, dynamic music, volume panel, milestones, sandbox music |
| **Match HUD** | 29-30 | Ants count, time remaining, critical pulse, match preview card |
| **Bot opponent** | 31-33 | Client-side bot (3 difficulty), menu redesign, smart sim tracking |
| **Win conditions** | 34 | hold_majority kind (логика готова, ждёт PvP integration) |

### Что ещё хочется в Stage 8 (Days 35-40):

- [ ] **Server config selection (Stage 8.5)** — host выбирает win condition в lobby
  - Требует: server protocol extension (`join_room.requestedConfig`)
  - Заодно: grid size, mutations on/off, holdTicks tuning
  - Priority: **HIGH** — user уже asked, и нужно для real strategic depth
- [ ] **hold_majority в PvP** — quick hack через defaultMatchConfig + holdCounter scoreboard indicator
- [ ] **Sandbox HUD parity** — LiveScoreboard overlay в Sandbox run mode (MatchTimer + ants count)
- [ ] **Performance pass** — bundle 231 KB → ideally <200 KB через code splitting (Sandbox lazy load)
- [ ] **E2E v5** — обновить audit для всех new features (audio settings, milestones, bot, menu)
- [ ] **Cross-browser test** — Firefox, Safari (sometimes WebAudio behavior differs)
- [ ] **i18n cleanup** — many new strings без переводов (только en default)

### Stage 8 closure checklist:
- [ ] Все listed Day 35-40 фичи закрыты
- [ ] E2E v5 показывает 0 fail / 0 warn на production
- [ ] Документация: API pages для всех новых modules
- [ ] Release v0.2 GitHub tag
- [ ] CHANGELOG.md создан

---

## 🔮 Stage 9 — Matchmaking & Persistence (планируется)

**Цель:** превратить one-shot URL-shared rooms в полноценный multiplayer service с rankings.

### Ключевые фичи:

#### 1. Server-side per-room config (Day 1-3 Stage 9)
- Client sends desired `MatchConfig` в `join_room` или separate `set_room_config`
- Server validates, applies (только host может change)
- Lobby UI: dropdown'ы для win condition, grid size, mutations
- **Unblock:** hold_majority в PvP, custom 3-player matches, etc

#### 2. PostgreSQL persistence (Day 4-7)
- Schema: `users`, `matches`, `replays`, `match_results`
- Anonymous user → device-id based identity (no auth required)
- Optional accounts (email/password или OAuth) — для cross-device
- **Unblock:** stats, history, leaderboards

#### 3. Matchmaker service (Day 8-12)
- ELO/SR-based rating (start at 1500)
- Expanding-window matchmaking (start ±50, expand to ±200 over 30s)
- Queue + estimated wait time
- Bot fallback если queue too long
- **Unblock:** random opponents, "Find match" button without share URL

#### 4. Spectator mode (Day 13-15)
- 3-rd+ connection в room observes
- Watch live match without playing
- `spectator: true` flag в `join_room`
- Server doesn't expect them to set_ready
- **Unblock:** community broadcasts, streamer support

#### 5. Replay browser (Day 16-18)
- R2 / S3 storage для replays
- Browse public replays на Sandbox → Replays tab
- Filter by date, winner, config type
- Share replay URL → opens in playback mode
- **Unblock:** competitive replays sharing

#### 6. Authentication (Day 19-21, optional)
- Sign in with Google / GitHub
- Profile page с stats
- Username claim (для leaderboards)
- **Unblock:** persistent identity

#### 7. Leaderboards (Day 22-25)
- Global ELO ranking
- Weekly / monthly tournaments
- Top 100 displayed
- **Unblock:** competitive motivation

#### 8. Performance & infrastructure (Day 26-30)
- Multi-instance server через Redis pub/sub
- CDN для static assets (Cloudflare)
- Monitoring (Prometheus + Grafana)
- Health checks, auto-scaling
- **Unblock:** scale to 1000+ concurrent matches

### Stage 9 estimated: **~30 days work**, ~6 недель календарно.

---

## 🌌 Stages 10+ (future)

### Stage 10 — Public launch & community
- Promotion: r/cellular_automata, r/playmygame (proper account), HackerNews, itch.io
- Discord server для community feedback
- First **public alpha** announcement
- Bug tracking workflow
- Daily playtest gathering

### Stage 11 — Game modes expansion
- 3-10 player team modes (2v2, free-for-all)
- Tournament brackets
- Custom rules sandbox (user-defined Langton rules: LR, RLR, LRLR, custom strings)
- Map editor (user-uploaded starting territory layouts)

### Stage 12 — Native & mobile
- Capacitor wrap → iOS / Android stores
- Touch controls optimization
- Offline mode (bot only)
- Push notifications для match invitations

### Stage 13 — Social & metagame
- Friend system
- Voice chat via WebRTC
- Stream integration (Twitch overlays)
- Cosmetics: ant skin packs, deploy effects
- Achievement system

### Stage 14 — Engine extension
- New cellular automata: Wireworld, Brian's Brain, Hodgepodge
- 3D variants (хм, может быть)
- Procedural map generation

---

## 🌟 Wishlist (idea backlog)

### Game design ideas
- [ ] **Powerups**: temporary ant speedup, territory shield, EMP deploy
- [ ] **Resources mode**: cells produce "credits", spend on bigger deploys
- [ ] **Defensive structures**: walls, towers (block ants)
- [ ] **Multi-rule players**: каждый игрок имеет 3 rules, может switch
- [ ] **Asymmetric matches**: 1v3 with player 1 having more ants
- [ ] **Roguelike**: progress through escalating opponents
- [ ] **Daily challenge**: same seed/config, leaderboard
- [ ] **Replay annotations**: commentary track over a replay

### Tech ideas
- [ ] WASM engine — even faster, потенциально 60+ TPS matches
- [ ] WebGPU rendering — 10000+ ants на screen
- [ ] Headless server (Node → Rust port) — handle 1000+ concurrent
- [ ] Edge functions (Cloudflare Workers) для matchmaker
- [ ] gRPC streaming как alternative to WebSocket
- [ ] MessagePack binary protocol (currently JSON)
- [ ] Determinism cross-platform verification suite

### UX ideas
- [ ] **Practice mode** — bot adjusts difficulty based on your performance
- [ ] **Game theory viewer** — show analysis of optimal deploy strategies
- [ ] **Coach mode** — AI suggests next move
- [ ] **Custom alpha presets** — share presets via URL (currently 13 hardcoded)
- [ ] **Match commentary** — auto-generated text summary post-match
- [ ] **Time-of-day theme** — light/dark mode based на user local time
- [ ] **A11y polish** — full keyboard nav, screen reader support
- [ ] **Right-to-left languages** — Arabic, Hebrew layout adjustments

### Audio ideas (Day 35+?)
- [ ] **Spatial audio** — pan stingers по deploy location
- [ ] **Voice line-up** — "First blood!", "Comeback!" voice samples
- [ ] **Multiple music tracks** — rotate через matches
- [ ] **Music customization** — user uploads own loop
- [ ] **Sound packs** — different SFX themes (8-bit / sci-fi / orchestral)

---

## ❓ Open questions / decisions to make

### Architecture
1. **Server scaling**: при росте, как scale? Multi-instance via Redis? Edge functions? Currently single VPS, max ~100 concurrent matches.
2. **Storage**: PostgreSQL vs MongoDB vs SQLite-on-VPS? Latency vs cost tradeoff.
3. **Bot location**: client-side (current) vs server-side (better for "vs strong AI" mode)?
4. **Protocol**: JSON OK для MVP, но MessagePack для production может save 30% bandwidth.

### Game design
1. **Default win condition**: time vs hold_majority? User uppy для hold_majority — but it's deeper learning curve.
2. **Match duration**: 30 sec slot — too short для strategy? Hold_majority может make it 60-120 sec.
3. **Grid size default**: 60×60 OK, но some players might want larger.
4. **Mutation balance**: Halo dominates currently — Mirror, Path practically never fire. Rebalance needed?
5. **Bot accessibility**: should Easy be even easier для true beginners?

### Business / community
1. **Monetization**: фоллo paid? Patreon? Cosmetics? **Most likely free MIT-licensed open-source.**
2. **Promotion timing**: launch when? Need critical mass для matchmaker work — chicken-and-egg.
3. **Contribution policy**: PRs welcome? Need CONTRIBUTING.md, code of conduct.
4. **Domain**: alshfu.com OK для дев'а — for public launch may need brandable name.

---

## 🎯 Success metrics & KPIs

### Stage 8 closure success
- ✅ 500+ tests passing
- ✅ E2E v5 on production: 0 fail
- ✅ Bundle <250 KB raw (currently 231)
- ✅ Bot опон вызывает >50% win rate против human тестеров
- ⏳ 5 friends-of-friends play 1+ match each
- ⏳ Stage 8 closure announcement post on personal blog

### Stage 9 success
- 100+ matches played в первую неделю после launch
- Matchmaker median wait time <30 sec
- 0 critical bugs reported в первые 7 days production
- 10+ replays shared publicly
- 3+ external contributors (PRs merged)

### Stage 10 launch success
- 1000+ unique visitors в первый месяц
- 100+ daily active users (DAU) sustained
- 1+ Twitch streamer playing
- 50+ Discord members
- Featured on hacker news / reddit r/programming

### Long-term (1 year+) success
- 10k+ matches played всего
- Top 100 leaderboard meaningful (not all top players have <10 games)
- 5+ active contributors
- Forked by 1+ similar project
- Citation в game design / cellular automata academic paper (would be amazing)

---

## 🚫 Explicitly out of scope (for now)

- **Monetization features** — paywalls, ads, subscriptions. Project optimized for open-source community over revenue.
- **Voice chat / video** — too much complexity for unclear value. Use Discord parallel session if needed.
- **Mobile native apps** — web mobile is good enough for now. Capacitor wrap может прийти в Stage 12.
- **3D rendering** — Langton's Ant is inherently 2D. 3D variants are research project, not core product.
- **Real-time tournaments** — too much infrastructure для one-person-team. Stage 13+.
- **Esports integration** — слишком early. Need 10k+ regular players first.

---

## 🗺️ Repository / docs map

```
Langton_Ants_PVP/
├── README.md              ← project overview, install, quickstart
├── CLAUDE.md              ← Claude Code instructions
├── DEVLOG.md              ← daily journal (chronological), Stages 1-8
├── ROADMAP.md             ← this file
├── LICENSE                ← MIT
├── langton-arena-web/     ← Vite + React + TypeScript frontend
│   ├── src/core/          ← engine, contracts, shared logic
│   ├── src/screens/       ← Menu, Sandbox, Match, Profile, etc
│   ├── src/components/    ← LangtonField, MatchPreview, BotDialog, etc
│   ├── src/lib/           ← pure helpers (audio, music, bot, scoreboard, ...)
│   └── public/presets/    ← 13 встроенных configs
├── langton-arena-backend/
│   ├── core/              ← @langton/core shared package
│   └── services/mvp-server/ ← WebSocket PvP server
└── ux-prototype/          ← Vanilla JSX v1 reference
```

**Externals:**
- Wiki: https://github.com/alshfu/Langton_Ants_PVP/wiki — public docs, API reference, daily devlog
- Production: https://alshfu.github.io/Langton_Ants_PVP/ — live game
- Server: wss://alshfu.com — production WebSocket

---

## 🤝 How to contribute (when ready for external help)

> Currently project is **solo + AI** (Claude Code). External contributions will be welcomed after **Stage 9** when foundation is more stable.

When that happens:
1. Read DEVLOG.md to understand history
2. Read this ROADMAP.md to see what's planned
3. Check open GitHub issues
4. Submit PR with tests

For now, **feedback и playtesting** is the most valuable contribution:
- Play 1-2 matches
- Note anything confusing, broken, или delightful
- Open GitHub issue с details (browser, screenshot, expectation)

---

## 📝 Changelog summary

- **2026-05-30** Day 34: hold_majority win condition (логика)
- **2026-05-30** Day 33: Smart bot v2 (sim tracking, frontier targeting)
- **2026-05-30** Day 32: Menu PvP entry redesign
- **2026-05-30** Day 31: Bot opponent с 3 difficulty levels
- **2026-05-30** Day 30: Match preview card в lobby
- **2026-05-30** Day 29: Match HUD (ants count, timer, critical pulse)
- **2026-05-30** Day 28: Sandbox audio parity
- **2026-05-29** Day 27: Match milestone stingers + banners
- **2026-05-29** Day 26: Volume controls per channel (master/music/sfx)
- **2026-05-29** Day 25: Dynamic gameplay music (4-voice sequencer)
- **2026-05-29** Day 24: First-time onboarding hints
- **2026-05-29** Day 23: Rematch flow
- **2026-05-29** Day 22: Sandbox audio wire
- **2026-05-29** Day 21: Beautiful sound design (layered synth)
- **2026-05-29** Day 20: Live territory scoreboard
- **2026-05-29** Day 19: QR code in lobby + Web Share API
- **2026-05-29** Day 18: Procedural WebAudio FX
- **2026-05-29** Day 17: Mobile responsive
- **2026-05-29** Day 16: High-contrast 10-player palette
- **2026-05-29** Day 15: Edge cases (graceful shutdown + orphan lobby)
- **2026-05-29** Day 14: Rate limiting + error budget
- **2026-05-29** Day 13: Reconnect grace + resume token
- **2026-05-29** Day 12: PvP replay saving
- **2026-05-29** Day 11: Match end banner + replay URL
- **2026-05-29** Day 10: Client-side prediction (ghost overlays)
- **2026-05-29** Day 9: Server-driven ticks + deploy click
- **2026-05-29** Day 8: Countdown timer + playing phase
- **2026-05-29** Day 7: MatchScreen — connecting + lobby
- **2026-05-29** Day 6: WSClient + shared protocol types
- **2026-05-29** Day 5: Deploy validation + queue
- **2026-05-29** Day 4: Match lifecycle (countdown → tick loop → ended)
- **2026-05-29** Day 3: Room logic + random animal nicknames
- **2026-05-29** Day 2: mvp-server boilerplate (WS:8080 + i18n × 10)
- **2026-05-29** Day 1: engine → backend/core/ as @langton/core
- **earlier 2026** Stages 1-7: Sandbox (60 days)

---

*This roadmap is living document. Updated end-of-day at significant milestones.*
