// scripts/build-symmetric-presets.mjs
//
// Генерирует 10 truly-symmetric пресетов: 4-fold rotational, 2-fold mirror,
// 8-fold star burst. Все используют 'classic' rule (RL) — поведение детерминировано
// и одинаковое для всех муравьёв, поэтому симметрия сохраняется первые
// сотни тиков. Поле 61×61 (нечётное → ровный центр (30,30)).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT  = path.join(ROOT, 'public', 'presets');

const W = 61, H = 61;          // odd → точный центр (30, 30)
const CX = 30, CY = 30;

// 8 contrast colors (одного и того же стиля что в других пресетах)
const COLORS = [
  '#FF5470', '#4DA8FF', '#39D98A', '#FFD60A',
  '#C77DFF', '#FF8C42', '#A0E8AF', '#FF6B9D',
];

function ant(id, x, y, dir) {
  return { id, x, y, dir, ruleOverride: null };
}

function player(idx, antsAt) {
  return {
    id: `player_${idx}`,
    name: `P${idx + 1}`,
    color: COLORS[idx % COLORS.length],
    ruleId: 'classic',
    startHp: 3,
    spawnPattern: 'center',
    antCount: antsAt.length,
    ants: antsAt.map((a, i) => ant(`p${idx}_a${i}`, a.x, a.y, a.dir)),
  };
}

function makePreset({ id, name, description, tags, players, seed, antScale = 1.0 }) {
  return {
    id,
    name,
    category: 'builtin',
    description,
    tags: ['stage8', 'symmetric', 'classic', ...tags],
    author: 'langton-arena',
    config: {
      width: W,
      height: H,
      topology: 'torus',
      bgColor: '#0A081A',
      showGrid: false,
      players,
      hpEnabled: true,
      damageCapEnabled: true,
      collisionCooldownTicks: 5,
      birthEnabled: true,
      birthMinNeighbors: 3,
      birthCooldownTicks: 50,
      maxAntsPerPlayer: 30,
      unlimitedAnts: false,
      hybridChance: 0,           // строго симметрично — никаких гибридов
      wildBirthChance: 0,        // никаких wilds
      showGlow: true,
      showTrails: true,
      showHpDots: false,
      showDirectionArrows: true,
      showCellState: false,
      skinPack: 'shape',
      heatmapMode: 'off',
      heatmapOpacity: 0.55,
      antScale,
      trailDecay: 0.96,
      baseTps: 15,
      speedMultiplier: 1,
      seed,
      mutation: {
        enabled: false,
        haloEnabled: false, haloMinNeighbors: 6,
        mirrorEnabled: false, mirrorRadius: 2,
        pathEnabled: false, pathStraightTicks: 10,
      },
      winCondition: { kind: 'none', threshold: 5 },
      reserveMode: false,
      deployRule: 'anywhere',
      deployRadius: 3,
    },
  };
}

// ─── 10 пресетов ─────────────────────────────────────────────────────────────
// Направления: N=0, E=1, S=2, W=3 (y увеличивается вниз).

