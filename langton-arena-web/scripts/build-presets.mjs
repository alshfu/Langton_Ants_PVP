// scripts/build-presets.mjs
//
// Генерирует JSON-файлы пресетов в public/presets/.
// Запускается один раз вручную: `node scripts/build-presets.mjs`.
// Можно перегенерировать после изменения spawn-патернов.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'presets');

// Простой mulberry32 inline (то же что в core/langton/prng.ts)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ─── Spawn functions (упрощённые копии из lib/spawnPatterns.ts) ──────────────

function spawnRadial({ playerIndex, totalPlayers, fieldW, fieldH, antCount }) {
  const cx = fieldW / 2, cy = fieldH / 2;
  const radius = Math.min(fieldW, fieldH) * 0.35;
  const ants = [];
  for (let i = 0; i < antCount; i++) {
    const sector = (Math.PI * 2) / totalPlayers;
    const base = playerIndex * sector;
    const offset = antCount > 1 ? (i / (antCount - 1) - 0.5) * sector * 0.8 : 0;
    const angle = base + offset;
    const x = clamp(Math.round(cx + Math.cos(angle) * radius), 0, fieldW - 1);
    const y = clamp(Math.round(cy + Math.sin(angle) * radius), 0, fieldH - 1);
    ants.push({ id: `p${playerIndex}_a${i}`, x, y, dir: i % 4, ruleOverride: null });
  }
  return ants;
}

function spawnCorner({ playerIndex, fieldW, fieldH, antCount }) {
  const corner = playerIndex % 4;
  const ants = [];
  for (let i = 0; i < antCount; i++) {
    const offset = 2 + i;
    let x, y, dir;
    switch (corner) {
      case 0: x = offset; y = offset; dir = 2; break;
      case 1: x = fieldW - 1 - offset; y = offset; dir = 2; break;
      case 2: x = fieldW - 1 - offset; y = fieldH - 1 - offset; dir = 0; break;
      default: x = offset; y = fieldH - 1 - offset; dir = 0; break;
    }
    ants.push({
      id: `p${playerIndex}_a${i}`,
      x: clamp(x, 0, fieldW - 1),
      y: clamp(y, 0, fieldH - 1),
      dir, ruleOverride: null,
    });
  }
  return ants;
}

function spawnCluster({ playerIndex, totalPlayers, fieldW, fieldH, antCount, seed }) {
  const zoneX = ((playerIndex + 1) * fieldW) / (totalPlayers + 1);
  const zoneY = fieldH / 2;
  const radius = 4;
  const rng = mulberry32(seed + playerIndex * 1000);
  const ants = [];
  for (let i = 0; i < antCount; i++) {
    const x = clamp(Math.round(zoneX + (rng() - 0.5) * radius * 2), 0, fieldW - 1);
    const y = clamp(Math.round(zoneY + (rng() - 0.5) * radius * 2), 0, fieldH - 1);
    ants.push({
      id: `p${playerIndex}_a${i}`,
      x, y,
      dir: Math.floor(rng() * 4),
      ruleOverride: null,
    });
  }
  return ants;
}

function spawnCenter({ playerIndex, fieldW, fieldH, antCount }) {
  const cx = Math.floor(fieldW / 2);
  const cy = Math.floor(fieldH / 2);
  const ants = [];
  for (let i = 0; i < antCount; i++) {
    const offsetX = (playerIndex - 1) * 2 + (i % 3) - 1;
    const offsetY = Math.floor(i / 3) - 1;
    ants.push({
      id: `p${playerIndex}_a${i}`,
      x: clamp(cx + offsetX, 0, fieldW - 1),
      y: clamp(cy + offsetY, 0, fieldH - 1),
      dir: i % 4,
      ruleOverride: null,
    });
  }
  return ants;
}

function makePlayer(idx, opts) {
  return {
    id: `player_${idx}`,
    name: opts.name || `P${idx + 1}`,
    color: opts.color,
    ruleId: opts.ruleId,
    startHp: opts.startHp ?? 3,
    spawnPattern: opts.spawnPattern,
    antCount: opts.antCount,
    ants: [], // populate ниже
  };
}

