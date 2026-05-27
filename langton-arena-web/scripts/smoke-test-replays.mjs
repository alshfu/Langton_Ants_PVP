// scripts/smoke-test-replays.mjs
//
// Smoke test для demo replays из public/replays/.
// Проверяем что каждый replay:
//   1. Валидный JSON
//   2. Имеет правильную структуру (version, metadata, config, deployTimeline)
//   3. Все DeployAction валидны (tick >= 0, playerIdx в пределах config.players)
//   4. Координаты deploy в пределах поля (x < width, y < height)
//   5. Inputs отсортированы по tick (по построению)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const REPLAYS_DIR = path.join(ROOT, 'public', 'replays');

const REPLAY_FORMAT_VERSION = 1;

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(REPLAYS_DIR)) {
  fail(`Directory missing: ${REPLAYS_DIR}`);
}

const indexFile = path.join(REPLAYS_DIR, 'index.json');
if (!fs.existsSync(indexFile)) {
  fail(`Index missing: ${indexFile}`);
}

const index = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
if (!Array.isArray(index.replays) || index.replays.length === 0) {
  fail('Index has no replays');
}

console.log(`Found ${index.replays.length} demo replays:`);

let allOk = true;
for (const entry of index.replays) {
  const file = path.join(REPLAYS_DIR, entry.file);
  if (!fs.existsSync(file)) {
    console.error(`✗ ${entry.name}: file missing`);
    allOk = false;
    continue;
  }

  let replay;
  try {
    replay = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    console.error(`✗ ${entry.name}: invalid JSON (${e.message})`);
    allOk = false;
    continue;
  }

  // Structure check
  if (replay.version !== REPLAY_FORMAT_VERSION) {
    console.error(`✗ ${entry.name}: version mismatch (got ${replay.version}, want ${REPLAY_FORMAT_VERSION})`);
    allOk = false;
    continue;
  }
  if (!replay.metadata || !replay.config || !Array.isArray(replay.deployTimeline)) {
    console.error(`✗ ${entry.name}: missing required fields`);
    allOk = false;
    continue;
  }

  // DeployActions check
  const players = replay.config.players ?? [];
  const w = replay.config.width;
  const h = replay.config.height;
  let prevTick = -1;
  let allActionsOk = true;
  for (const action of replay.deployTimeline) {
    if (action.tick < 0) {
      console.error(`  ✗ tick ${action.tick} negative`);
      allActionsOk = false;
    }
    if (action.tick < prevTick) {
      console.error(`  ✗ tick ${action.tick} out of order (prev was ${prevTick})`);
      allActionsOk = false;
    }
    prevTick = action.tick;
    if (action.playerIdx < 0 || action.playerIdx >= players.length) {
      console.error(`  ✗ playerIdx ${action.playerIdx} out of range (0..${players.length - 1})`);
      allActionsOk = false;
    }
    if (action.x < 0 || action.x >= w || action.y < 0 || action.y >= h) {
      console.error(`  ✗ coord (${action.x}, ${action.y}) out of field ${w}x${h}`);
      allActionsOk = false;
    }
  }

  if (allActionsOk) {
    console.log(`✓ ${entry.name}`);
    console.log(`  preset=${replay.metadata.presetName} · ${replay.deployTimeline.length} deploys · ${replay.metadata.durationTicks}t`);
  } else {
    allOk = false;
  }
}

if (allOk) {
  console.log(`\n${index.replays.length}/${index.replays.length} replays valid`);
  process.exit(0);
} else {
  console.error('\nSome replays failed validation');
  process.exit(1);
}