const PRESETS = [
  // 1. Compass Out — 4 ants at NSEW(d=1), pointing outward
  {
    id: 'sym-compass-out',
    name: 'Compass · Out',
    description: '4 муравья на N/E/S/W вокруг центра, смотрят наружу. Чистая 4-fold rotational симметрия.',
    tags: ['4p', 'compass'],
    seed: 8001,
    antScale: 1.1,
    players: [
      player(0, [{ x: CX,     y: CY - 1, dir: 0 }]),   // N pos → N
      player(1, [{ x: CX + 1, y: CY,     dir: 1 }]),   // E pos → E
      player(2, [{ x: CX,     y: CY + 1, dir: 2 }]),   // S pos → S
      player(3, [{ x: CX - 1, y: CY,     dir: 3 }]),   // W pos → W
    ],
  },

  // 2. Compass In — same positions but converging on center
  {
    id: 'sym-compass-in',
    name: 'Compass · In',
    description: '4 муравья сходятся к центру со сторон света — зеркало Compass Out.',
    tags: ['4p', 'compass'],
    seed: 8002,
    antScale: 1.1,
    players: [
      player(0, [{ x: CX,     y: CY - 1, dir: 2 }]),   // N → S
      player(1, [{ x: CX + 1, y: CY,     dir: 3 }]),   // E → W
      player(2, [{ x: CX,     y: CY + 1, dir: 0 }]),   // S → N
      player(3, [{ x: CX - 1, y: CY,     dir: 1 }]),   // W → E
    ],
  },

  // 3. Pinwheel CW
  {
    id: 'sym-pinwheel-cw',
    name: 'Pinwheel · CW',
    description: '4 муравья в 3×3 углах, крутятся по часовой стрелке. Винчестер-эффект.',
    tags: ['4p', 'pinwheel'],
    seed: 8003,
    antScale: 1.1,
    players: [
      player(0, [{ x: CX - 1, y: CY - 1, dir: 1 }]),   // NW → E
      player(1, [{ x: CX + 1, y: CY - 1, dir: 2 }]),   // NE → S
      player(2, [{ x: CX + 1, y: CY + 1, dir: 3 }]),   // SE → W
      player(3, [{ x: CX - 1, y: CY + 1, dir: 0 }]),   // SW → N
    ],
  },

  // 4. Pinwheel CCW
  {
    id: 'sym-pinwheel-ccw',
    name: 'Pinwheel · CCW',
    description: 'Зеркальный Pinwheel — крутится против часовой.',
    tags: ['4p', 'pinwheel'],
    seed: 8004,
    antScale: 1.1,
    players: [
      player(0, [{ x: CX - 1, y: CY - 1, dir: 2 }]),   // NW → S
      player(1, [{ x: CX + 1, y: CY - 1, dir: 3 }]),   // NE → W
      player(2, [{ x: CX + 1, y: CY + 1, dir: 0 }]),   // SE → N
      player(3, [{ x: CX - 1, y: CY + 1, dir: 1 }]),   // SW → E
    ],
  },

  // 5. Cross Arms — NSEW at distance 10, converging
  {
    id: 'sym-cross-arms',
    name: 'Cross Arms',
    description: '4 муравья на расстоянии 10 от центра по NSEW, идут к центру. Большой крест.',
    tags: ['4p', 'cross'],
    seed: 8005,
    antScale: 1.0,
    players: [
      player(0, [{ x: CX,      y: CY - 10, dir: 2 }]),  // N coming down
      player(1, [{ x: CX + 10, y: CY,      dir: 3 }]),  // E coming left
      player(2, [{ x: CX,      y: CY + 10, dir: 0 }]),  // S going up
      player(3, [{ x: CX - 10, y: CY,      dir: 1 }]),  // W going right
    ],
  },

  // 6. Diagonal X — 4 corners flowing CW
  {
    id: 'sym-diagonal-x',
    name: 'Diagonal X',
    description: '4 муравья по диагоналям (расстояние ~10), летят по часовой вокруг центра.',
    tags: ['4p', 'diagonal'],
    seed: 8006,
    antScale: 1.0,
    players: [
      player(0, [{ x: CX - 7, y: CY - 7, dir: 1 }]),  // NW → E
      player(1, [{ x: CX + 7, y: CY - 7, dir: 2 }]),  // NE → S
      player(2, [{ x: CX + 7, y: CY + 7, dir: 3 }]),  // SE → W
      player(3, [{ x: CX - 7, y: CY + 7, dir: 0 }]),  // SW → N
    ],
  },

  // 7. Four Quadrants — quadrant centers
  {
    id: 'sym-quadrants',
    name: 'Four Quadrants',
    description: '4 муравья в центрах квадрантов поля, тоже по часовой. Масштабная rotational симметрия.',
    tags: ['4p', 'quadrants'],
    seed: 8007,
    antScale: 1.0,
    players: [
      player(0, [{ x: 15, y: 15, dir: 1 }]),   // NW quadrant → E
      player(1, [{ x: 45, y: 15, dir: 2 }]),   // NE quadrant → S
      player(2, [{ x: 45, y: 45, dir: 3 }]),   // SE quadrant → W
      player(3, [{ x: 15, y: 45, dir: 0 }]),   // SW quadrant → N
    ],
  },

  // 8. Mirror Vertical — 2 players, 4 ants each
  {
    id: 'sym-mirror-vert',
    name: 'Mirror · Vertical',
    description: 'Две команды зеркально отражены через вертикальную ось x=30. Война зеркал.',
    tags: ['2p', 'mirror'],
    seed: 8008,
    antScale: 1.0,
    players: [
      player(0, [
        { x: 15, y: 25, dir: 1 },
        { x: 20, y: 25, dir: 1 },
        { x: 15, y: 35, dir: 1 },
        { x: 20, y: 35, dir: 1 },
      ]),
      player(1, [
        { x: 45, y: 25, dir: 3 },
        { x: 40, y: 25, dir: 3 },
        { x: 45, y: 35, dir: 3 },
        { x: 40, y: 35, dir: 3 },
      ]),
    ],
  },

  // 9. Octagram — 8 ants in compass star, 4 players × 2 ants (180° opposite)
  {
    id: 'sym-octagram',
    name: 'Octagram',
    description: '8 муравьёв образуют звезду — 4 команды, каждая владеет одним диаметром.',
    tags: ['4p', 'octagram'],
    seed: 8009,
    antScale: 0.95,
    players: [
      player(0, [   // N+S axis (vertical diameter)
        { x: CX, y: CY - 8, dir: 0 },
        { x: CX, y: CY + 8, dir: 2 },
      ]),
      player(1, [   // E+W axis (horizontal diameter)
        { x: CX + 8, y: CY, dir: 1 },
        { x: CX - 8, y: CY, dir: 3 },
      ]),
      player(2, [   // NE+SW diagonal
        { x: CX + 5, y: CY - 5, dir: 1 },
        { x: CX - 5, y: CY + 5, dir: 3 },
      ]),
      player(3, [   // NW+SE diagonal
        { x: CX - 5, y: CY - 5, dir: 0 },
        { x: CX + 5, y: CY + 5, dir: 2 },
      ]),
    ],
  },

  // 10. Star Burst 8 — 8 players, 1 ant each at compass positions
  {
    id: 'sym-star-burst',
    name: 'Star Burst · 8',
    description: '8 игроков на 8 сторонах компаса, каждый излучает наружу. 8-fold positional симметрия.',
    tags: ['8p', 'starburst'],
    seed: 8010,
    antScale: 0.9,
    players: [
      player(0, [{ x: CX,      y: CY - 8, dir: 0 }]),   // N
      player(1, [{ x: CX + 5,  y: CY - 5, dir: 1 }]),   // NE → E
      player(2, [{ x: CX + 8,  y: CY,     dir: 1 }]),   // E
      player(3, [{ x: CX + 5,  y: CY + 5, dir: 2 }]),   // SE → S
      player(4, [{ x: CX,      y: CY + 8, dir: 2 }]),   // S
      player(5, [{ x: CX - 5,  y: CY + 5, dir: 3 }]),   // SW → W
      player(6, [{ x: CX - 8,  y: CY,     dir: 3 }]),   // W
      player(7, [{ x: CX - 5,  y: CY - 5, dir: 0 }]),   // NW → N
    ],
  },
];

// ─── Write files + update index ──────────────────────────────────────────────

let totalAnts = 0;
for (const def of PRESETS) {
  const preset = makePreset(def);
  const file = path.join(OUT, `${def.id}.json`);
  fs.writeFileSync(file, JSON.stringify(preset, null, 2) + '\n');
  const antCount = def.players.reduce((n, p) => n + p.ants.length, 0);
  totalAnts += antCount;
  console.log(`✓ ${def.id}.json  ·  ${def.players.length} players · ${antCount} ants`);
}

// Update index.json
const indexPath = path.join(OUT, 'index.json');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
let added = 0;
for (const def of PRESETS) {
  if (!index.presets.find((e) => e.id === def.id)) {
    index.presets.push({ id: def.id, file: `${def.id}.json` });
    added++;
  }
}
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(`\n✓ index.json updated · +${added} new · ${index.presets.length} total`);
console.log(`✓ ${PRESETS.length} symmetric presets · ${totalAnts} ants total`);
