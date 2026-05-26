// scripts/smoke-test-determinism.mjs
//
// Главный тест Этапа 3: убедиться что движок полностью детерминирован.
//
// 1. Прогоняем каждый из 6 пресетов 2 раза по 500 тиков
// 2. Каждый раз — bit-identical owner-grid и состав муравьёв
// 3. Если где-то расходится — детерминизация неполная

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PRESETS_DIR = path.join(ROOT, 'public', 'presets');

const ENGINE_OUT = '/tmp/engine-determinism.cjs';
await build({
  entryPoints: [path.join(ROOT, 'src', 'core', 'langton', 'engine.ts')],
  bundle: true, platform: 'node', format: 'cjs',
  outfile: ENGINE_OUT, logLevel: 'error',
});
const { makeLangtonState, stepLangton } = await import(ENGINE_OUT);

const LA_RULES = {
  classic: 'RL', reverse: 'LR', spiral: 'LRR',
  flower: 'RLR', weave: 'LRLR', tornado: 'LRRLR', uturn: 'RR',
};

function hashState(sim) {
  const h = createHash('sha256');
  h.update(sim.owner);
  h.update(sim.state);
  // Сортируем муравьёв по id для стабильного hash
  const sortedAnts = [...sim.ants].sort((a, b) => a.id.localeCompare(b.id));
  for (const a of sortedAnts) {
    h.update(`${a.id}|${a.x}|${a.y}|${a.dir}|${a.hp}|${a.dead ? 1 : 0}\n`);
  }
  return h.digest('hex').slice(0, 16);
}

function buildSim(preset) {
  const cfg = preset.config;
  const ants = [];
  cfg.players.forEach((p, pi) => {
    const playerRule = LA_RULES[p.ruleId] ?? 'RL';
    p.ants.forEach((a) => {
      const rule = a.ruleOverride ? (LA_RULES[a.ruleOverride] ?? playerRule) : playerRule;
      ants.push({
        id: a.id, owner: pi, x: a.x, y: a.y, dir: a.dir,
        rule, hp: p.startHp,
      });
    });
  });
  return makeLangtonState({
    w: cfg.width, h: cfg.height, ants, seed: cfg.seed,
    collisionCooldownTicks: cfg.collisionCooldownTicks,
    hpEnabled: cfg.hpEnabled ?? true,
    damageCapEnabled: cfg.damageCapEnabled ?? true,
    birthConfig: cfg.birthEnabled ? {
      enabled: true,
      minNeighbors: cfg.birthMinNeighbors,
      cooldownTicks: cfg.birthCooldownTicks,
      maxAntsPerPlayer: cfg.maxAntsPerPlayer,
      hybridChance: cfg.hybridChance,
      wildChance: cfg.wildBirthChance,
      unlimited: cfg.unlimitedAnts ?? false,
    } : null,
  });
}

const files = readdirSync(PRESETS_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json');
let passed = 0, failed = 0;

console.log('Stage 3 determinism check: same preset run twice must yield bit-identical state.\n');

for (const file of files) {
  const preset = JSON.parse(readFileSync(path.join(PRESETS_DIR, file), 'utf-8'));
  const name = preset.name;

  // Прогон 1
  const sim1 = buildSim(preset);
  for (let i = 0; i < 500; i++) stepLangton(sim1);
  const hash1 = hashState(sim1);

  // Прогон 2 — независимый
  const sim2 = buildSim(preset);
  for (let i = 0; i < 500; i++) stepLangton(sim2);
  const hash2 = hashState(sim2);

  if (hash1 === hash2) {
    console.log(`✓ ${name.padEnd(25)} ${hash1}`);
    passed++;
  } else {
    console.log(`✗ ${name.padEnd(25)} run1=${hash1} run2=${hash2}`);
    failed++;
  }
}

console.log(`\n${passed}/${passed + failed} presets are bit-deterministic`);
process.exit(failed > 0 ? 1 : 0);
