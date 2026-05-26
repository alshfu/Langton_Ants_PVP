// scripts/smoke-test-mutations.mjs
//
// Stage 5 smoke: проверяем что новые пресеты реально рождают мутантов.
// Прогоняем 500 тиков на каждом stage5-пресете и считаем сколько мутантов
// родилось. Если 0 — пресет нечего демонстрирует.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PRESETS_DIR = path.join(ROOT, 'public', 'presets');

const ENGINE_OUT = '/tmp/engine-mutations.cjs';
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

function buildSim(preset) {
  const cfg = preset.config;
  const ants = [];
  cfg.players.forEach((p, pi) => {
    const playerRule = LA_RULES[p.ruleId] ?? 'RL';
    p.ants.forEach((a) => {
      ants.push({
        id: a.id, owner: pi, x: a.x, y: a.y, dir: a.dir,
        rule: playerRule, hp: p.startHp,
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
      mutation: cfg.mutation?.enabled ? {
        haloEnabled:       cfg.mutation.haloEnabled,
        haloMinNeighbors:  cfg.mutation.haloMinNeighbors,
        mirrorEnabled:     cfg.mutation.mirrorEnabled,
        mirrorRadius:      cfg.mutation.mirrorRadius,
        pathEnabled:       cfg.mutation.pathEnabled,
        pathStraightTicks: cfg.mutation.pathStraightTicks,
      } : undefined,
    } : null,
  });
}

const STAGE5_PRESETS = [
  'halo-garden', 'mirror-twin', 'snowflake',
  'path-marathon', 'quadrant-mandala', 'chaos-vs-order',
];

console.log('Stage 5 mutation smoke: each preset must produce ≥1 mutant in 500 ticks.\n');

let passed = 0;
for (const id of STAGE5_PRESETS) {
  const file = path.join(PRESETS_DIR, id + '.json');
  const preset = JSON.parse(readFileSync(file, 'utf-8'));
  const sim = buildSim(preset);

  const causes = { halo: 0, mirror: 0, path: 0 };
  let firstMutantTick = -1;

  for (let i = 0; i < 500; i++) {
    const ev = stepLangton(sim);
    for (const birth of ev.births) {
      if (birth.isMutant) {
        causes[birth.mutantCause]++;
        if (firstMutantTick === -1) firstMutantTick = sim.tick;
      }
    }
  }

  const total = causes.halo + causes.mirror + causes.path;
  const status = total > 0 ? '✓' : '✗';
  const causeStr = `halo=${causes.halo} mirror=${causes.mirror} path=${causes.path}`;
  console.log(`${status} ${preset.name.padEnd(20)} mutants=${total} (${causeStr}), first@t${firstMutantTick === -1 ? '—' : firstMutantTick}`);
  if (total > 0) passed++;
}

console.log(`\n${passed}/${STAGE5_PRESETS.length} stage5 presets produce mutants`);
process.exit(passed === STAGE5_PRESETS.length ? 0 : 1);
