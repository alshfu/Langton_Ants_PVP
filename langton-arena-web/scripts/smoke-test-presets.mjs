// scripts/smoke-test-presets.mjs
//
// Прогоняет каждый встроенный пресет через симуляцию на 100 тиков
// и проверяет что:
//  1. Все муравьи имеют валидные координаты в границах
//  2. Движок не падает
//  3. После 100 тиков что-то изменилось (захвачены клетки)
//
// Использует тот же engine.ts что и UI, через esbuild on-the-fly.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PRESETS_DIR = path.join(ROOT, 'public', 'presets');

// Build engine.ts → temp CJS bundle
const ENGINE_OUT = '/tmp/engine-smoke.cjs';
await build({
  entryPoints: [path.join(ROOT, 'src', 'core', 'langton', 'engine.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: ENGINE_OUT,
  external: [],
  logLevel: 'error',
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { makeLangtonState, stepLangton } = await import(ENGINE_OUT);

const LA_RULES = {
  classic: 'RL', reverse: 'LR', spiral: 'LRR',
  flower: 'RLR', weave: 'LRLR', tornado: 'LRRLR', uturn: 'RR',
};

const files = readdirSync(PRESETS_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json');
let passed = 0, failed = 0;

for (const file of files) {
  const preset = JSON.parse(readFileSync(path.join(PRESETS_DIR, file), 'utf-8'));
  const cfg = preset.config;
  const name = preset.name;

  // Build engine ants
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

  // Проверка 1: координаты в границах
  let outOfBounds = 0;
  ants.forEach((a) => {
    if (a.x < 0 || a.x >= cfg.width || a.y < 0 || a.y >= cfg.height) outOfBounds++;
  });
  if (outOfBounds > 0) {
    console.error(`✗ ${name}: ${outOfBounds} ants out of bounds`);
    failed++;
    continue;
  }

  // Проверка 2: симулируем 100 тиков, не падаем
  try {
    const sim = makeLangtonState({
      w: cfg.width, h: cfg.height, ants,
      seed: cfg.seed,
      collisionCooldownTicks: cfg.collisionCooldownTicks,
      birthConfig: cfg.birthEnabled ? {
        enabled: true,
        minNeighbors: cfg.birthMinNeighbors,
        cooldownTicks: cfg.birthCooldownTicks,
        maxAntsPerPlayer: cfg.maxAntsPerPlayer,
        hybridChance: cfg.hybridChance,
        wildChance: cfg.wildBirthChance,
      } : null,
    });

    let totalCaptures = 0;
    for (let i = 0; i < 100; i++) {
      const ev = stepLangton(sim);
      totalCaptures += ev.captures.length;
    }

    // Проверка 3: ant=0 means lone-wolf with no movement is fine, иначе должны быть captures
    if (ants.length > 0 && totalCaptures === 0) {
      console.error(`✗ ${name}: 100 ticks, 0 captures — engine not working?`);
      failed++;
      continue;
    }

    console.log(`✓ ${name}: ${cfg.players.length}p · ${ants.length} ants · ${totalCaptures} captures @ 100t`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}: engine crashed —`, err.message);
    failed++;
  }
}

console.log(`\n${passed}/${passed + failed} presets passed smoke test`);
process.exit(failed > 0 ? 1 : 0);
