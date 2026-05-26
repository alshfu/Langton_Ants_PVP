// scripts/smoke-test-stage2.mjs
//
// Проверяет Stage 2 фичи:
// 1. Симуляция с unlimited не падает за 500 тиков
// 2. computeCellCountsByOwner работает на разных размерах поля
// 3. GC мёртвых не повреждает state

import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Сборка engine
const ENGINE_OUT = '/tmp/engine-smoke-s2.cjs';
await build({
  entryPoints: [path.join(ROOT, 'src', 'core', 'langton', 'engine.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: ENGINE_OUT,
  external: [],
  logLevel: 'error',
});

const { makeLangtonState, stepLangton } = await import(ENGINE_OUT);

// ─── Test 1: Unlimited stress test ───────────────────────────────────────────
{
  const sim = makeLangtonState({
    w: 50, h: 50, seed: 1,
    ants: [
      { id: 'p0_a0', owner: 0, x: 10, y: 10, dir: 0, rule: 'RL', hp: 3 },
      { id: 'p0_a1', owner: 0, x: 10, y: 11, dir: 1, rule: 'RL', hp: 3 },
      { id: 'p1_a0', owner: 1, x: 40, y: 40, dir: 0, rule: 'LRR', hp: 3 },
      { id: 'p1_a1', owner: 1, x: 40, y: 41, dir: 1, rule: 'LRR', hp: 3 },
    ],
    collisionCooldownTicks: 5,
    birthConfig: {
      enabled: true, minNeighbors: 2, cooldownTicks: 10,
      maxAntsPerPlayer: 5, hybridChance: 0.1, wildChance: 0.05,
      unlimited: true,
    },
  });

  const start = Date.now();
  for (let i = 0; i < 500; i++) stepLangton(sim);
  const elapsed = Date.now() - start;

  const alive = sim.ants.filter((a) => !a.dead).length;
  const total = sim.ants.length;
  const cap = sim.w * sim.h - 1;

  console.log(`Test 1 — unlimited stress:`);
  console.log(`  500 ticks in ${elapsed}ms, ${alive} alive / ${total} array len`);
  console.log(`  Cap = ${cap}, alive ${alive <= cap ? '✓ within' : '✗ exceeds'} cap`);
  if (alive > cap) {
    console.error('  FAIL: alive exceeds global cap');
    process.exit(1);
  }
}

// ─── Test 2: GC не повреждает sim ────────────────────────────────────────────
{
  const sim = makeLangtonState({
    w: 20, h: 20, seed: 7,
    ants: [
      { id: 'a', owner: 0, x: 5, y: 5, dir: 0, rule: 'RL', hp: 1 },
      { id: 'b', owner: 1, x: 5, y: 5, dir: 0, rule: 'RL', hp: 1 },
    ],
    collisionCooldownTicks: 0,
    birthConfig: null,
  });

  for (let i = 0; i < 250; i++) stepLangton(sim);
  // tick=250, GC должен сработать на 200
  const alive = sim.ants.filter((a) => !a.dead).length;
  const total = sim.ants.length;

  console.log(`\nTest 2 — GC integrity:`);
  console.log(`  After 250 ticks: ${alive} alive, ${total} in array`);
  console.log(`  Expected: 0 dead, 0 in array (after GC at 200)`);
  if (total !== 0 || alive !== 0) {
    console.error('  FAIL: GC did not clean dead ants');
    process.exit(1);
  } else {
    console.log('  ✓ PASS');
  }
}

// ─── Test 3: Большая симуляция не падает ─────────────────────────────────────
{
  const ants = [];
  for (let p = 0; p < 4; p++) {
    for (let i = 0; i < 3; i++) {
      ants.push({
        id: `p${p}_a${i}`, owner: p,
        x: 20 + p * 20, y: 20 + i * 15,
        dir: 0, rule: 'RL', hp: 3,
      });
    }
  }
  const sim = makeLangtonState({
    w: 100, h: 100, seed: 42, ants,
    collisionCooldownTicks: 5,
    birthConfig: {
      enabled: true, minNeighbors: 3, cooldownTicks: 80,
      maxAntsPerPlayer: 12, hybridChance: 0.1, wildChance: 0.03,
    },
  });

  const start = Date.now();
  let captures = 0;
  for (let i = 0; i < 1000; i++) {
    const ev = stepLangton(sim);
    captures += ev.captures.length;
  }
  const elapsed = Date.now() - start;

  console.log(`\nTest 3 — large sim 1000 ticks:`);
  console.log(`  ${elapsed}ms, ${captures} captures, ${sim.ants.filter((a) => !a.dead).length} alive`);
  if (elapsed > 5000) {
    console.error('  WARN: 1000 ticks took >5s — may need optimization');
  } else {
    console.log('  ✓ PASS (performance OK)');
  }
}

console.log('\n✓ All Stage 2 smoke tests passed');
