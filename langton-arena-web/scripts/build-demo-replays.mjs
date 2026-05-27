// scripts/build-demo-replays.mjs
//
// Генерирует demo replays для public/replays/.
// Каждый demo — это интересный сценарий с предзаписанными deploys
// для пресетов с reserveMode=true (Stage 6).
//
// Эти replays распространяются в репозитории как primer для community:
// "вот как выглядит интересный матч, вот как использовать deploy".

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const REPLAY_FORMAT_VERSION = 1;

function loadPreset(name) {
  const file = path.join(ROOT, 'public', 'presets', `${name}.json`);
  const wrapper = JSON.parse(fs.readFileSync(file, 'utf-8'));
  // Пресеты обёрнуты как { id, name, category, ..., config: {...} }
  return wrapper.config;
}

function makeReplay(name, presetName, durationTicks, deploys, description) {
  const config = loadPreset(presetName);
  // Сортируем deploys по tick — replay invariant (real recording всегда отсортирован)
  const sorted = [...deploys].sort((a, b) => a.tick - b.tick);
  return {
    version: REPLAY_FORMAT_VERSION,
    metadata: {
      id: `demo-${name}`,
      name: name,
      createdAt: Date.parse('2026-05-27'), // фиксированная дата для воспроизводимости
      durationTicks,
      deployCount: sorted.length,
      presetName,
    },
    config,
    deployTimeline: sorted,
    // Дополнительное поле для UI — описание (не часть формата но игнорируется при декоде)
    _description: description,
  };
}

// ─── 3 demo replays ──────────────────────────────────────────────────────────

// Demo 1: Defense Stand — игрок копит и выпускает залпом на финале
const defenseStandDemo = makeReplay(
  'Defense Stand · careful builder',
  'defense-stand',
  600,
  [
    // Игрок P0 копит до t=400, потом выпускает массой
    { tick: 410, playerIdx: 0, x: 15, y: 15 },
    { tick: 415, playerIdx: 0, x: 16, y: 15 },
    { tick: 420, playerIdx: 0, x: 15, y: 16 },
    { tick: 425, playerIdx: 0, x: 14, y: 15 },
    { tick: 430, playerIdx: 0, x: 15, y: 14 },
    // P1 отвечает контратакой
    { tick: 460, playerIdx: 1, x: 45, y: 45 },
    { tick: 465, playerIdx: 1, x: 46, y: 45 },
    { tick: 470, playerIdx: 1, x: 45, y: 46 },
    // P2/P3 пытаются стянуть карту
    { tick: 500, playerIdx: 2, x: 45, y: 15 },
    { tick: 510, playerIdx: 3, x: 15, y: 45 },
  ],
  'A patient strategy: P0 accumulates 5 ants then drops them as a cluster at t=410 to break through the contested center. P1, P2, P3 respond with their own deployments. Watch how each player\'s playstyle differs.',
);

// Demo 2: Surgical Strike — точечные выпуски near_alive
const surgicalStrikeDemo = makeReplay(
  'Surgical Strike · precision drops',
  'surgical-strike',
  800,
  [
    // P0 ждёт интересного момента и точечно выпускает в hot spots
    { tick: 150, playerIdx: 0, x: 20, y: 30 },
    { tick: 280, playerIdx: 0, x: 35, y: 25 },
    { tick: 380, playerIdx: 0, x: 50, y: 28 },
    // P1 более агрессивен
    { tick: 200, playerIdx: 1, x: 60, y: 30 },
    { tick: 320, playerIdx: 1, x: 55, y: 35 },
    { tick: 420, playerIdx: 1, x: 50, y: 32 },
    { tick: 520, playerIdx: 1, x: 45, y: 30 },
  ],
  'Two players use near_alive deploy rule (radius=5). Notice how each ant placement extends the player\'s reach — strategic positioning matters more than volume.',
);

// Demo 3: Mass Deploy — игрок копит и выпускает залпом
const massDeployDemo = makeReplay(
  'Mass Deploy · wave attack',
  'mass-deploy',
  500,
  [
    // P0 не выпускает до t=300, потом залпом 10 муравьёв
    { tick: 300, playerIdx: 0, x: 25, y: 50 },
    { tick: 301, playerIdx: 0, x: 27, y: 50 },
    { tick: 302, playerIdx: 0, x: 29, y: 50 },
    { tick: 303, playerIdx: 0, x: 31, y: 50 },
    { tick: 304, playerIdx: 0, x: 33, y: 50 },
    { tick: 305, playerIdx: 0, x: 35, y: 50 },
    { tick: 306, playerIdx: 0, x: 25, y: 52 },
    { tick: 307, playerIdx: 0, x: 27, y: 52 },
    { tick: 308, playerIdx: 0, x: 29, y: 52 },
    { tick: 309, playerIdx: 0, x: 31, y: 52 },
    // P1 и P2 отвечают точечно
    { tick: 320, playerIdx: 1, x: 75, y: 50 },
    { tick: 330, playerIdx: 2, x: 50, y: 75 },
  ],
  'Player 0 deploys a wave of 10 ants over 10 ticks — a single push designed to overwhelm. P1 and P2 respond with single precision drops. Notice the difference in territorial gain between strategies.',
);

// ─── Запись файлов ───────────────────────────────────────────────────────────

const replays = [defenseStandDemo, surgicalStrikeDemo, massDeployDemo];
const outputDir = path.join(ROOT, 'public', 'replays');
fs.mkdirSync(outputDir, { recursive: true });

const indexEntries = [];
for (const replay of replays) {
  const filename = `${replay.metadata.id}.json`;
  const outPath = path.join(outputDir, filename);
  fs.writeFileSync(outPath, JSON.stringify(replay, null, 2));
  indexEntries.push({
    id: replay.metadata.id,
    name: replay.metadata.name,
    file: filename,
    durationTicks: replay.metadata.durationTicks,
    deployCount: replay.metadata.deployCount,
    presetName: replay.metadata.presetName,
    description: replay._description,
  });
  console.log(`✓ ${replay.metadata.name}`);
  console.log(`  preset=${replay.metadata.presetName} · ` +
    `${replay.metadata.deployCount} deploys · ${replay.metadata.durationTicks}t`);
}

const indexPath = path.join(outputDir, 'index.json');
fs.writeFileSync(indexPath, JSON.stringify({
  version: 1,
  replays: indexEntries,
}, null, 2));

console.log(`\n${replays.length} demo replays written to public/replays/`);
