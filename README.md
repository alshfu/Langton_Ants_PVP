# 🐜 Langton Arena PvP

> **Multiplayer PvP territory game** on a shared grid powered by **Langton's Ant** cellular automaton.
> 2–10 players, deterministic engine, real-time competition, replay system, ELO matchmaking.

<p align="center">
  <a href="https://alshfu.github.io/Langton_Ants_PVP/"><b>▶ PLAY LIVE DEMO</b></a> ·
  <a href="https://github.com/alshfu/Langton_Ants_PVP/wiki">📚 Wiki</a> ·
  <a href="https://github.com/alshfu/Langton_Ants_PVP/issues">🐞 Issues</a>
</p>

<p align="center">
  <a href="https://alshfu.github.io/Langton_Ants_PVP/"><img src="https://img.shields.io/badge/demo-live-brightgreen?style=flat-square" alt="Live demo"></a>
  <img src="https://img.shields.io/badge/tests-138%2F138-brightgreen?style=flat-square" alt="138 tests">
  <img src="https://img.shields.io/badge/E2E_v4.0-175_pass_0_fail-brightgreen?style=flat-square" alt="E2E green">
  <img src="https://img.shields.io/badge/stage-7.9-blue?style=flat-square" alt="Stage 7.9">
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT">
  <img src="https://img.shields.io/badge/typescript-strict-3178c6?style=flat-square&logo=typescript" alt="TS strict">
  <img src="https://img.shields.io/badge/react-18-61dafb?style=flat-square&logo=react" alt="React 18">
</p>

---

## 🎮 What is it

A **competitive cellular automaton arena**. Each player drops Langton's Ants onto a shared grid; the ants follow a deterministic turning rule and paint cells with their owner colour. Goal: dominate territory.

- **26 built-in presets** — from `compass-cross` (4-fold rotational symmetry) to `chaos-eight` (8-player mayhem)
- **4 field topologies** — `torus` / `wall` / `bounce` / `void` (ants actually die on edge)
- **5 win conditions** — domination, elimination, survival, extinction, first death
- **Mutation system** — halo / mirror / path mutants with deterministic triggers
- **Reserve & deploy** — births accumulate in a bag; deploy on click with 3 placement rules
- **Replay engine** — bit-identical playback, save/share via URL (lz-string) or JSON
- **Loop playback** + media-style transport (▶ ⏸ ⏮ ⏹ 🔂)
- **Field up to 1000×1000** with adaptive snapshots

All in a single React+TypeScript SPA, deployed to GitHub Pages — no backend required to play.

---

## ⚡ Quick start

```bash
git clone https://github.com/alshfu/Langton_Ants_PVP.git
cd Langton_Ants_PVP/langton-arena-web
npm install
npm run dev          # → http://localhost:5173
```

Open browser, click **Sandbox**, pick a preset, hit **▶ Run**.

---

## 🏗 Project structure

```
Langton_Ants_PVP/
├── langton-arena-web/         ← React 18 + Vite SPA  (the deployed app)
│   ├── src/
│   │   ├── core/langton/      ← deterministic engine (no Math.random in tick loop)
│   │   ├── components/        ← LangtonField (Canvas), HeatmapLegend, MatchBanner
│   │   ├── screens/sandbox/   ← 11 tabs: Players, Ants, Stats, Events, Field, Combat,
│   │   │                        Birth, Mutations, Visual, Presets, Replays
│   │   └── lib/               ← utilities (replay, urlShare, simSnapshot, …)
│   ├── public/presets/        ← 26 preset JSONs
│   └── public/replays/        ← 3 demo replays
├── langton-arena-backend/     ← microservices (5×), Node.js + TS — not deployed yet
└── ux-prototype/              ← original vanilla JSX prototype, kept as reference
```

---

## 🧪 Tech & quality

| Layer       | Stack |
|-------------|-------|
| Frontend    | React 18 · Vite · TypeScript strict · Canvas API |
| Determinism | mulberry32 PRNG (init only) · integer arithmetic in tick loop |
| Tests       | **138/138** vitest · 14 test files covering engine, mutations, win conditions, replay, URL share, deploy validation, topology |
| E2E         | Playwright audit v4.0 — 27 sections incl. Web Vitals, pixel-diff, A11y, multi-viewport, network audit — **175/0/0** on prod |
| Deploy      | GitHub Pages (manual via `gh-pages` branch) |
| Wiki        | [github.com/alshfu/Langton_Ants_PVP/wiki](https://github.com/alshfu/Langton_Ants_PVP/wiki) — 30+ pages of API docs + devlog |

---

## 📚 Documentation

| Page | Topic |
|------|-------|
| [Wiki Home](https://github.com/alshfu/Langton_Ants_PVP/wiki) | Index of all docs |
| [Game-Engine](https://github.com/alshfu/Langton_Ants_PVP/wiki/Game-Engine) | Deterministic algorithm, PRNG, tick loop phases |
| [Replay-System](https://github.com/alshfu/Langton_Ants_PVP/wiki/Replay-System) | Record / save / play / share architecture |
| [E2E-Audit](https://github.com/alshfu/Langton_Ants_PVP/wiki/E2E-Audit) | Playwright audit v4.0 — sections, budgets, artefacts |
| [Devlog](https://github.com/alshfu/Langton_Ants_PVP/wiki/Devlog) | Stage-by-stage changelog from Stage 1 to Stage 7.9 |
| [API-engine](https://github.com/alshfu/Langton_Ants_PVP/wiki/API-engine) · [API-replay](https://github.com/alshfu/Langton_Ants_PVP/wiki/API-replay) · [API-urlShare](https://github.com/alshfu/Langton_Ants_PVP/wiki/API-urlShare) | Module API reference |

---

## 🤝 Contributing

PRs welcome. The codebase has strict TypeScript, 138 vitest tests, and a Playwright audit that must stay green. See [Contributing](https://github.com/alshfu/Langton_Ants_PVP/wiki/Contributing) for setup.

If you find a bug → [open an issue](https://github.com/alshfu/Langton_Ants_PVP/issues/new). If you build a cool preset or rule mod → send a PR with a JSON in `langton-arena-web/public/presets/` + entry in `index.json`.

---

## 📖 На русском

Полная документация по-русски — в [wiki](https://github.com/alshfu/Langton_Ants_PVP/wiki).
Devlog с историей изменений: [Devlog.md](https://github.com/alshfu/Langton_Ants_PVP/wiki/Devlog).

Если коротко: это многопользовательская PvP-игра на клеточных автоматах. Откройте [демо](https://alshfu.github.io/Langton_Ants_PVP/), нажмите Sandbox, выберите пресет, ▶ Run.

---

## 📜 License

MIT — see [LICENSE](./LICENSE).

---

⭐ **If you find this interesting, please star the repo** — it helps surface the project in GitHub search and motivates further development.