function defaultConfig(overrides = {}) {
  return {
    width: 80,
    height: 60,
    topology: 'torus',
    bgColor: '#0A081A',
    showGrid: false,
    players: [],
    hpEnabled: true,
    damageCapEnabled: true,
    collisionCooldownTicks: 5,
    birthEnabled: true,
    birthMinNeighbors: 3,
    birthCooldownTicks: 80,
    maxAntsPerPlayer: 12,
    hybridChance: 0.10,
    wildBirthChance: 0.03,
    showGlow: true,
    showTrails: true,
    showHpDots: true,
    showDirectionArrows: false,
    antScale: 0.9,
    trailDecay: 0.94,
    baseTps: 15,
    speedMultiplier: 1,
    seed: 42,
    // Stage 5: defaults
    mutation: {
      enabled: false,
      haloEnabled: false,
      haloMinNeighbors: 6,
      mirrorEnabled: false,
      mirrorRadius: 2,
      pathEnabled: false,
      pathStraightTicks: 10,
    },
    winCondition: { kind: 'none', threshold: 5 },
    ...overrides,
  };
}

function populateAnts(config) {
  config.players.forEach((p, i) => {
    // Если уже есть кастомные ants — не перезаписываем
    if (p.ants && p.ants.length > 0) return;
    const ctx = {
      playerIndex: i,
      totalPlayers: config.players.length,
      fieldW: config.width,
      fieldH: config.height,
      antCount: p.antCount,
      seed: config.seed,
    };
    switch (p.spawnPattern) {
      case 'radial':  p.ants = spawnRadial(ctx);  break;
      case 'corner':  p.ants = spawnCorner(ctx);  break;
      case 'cluster': p.ants = spawnCluster(ctx); break;
      case 'center':  p.ants = spawnCenter(ctx);  break;
      default:        p.ants = [];                break;
    }
  });
  return config;
}

// Хелпер для ручной расстановки — создаёт массив ant'ов по координатам.
// Используется в симметричных пресетах Stage 5.
function manualAnts(playerIdx, positions) {
  return positions.map((p, i) => ({
    id: `p${playerIdx}_a${i}`,
    x: p.x, y: p.y, dir: p.dir ?? 0, ruleOverride: null,
  }));
}

// ─── 6 пресетов ──────────────────────────────────────────────────────────────

