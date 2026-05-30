# Changelog

All notable changes to Langton Arena PvP project.

Format follows [Keep a Changelog](https://keepachangelog.com/) loosely.

---

## v0.2.0 — Stage 8 PvP MVP closure (2026-05-30)

**The PvP-complete release.** Полный real-time multiplayer на основе Langton's Ant. ~~MVP~~ — actual playable game.

### Added

#### Multiplayer infrastructure (Days 1-15)
- WebSocket server (`mvp-server`) with 14-message protocol
- Room lifecycle: lobby → countdown → playing → finished
- Server-driven ticks @ 10 TPS with client-side prediction
- Optimistic ghost overlays + reconciliation by `{x, y, tick}` context
- Reconnect grace period + resume tokens (UUID via sessionStorage)
- Rate limiting (sliding window: 5 deploys/sec, 30 msgs/sec, 5 errors/10sec)
- Graceful shutdown — broadcasts `match_ended` with `reason: 'server_shutdown'`
- Orphan lobby timeout (10 min default)
- VPS deploy on Aeza (`wss://alshfu.com`) — nginx + certbot + systemd

#### UX polish (Days 16-24)
- High-contrast 10-player palette (36° HSL rotation)
- Mobile responsive — adaptive cellSize, touch-action, flex-wrap
- 6 procedural WebAudio FX (countdown, deploy, victory, defeat, tie, ui_click)
- QR code in lobby + Web Share API (`qrcode-generator` ~3 KB)
- Live territory scoreboard
- Rematch flow (`request_rematch` + 60s timeout + `resetForRematch`)
- First-time onboarding hints (3 contextual banners, localStorage-persisted)

#### Audio expansion (Days 25-28)
- Day 25: Dynamic gameplay music — 4-voice sequencer (bass/pad/drum/lead) with lookahead scheduler (Chris Wilson 2013 pattern)
- 3 mood progressions (neutral/winning/losing) with HSL-style chord shifts
- Day 26: Per-channel volume controls (master/music/sfx) with `subscribeVolumeChanges` pattern
- Day 27: Match milestone stingers (50%/75%/25% crossings, lead change) + overshoot-animated banners
- Day 28: All audio extended to Sandbox

#### Match HUD (Days 29-30)
- Ants alive count per player in scoreboard
- Time remaining countdown with urgency pulse (last 10s)
- Critical state pulse animation (<25% territory)
- Match preview card in lobby (shows config before clicking Ready)

#### Bot opponent (Days 31-33)
- Client-side bot via secondary WebSocket (zero server changes)
- 3 difficulty levels (Easy/Normal/Hard) with distinct timing + targeting
- Day 33 smart bot: sim state tracking through shared `@langton/core` engine
- Frontier targeting (`findFrontierCells` — adjacent to enemy in Hard)
- Jittered intervals (±20% randomness)
- Initial burst (first 3 deploys faster for opening)
- Adaptive Hard panic mode (50% faster when losing >5%)
- Menu redesign — Play vs Bot + Play vs Friend prominent
- Room code generator (no ambiguous chars: I/l/O/0/1)

#### Game design (Day 34)
- `hold_majority` win condition kind — first to >threshold% territory holding N consecutive ticks
- Reset counter on dropping below threshold — comeback potential
- 9 unit tests for new logic
- Server integration (Day 35) via `MATCH_WIN_KIND` env var

#### Stage 8 closure (Days 35-40)
- Day 35: `hold_majority` server integration with `holdMajorityTick` shared helper
- Day 36: Sandbox HUD parity — `LiveScoreboard` + `MatchTimer` extracted to `@components/LiveHUD`
- Day 37: Code splitting via `React.lazy` — **main bundle 230 KB → 134 KB (-42%)**, Sandbox lazy-loaded
- Day 40: This release

### Changed

- Bundle structure: 1 main JS → main + 9 chunks (lazy on-demand)
- Sandbox screen now loads on-demand (-91 KB from initial load)
- `WinCondition` interface gains optional `holdTicks?: number`
- `MatchResult` interface gains optional `holdCounters?: Record<string, number>`

### Fixed

- `vitest.config.ts` setupFiles regression (localStorage polyfill)
- `vite.config.ts` GitHub Pages base path
- `src/state/presets.ts` BASE_URL-aware fetch paths
- Critical pulse animation no longer affects eliminated players
- Bot doesn't request rematch (disconnects properly on match_ended)

### Tech debt acknowledged (deferred to Stage 9)

- Custom config selection in lobby (host picks win condition + grid + mutations)
- Multi-instance server (currently single VPS)
- Real authentication (currently anonymous via device-id)
- Replay browser UI (R2 storage)
- Matchmaker service (ELO/SR rating)
- Spectator mode

### Numbers

- **538/538 tests pass** (301 web + 139 core + 106 mvp-server) — was 115 at Stage 7 closure
- **Bundle**: 134 KB main + 91 KB lazy Sandbox + ~10 KB other chunks (was 132 KB single chunk at Stage 7)
- **Gzip**: 46 KB main (was 39 KB at Stage 7) — almost no growth despite 4x feature volume
- **0 TypeScript errors** in strict mode (`noUncheckedIndexedAccess`)
- **0 production incidents** during 5 days live on Aeza VPS
- **40 days** of Stage 8 work (planned ~40, actual ~40)

### Architecture decisions

- **Shared engine** between client/server via `@langton/core` — paid off 5+ times (replay, bot, reconnect, debugging, test reproducibility)
- **Deterministic engine** — `Math.random` removed from hot path; replay = inputs (not states)
- **Procedural audio** — zero assets, 8 KB raw synthesis
- **Client-side bot** — secondary WS in same tab, zero server changes
- **In-memory state, single instance** — for MVP; Stage 9 migrates to Redis

---

## v0.1.0 — Stage 7 Sandbox closure (earlier 2026)

60 days of sandbox development across Stages 1-7. Foundation for Stage 8 PvP work.

See [DEVLOG.md](./DEVLOG.md) for day-by-day details.

### Stage highlights

- **Stage 1-2**: prototype + observability
- **Stage 3**: detrandomization (the critical architecture decision)
- **Stage 4**: events log, heatmaps, highlights
- **Stage 5**: mutations + 5 win conditions
- **Stage 6**: reserve mode + deploy system
- **Stage 7**: replay system (= inputs, not states), URL sharing

### Numbers at Stage 7 closure

- 115/115 tests
- 132 KB JS / 39 KB gzip
- 0 TypeScript errors in strict mode
- 13 built-in presets
- 15/15 presets play back bit-identical via replay

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for upcoming Stage 9+ plans.
