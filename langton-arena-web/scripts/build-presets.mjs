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
    ...overrides,
  };
}

function populateAnts(config) {
  config.players.forEach((p, i) => {
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
];

// ─── Write files ─────────────────────────────────────────────────────────────

for (const preset of PRESETS) {
  const filePath = path.join(OUT, preset.id + '.json');
  writeFileSync(filePath, JSON.stringify(preset, null, 2) + '\n', 'utf-8');
  console.log(`✓ ${preset.id}.json (${preset.config.players.length} players, ${preset.config.players.reduce((n, p) => n + p.ants.length, 0)} ants)`);
}

console.log(`\nGenerated ${PRESETS.length} presets in ${OUT}`);
