// scripts/smoke-test-reserve.mjs
//
// Stage 6 smoke: пресеты с reserveMode=true должны накапливать муравьёв
// в мешке (callback вызывается), а не на поле.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PRESETS_DIR = path.join(ROOT, 'public', 'presets');

const ENGINE_OUT = '/tmp/engine-reserve.cjs';
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

function buildSim(preset, reservedSink) {
  const cfg = preset.config;
  const ants = [];
  cfg.players.forEach((p, pi) => {
    const playerRule = LA_RULES[p.ruleId] ?? 'RL';
    p.ants.forEach((a) => {
      ants.push({
        id: a.id, owner: pi, x: a.x, y: a.y, dir: a.dir,
        rule: playerRule, hp: p.startHp ?? 3,
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
      reserveMode: cfg.reserveMode === true,
      onReserve: cfg.reserveMode === true
        ? (ant) => reservedSink.push(ant)
        : undefined,
    } : null,
  });
}

const STAGE6_PRESETS = ['defense-stand', 'surgical-strike', 'mass-deploy'];

console.log('Stage 6 reserve smoke: presets with reserveMode=true should accumulate ants in bag.\n');

let passed = 0;
for (const id of STAGE6_PRESETS) {
  const file = path.join(PRESETS_DIR, id + '.json');
  const preset = JSON.parse(readFileSync(file, 'utf-8'));
  const reserved = [];
  const sim = buildSim(preset, reserved);

  let birthsReserved = 0;
  let birthsOnField = 0;
  for (let i = 0; i < 500; i++) {
    const ev = stepLangton(sim);
    for (const b of ev.births) {
      if (b.reserved) birthsReserved++;
      else birthsOnField++;
    }
  }

  // Per-player breakdown
  const byOwner = {};
  for (const a of reserved) byOwner[a.owner] = (byOwner[a.owner] ?? 0) + 1;
  const ownerStr = Object.entries(byOwner).map(([k, v]) => `p${k}=${v}`).join(' ');

  // Правильное условие: ВСЕ births должны быть reserved, на поле — ноль
  const ok = birthsOnField === 0 && birthsReserved > 0;
  console.log(`${ok ? '✓' : '✗'} ${preset.name.padEnd(20)} births: reserved=${birthsReserved} on-field=${birthsOnField} (${ownerStr})`);
  if (ok) passed++;
}

console.log(`\n${passed}/${STAGE6_PRESETS.length} stage6 presets correctly route births to reserve`);
process.exit(passed === STAGE6_PRESETS.length ? 0 : 1);