const PRESETS = [
  {
    id: 'two-player-faceoff',
    name: '2-Player Face-Off',
    category: 'builtin',
    description: 'Classic vs Spiral, opposite sides — beginner-friendly duel',
    tags: ['beginner', 'duel'],
    author: 'langton-arena',
    config: populateAnts(defaultConfig({
      width: 60, height: 40, seed: 100,
      players: [
        makePlayer(0, { color: '#FF5470', ruleId: 'classic', antCount: 3, spawnPattern: 'radial' }),
        makePlayer(1, { color: '#4DA8FF', ruleId: 'spiral',  antCount: 3, spawnPattern: 'radial' }),
      ],
    })),
  },
  {
    id: 'four-corners',
    name: 'Four Corners',
    category: 'builtin',
    description: '4 players spawn at corners — classic 2×2',
    tags: ['classic', '4p'],
    author: 'langton-arena',
    config: populateAnts(defaultConfig({
      width: 80, height: 60, seed: 200,
      players: [
        makePlayer(0, { color: '#FF5470', ruleId: 'classic',  antCount: 2, spawnPattern: 'corner' }),
        makePlayer(1, { color: '#4DA8FF', ruleId: 'spiral',   antCount: 2, spawnPattern: 'corner' }),
        makePlayer(2, { color: '#39D98A', ruleId: 'flower',   antCount: 2, spawnPattern: 'corner' }),
        makePlayer(3, { color: '#FFD60A', ruleId: 'reverse',  antCount: 2, spawnPattern: 'corner' }),
      ],
    })),
  },
  {
    id: 'chaos-eight',
    name: 'Chaos Eight',
    category: 'builtin',
    description: '8 players, all different rules — stress test',
    tags: ['advanced', '8p', 'chaos'],
    author: 'langton-arena',
    config: populateAnts(defaultConfig({
      width: 100, height: 70, seed: 300, baseTps: 20,
      players: [
        makePlayer(0, { color: '#FF5470', ruleId: 'classic', antCount: 2, spawnPattern: 'cluster' }),
        makePlayer(1, { color: '#4DA8FF', ruleId: 'spiral',  antCount: 2, spawnPattern: 'cluster' }),
        makePlayer(2, { color: '#39D98A', ruleId: 'flower',  antCount: 2, spawnPattern: 'cluster' }),
        makePlayer(3, { color: '#FFD60A', ruleId: 'reverse', antCount: 2, spawnPattern: 'cluster' }),
        makePlayer(4, { color: '#C77DFF', ruleId: 'weave',   antCount: 2, spawnPattern: 'cluster' }),
        makePlayer(5, { color: '#FF8A3D', ruleId: 'tornado', antCount: 2, spawnPattern: 'cluster' }),
        makePlayer(6, { color: '#00E5D1', ruleId: 'uturn',   antCount: 2, spawnPattern: 'cluster' }),
        makePlayer(7, { color: '#FF4D9E', ruleId: 'classic', antCount: 2, spawnPattern: 'cluster' }),
      ],
    })),
  },
  {
    id: 'birth-showcase',
    name: 'Birth Showcase',
    category: 'builtin',
    description: 'Aggressive reproduction — watch colonies grow',
    tags: ['birth', 'demo'],
    author: 'langton-arena',
    config: populateAnts(defaultConfig({
      width: 70, height: 50, seed: 400,
      birthEnabled: true, birthMinNeighbors: 2, birthCooldownTicks: 20,
      maxAntsPerPlayer: 25, hybridChance: 0.15, wildBirthChance: 0.05,
      players: [
        makePlayer(0, { color: '#FF5470', ruleId: 'classic', antCount: 4, spawnPattern: 'radial' }),
        makePlayer(1, { color: '#4DA8FF', ruleId: 'spiral',  antCount: 4, spawnPattern: 'radial' }),
      ],
    })),
  },
  {
    id: 'wild-storm',
    name: 'Wild Storm',
    category: 'builtin',
    description: 'High wild + hybrid chance, see neutral chaos emerge',
    tags: ['wild', 'demo'],
    author: 'langton-arena',
    config: populateAnts(defaultConfig({
      width: 80, height: 60, seed: 500,
      birthEnabled: true, birthMinNeighbors: 2, birthCooldownTicks: 30,
      maxAntsPerPlayer: 20, hybridChance: 0.40, wildBirthChance: 0.30,
      players: [
        makePlayer(0, { color: '#FF5470', ruleId: 'classic', antCount: 3, spawnPattern: 'radial' }),
        makePlayer(1, { color: '#4DA8FF', ruleId: 'spiral',  antCount: 3, spawnPattern: 'radial' }),
        makePlayer(2, { color: '#39D98A', ruleId: 'flower',  antCount: 3, spawnPattern: 'radial' }),
      ],
    })),
  },
  {
    id: 'lone-wolf',
    name: 'Lone Wolf',
    category: 'builtin',
    description: 'Classic Langton — single ant, no combat, no birth. For aesthetics.',
    tags: ['classic', 'solo'],
    author: 'langton-arena',
    config: populateAnts(defaultConfig({
      width: 150, height: 100, seed: 1, baseTps: 30,
      hpEnabled: false, birthEnabled: false,
      showTrails: false, showHpDots: false,
      players: [
        makePlayer(0, { color: '#F5F5F7', ruleId: 'classic', antCount: 1, spawnPattern: 'center' }),
      ],
    })),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  STAGE 5 PRESETS — Mutation Lab
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'halo-garden',
    name: 'Halo Garden',
    category: 'builtin',
    description: '4 players, circle around point — fast halo mutations',
    tags: ['stage5', 'halo', '4p', 'symmetric'],
    author: 'langton-arena',
    config: populateAnts(defaultConfig({
      width: 60, height: 60, seed: 5001,
      birthEnabled: true, birthMinNeighbors: 2, birthCooldownTicks: 15,
      maxAntsPerPlayer: 30, hybridChance: 0.05, wildBirthChance: 0,
      mutation: {
        enabled: true,
        haloEnabled: true, haloMinNeighbors: 5,
        mirrorEnabled: false, mirrorRadius: 2,
        pathEnabled: false, pathStraightTicks: 10,
      },
      winCondition: { kind: 'first_mutant', threshold: 1 },
      players: [
        { id: 'player_0', name: 'P1', color: '#FF5470', ruleId: 'classic', startHp: 3, spawnPattern: 'manual',
          ants: manualAnts(0, [
            { x: 30, y: 24, dir: 2 }, { x: 31, y: 25, dir: 3 },
            { x: 30, y: 26, dir: 0 }, { x: 29, y: 25, dir: 1 },
          ]),
        },
        { id: 'player_1', name: 'P2', color: '#4DA8FF', ruleId: 'classic', startHp: 3, spawnPattern: 'manual',
          ants: manualAnts(1, [
            { x: 36, y: 30, dir: 2 }, { x: 37, y: 31, dir: 3 },
            { x: 36, y: 32, dir: 0 }, { x: 35, y: 31, dir: 1 },
          ]),
        },
        { id: 'player_2', name: 'P3', color: '#39D98A', ruleId: 'classic', startHp: 3, spawnPattern: 'manual',
          ants: manualAnts(2, [
            { x: 30, y: 36, dir: 2 }, { x: 31, y: 37, dir: 3 },
            { x: 30, y: 38, dir: 0 }, { x: 29, y: 37, dir: 1 },
          ]),
        },
        { id: 'player_3', name: 'P4', color: '#FFD60A', ruleId: 'classic', startHp: 3, spawnPattern: 'manual',
          ants: manualAnts(3, [
            { x: 24, y: 30, dir: 2 }, { x: 25, y: 31, dir: 3 },
            { x: 24, y: 32, dir: 0 }, { x: 23, y: 31, dir: 1 },
          ]),
        },
      ],
    })),
  },

  {
    id: 'mirror-twin',
    name: 'Mirror Twin',
    category: 'builtin',
    description: '2 players mirrored — same mutations on both sides at same tick',
    tags: ['stage5', 'mirror', '2p', 'symmetric', 'determinism'],
    author: 'langton-arena',
    config: populateAnts(defaultConfig({
      width: 80, height: 60, seed: 5002,
      birthEnabled: true, birthMinNeighbors: 3, birthCooldownTicks: 25,
      maxAntsPerPlayer: 20, hybridChance: 0.10, wildBirthChance: 0,
      mutation: {
        enabled: true,
        haloEnabled: true, haloMinNeighbors: 5,
        mirrorEnabled: true, mirrorRadius: 4,
        pathEnabled: false, pathStraightTicks: 10,
      },
      winCondition: { kind: 'n_mutants_total', threshold: 3 },
      players: [
        { id: 'player_0', name: 'Left', color: '#FF5470', ruleId: 'spiral', startHp: 3, spawnPattern: 'manual',
          ants: manualAnts(0, [
            { x: 20, y: 25, dir: 2 },
            { x: 20, y: 30, dir: 2 },
            { x: 20, y: 35, dir: 2 },
          ]),
        },
        { id: 'player_1', name: 'Right', color: '#4DA8FF', ruleId: 'spiral', startHp: 3, spawnPattern: 'manual',
          ants: manualAnts(1, [
            { x: 60, y: 25, dir: 0 },
            { x: 60, y: 30, dir: 0 },
            { x: 60, y: 35, dir: 0 },
          ]),
        },
      ],
    })),
  },

  {
    id: 'snowflake',
    name: 'Snowflake',
    category: 'builtin',
    description: '6 players radially at 60° — beautiful symmetric pattern',
    tags: ['stage5', 'path', '6p', 'symmetric'],
    author: 'langton-arena',
    config: populateAnts(defaultConfig({
      width: 80, height: 80, seed: 5003,
      birthEnabled: true, birthMinNeighbors: 2, birthCooldownTicks: 30,
      maxAntsPerPlayer: 15, hybridChance: 0.10, wildBirthChance: 0,
      collisionCooldownTicks: 8,
      mutation: {
        enabled: true,
        haloEnabled: false, haloMinNeighbors: 6,
        mirrorEnabled: false, mirrorRadius: 2,
        pathEnabled: true, pathStraightTicks: 15,
      },
      winCondition: { kind: 'time', threshold: 500 },
      players: (() => {
        // 6 игроков на 60° друг от друга вокруг центра (40,40), радиус 15
        const center = { x: 40, y: 40 };
        const radius = 15;
        const colors = ['#FF5470', '#4DA8FF', '#39D98A', '#FFD60A', '#C77DFF', '#FF8A3D'];
        const names  = ['NE', 'E', 'SE', 'SW', 'W', 'NW'];
        return colors.map((color, i) => {
          const angle = (i * 60) * Math.PI / 180;
          const x = Math.round(center.x + Math.cos(angle) * radius);
          const y = Math.round(center.y + Math.sin(angle) * radius);
          // Направление наружу — округлим к ближайшему из 4
          const dxC = x - center.x;
          const dyC = y - center.y;
          let dir = 0;
          if (Math.abs(dxC) > Math.abs(dyC)) dir = dxC > 0 ? 0 : 2;
          else                                dir = dyC > 0 ? 1 : 3;
          return {
            id: `player_${i}`, name: names[i], color, ruleId: 'classic', startHp: 3, spawnPattern: 'manual',
            ants: manualAnts(i, [{ x, y, dir }]),
          };
        });
      })(),
    })),
  },

  {
    id: 'path-marathon',
    name: 'Path Marathon',
    category: 'builtin',
    description: 'Long narrow field — ants survive long, path mutations dominate',
    tags: ['stage5', 'path', '2p', 'race'],
    author: 'langton-arena',
    config: populateAnts(defaultConfig({
      width: 100, height: 40, seed: 5004,
      birthEnabled: true, birthMinNeighbors: 2, birthCooldownTicks: 20,
      maxAntsPerPlayer: 15, hybridChance: 0.05, wildBirthChance: 0,
      collisionCooldownTicks: 10,
      mutation: {
        enabled: true,
        haloEnabled: false, haloMinNeighbors: 6,
        mirrorEnabled: false, mirrorRadius: 2,
        pathEnabled: true, pathStraightTicks: 8,
      },
      winCondition: { kind: 'first_mutant', threshold: 1 },
      players: [
        { id: 'player_0', name: 'East', color: '#FF5470', ruleId: 'classic', startHp: 3, spawnPattern: 'manual',
          ants: manualAnts(0, [
            { x: 10, y: 15, dir: 0 },
            { x: 10, y: 20, dir: 0 },
            { x: 10, y: 25, dir: 0 },
          ]),
        },
        { id: 'player_1', name: 'West', color: '#4DA8FF', ruleId: 'classic', startHp: 3, spawnPattern: 'manual',
          ants: manualAnts(1, [
            { x: 90, y: 15, dir: 2 },
            { x: 90, y: 20, dir: 2 },
            { x: 90, y: 25, dir: 2 },
          ]),
        },
      ],
    })),
  },

  {
    id: 'quadrant-mandala',
    name: 'Quadrant Mandala',
    category: 'builtin',
    description: '4 players, all 3 mutation conditions — mandala emerges first ~300t',
    tags: ['stage5', 'mandala', '4p', 'all-conditions', 'symmetric'],
    author: 'langton-arena',
    config: populateAnts(defaultConfig({
      width: 60, height: 60, seed: 5005,
      birthEnabled: true, birthMinNeighbors: 2, birthCooldownTicks: 20,
      maxAntsPerPlayer: 20, hybridChance: 0.10, wildBirthChance: 0,
      mutation: {
        enabled: true,
        haloEnabled: true, haloMinNeighbors: 5,
        mirrorEnabled: true, mirrorRadius: 3,
        pathEnabled: true, pathStraightTicks: 12,
      },
      winCondition: { kind: 'n_mutants_single', threshold: 2 },
      players: [
        // 4 уголка, в каждом — равносторонний треугольник из 3 муравьёв
        { id: 'player_0', name: 'NW', color: '#FF5470', ruleId: 'spiral', startHp: 3, spawnPattern: 'manual',
          ants: manualAnts(0, [
            { x: 12, y: 12, dir: 1 }, { x: 15, y: 12, dir: 1 }, { x: 13, y: 15, dir: 0 },
          ]),
        },
        { id: 'player_1', name: 'NE', color: '#4DA8FF', ruleId: 'spiral', startHp: 3, spawnPattern: 'manual',
          ants: manualAnts(1, [
            { x: 48, y: 12, dir: 1 }, { x: 45, y: 12, dir: 1 }, { x: 47, y: 15, dir: 2 },
          ]),
        },
        { id: 'player_2', name: 'SE', color: '#39D98A', ruleId: 'spiral', startHp: 3, spawnPattern: 'manual',
          ants: manualAnts(2, [
            { x: 48, y: 48, dir: 3 }, { x: 45, y: 48, dir: 3 }, { x: 47, y: 45, dir: 2 },
          ]),
        },
        { id: 'player_3', name: 'SW', color: '#FFD60A', ruleId: 'spiral', startHp: 3, spawnPattern: 'manual',
          ants: manualAnts(3, [
            { x: 12, y: 48, dir: 3 }, { x: 15, y: 48, dir: 3 }, { x: 13, y: 45, dir: 0 },
          ]),
        },
      ],
    })),
  },

  {
    id: 'chaos-vs-order',
    name: 'Chaos vs Order',
    category: 'builtin',
    description: '8 players, all mutation conditions — survival of the fittest',
    tags: ['stage5', '8p', 'survival', 'stress'],
    author: 'langton-arena',
    config: populateAnts(defaultConfig({
      width: 80, height: 80, seed: 5006, baseTps: 20,
      birthEnabled: true, birthMinNeighbors: 2, birthCooldownTicks: 15,
      maxAntsPerPlayer: 25, hybridChance: 0.15, wildBirthChance: 0.05,
      mutation: {
        enabled: true,
        haloEnabled: true, haloMinNeighbors: 5,
        mirrorEnabled: true, mirrorRadius: 3,
        pathEnabled: true, pathStraightTicks: 10,
      },
      winCondition: { kind: 'survival', threshold: 1 },
      players: [
        makePlayer(0, { color: '#FF5470', ruleId: 'classic', antCount: 3, spawnPattern: 'cluster' }),
        makePlayer(1, { color: '#4DA8FF', ruleId: 'spiral',  antCount: 3, spawnPattern: 'cluster' }),
        makePlayer(2, { color: '#39D98A', ruleId: 'flower',  antCount: 3, spawnPattern: 'cluster' }),
        makePlayer(3, { color: '#FFD60A', ruleId: 'reverse', antCount: 3, spawnPattern: 'cluster' }),
        makePlayer(4, { color: '#C77DFF', ruleId: 'weave',   antCount: 3, spawnPattern: 'cluster' }),
        makePlayer(5, { color: '#FF8A3D', ruleId: 'tornado', antCount: 3, spawnPattern: 'cluster' }),
        makePlayer(6, { color: '#00E5D1', ruleId: 'uturn',   antCount: 3, spawnPattern: 'cluster' }),
        makePlayer(7, { color: '#F5F5F7', ruleId: 'classic', antCount: 3, spawnPattern: 'cluster' }),
      ],
    })),
  },
];

// ─── Write files ─────────────────────────────────────────────────────────────

for (const preset of PRESETS) {
  const filePath = path.join(OUT, preset.id + '.json');
  writeFileSync(filePath, JSON.stringify(preset, null, 2) + '\n', 'utf-8');
  console.log(`✓ ${preset.id}.json (${preset.config.players.length} players, ${preset.config.players.reduce((n, p) => n + p.ants.length, 0)} ants)`);
}

// index.json — список всех пресетов
const indexJson = {
  version: 1,
  presets: PRESETS.map((p) => ({ id: p.id, file: p.id + '.json' })),
};
writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(indexJson, null, 2) + '\n', 'utf-8');
console.log(`✓ index.json (${PRESETS.length} presets registered)`);

console.log(`\nGenerated ${PRESETS.length} presets in ${OUT}`);
