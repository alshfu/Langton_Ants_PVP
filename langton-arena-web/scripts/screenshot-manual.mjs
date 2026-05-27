/**
 * screenshot-manual.mjs v4
 *
 * Скриншоты всех экранов и вкладок Langton Arena для вики-мануала.
 *   AUDIT_BASE=https://alshfu.github.io/Langton_Ants_PVP node scripts/screenshot-manual.mjs
 * Выходные файлы: /tmp/langton-wiki/images/*.png
 */
import { chromium } from 'playwright';
import { mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const BASE = process.env.AUDIT_BASE || 'https://alshfu.github.io/Langton_Ants_PVP';
const OUT  = '/tmp/langton-wiki/images';
mkdirSync(OUT, { recursive: true });
const VP = { width: 1400, height: 900 };

// ── helpers ──────────────────────────────────────────────
async function shot(page, name, waitMs = 600) {
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`  📸 ${name}.png`);
}
async function shotCanvas(page, name, waitMs = 400) {
  await page.waitForTimeout(waitMs);
  const cv = page.locator('canvas').first();
  if (await cv.count()) {
    await cv.screenshot({ path: join(OUT, `${name}.png`) });
    console.log(`  📸 ${name}.png [canvas]`);
    return true;
  }
  return false;
}
const TAB_TITLES = {
  players:   'Players — Add, remove, configure players (2-10)',
  ants:      'Ants — Individual ants of active player',
  stats:     'Stats — Live statistics during simulation',
  events:    'Events — Event log with filter and step back',
  field:     'Field — Size, topology, background',
  combat:    'Combat — HP, damage cap, cooldown',
  birth:     'Birth — Reproduction, hybrids, wilds',
  mutations: 'Mutations — Mutation conditions + win conditions',
  visual:    'Visual — Glow, trails, ant scale, skins, heatmap',
  presets:   'Presets — Load and save scenarios',
};
async function tab(page, id) {
  const btn = page.locator(`button[title="${TAB_TITLES[id]}"]`).first();
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(600); }
  else console.warn(`  ⚠️  tab not found: ${id}`);
}
async function clickPreset(page, pattern) {
  const card = page.locator('div[style*="cursor: pointer"]').filter({ hasText: pattern }).first();
  if (await card.count()) { await card.click(); await page.waitForTimeout(700); return true; }
  console.warn(`  ⚠️  preset not found: ${pattern}`);
  return false;
}
async function clickRun(page) {
  // The main ▶ Run that switches edit→run mode (first one, before transport bar)
  const btn = page.locator('button').filter({ hasText: '▶ Run' }).first();
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(300); }
}
async function clickPause(page) {
  const btn = page.locator('button').filter({ hasText: /⏸/ }).first();
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(300); }
}
async function setSpeed(page, mult) {
  const btn = page.locator('button').filter({ hasText: String(mult) }).first();
  if (await btn.count()) await btn.click();
}
async function resetSim(page) {
  const btn = page.locator('button').filter({ hasText: '↺ Reset' }).first();
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(500); }
}
async function goSandbox(page) {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.locator('button').filter({ hasText: 'Sandbox' }).first().click();
  await page.waitForTimeout(1000);
}
async function runPreset(page, pattern, speedMult, runMs) {
  await tab(page, 'presets');
  await page.waitForTimeout(400);
  if (!await clickPreset(page, pattern)) return false;
  await tab(page, 'players');
  await clickRun(page);
  await setSpeed(page, speedMult);
  await page.waitForTimeout(runMs);
  await clickPause(page);
  await page.waitForTimeout(400);
  return true;
}
// ── main ─────────────────────────────────────────────────
async function main() {
  const browser = await chromium.launch({ headless: false, args: ['--window-size=1400,900'] });
  const ctx = await browser.newContext({ viewport: VP });
  const page = await ctx.newPage();
  console.log(`\n📷 SCREENSHOT MANUAL v4   ${BASE}\n`);

  // ════════════════════════════════════════════════════════
  // 01 — MAIN MENU
  // ════════════════════════════════════════════════════════
  console.log('[01] Main menu');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot(page, '01-main-menu', 300);

  // ════════════════════════════════════════════════════════
  // 02 — SANDBOX INITIAL VIEW
  // ════════════════════════════════════════════════════════
  console.log('[02] Sandbox initial');
  await goSandbox(page);
  await shot(page, '02-sandbox-overview');
  await shotCanvas(page, '02b-canvas-edit-empty');

  // ════════════════════════════════════════════════════════
  // 03 — PRESETS TAB
  // ════════════════════════════════════════════════════════
  console.log('[03] Presets tab');
  await tab(page, 'presets');
  await shot(page, '03-tab-presets');
  // load four-corners to populate state
  await clickPreset(page, /four corner|Four Corner/i);
  await shot(page, '03b-four-corners-loaded');

  // ════════════════════════════════════════════════════════
  // 04 — PLAYERS TAB
  // ════════════════════════════════════════════════════════
  console.log('[04] Players tab');
  await tab(page, 'players');
  await shot(page, '04-tab-players');

  // ════════════════════════════════════════════════════════
  // 05 — ANTS TAB
  // ════════════════════════════════════════════════════════
  console.log('[05] Ants tab');
  await tab(page, 'ants');
  await shot(page, '05-tab-ants');

  // ════════════════════════════════════════════════════════
  // 06 — FIELD TAB
  // ════════════════════════════════════════════════════════
  console.log('[06] Field tab');
  await tab(page, 'field');
  await shot(page, '06-tab-field');

  // ════════════════════════════════════════════════════════
  // 07 — COMBAT TAB
  // ════════════════════════════════════════════════════════
  console.log('[07] Combat tab');
  await tab(page, 'combat');
  await shot(page, '07-tab-combat');

  // ════════════════════════════════════════════════════════
  // 08 — BIRTH TAB
  // ════════════════════════════════════════════════════════
  console.log('[08] Birth tab');
  await tab(page, 'birth');
  await shot(page, '08-tab-birth');

  // ════════════════════════════════════════════════════════
  // 09 — MUTATIONS TAB (pre-run)
  // ════════════════════════════════════════════════════════
  console.log('[09] Mutations tab');
  await tab(page, 'mutations');
  await shot(page, '09-tab-mutations');

  // ════════════════════════════════════════════════════════
  // 10 — VISUAL TAB
  // ════════════════════════════════════════════════════════
  console.log('[10] Visual tab');
  await tab(page, 'visual');
  await shot(page, '10-tab-visual');

  // ════════════════════════════════════════════════════════
  // 11 — TRANSPORT BAR (edit mode, full UI)
  // ════════════════════════════════════════════════════════
  console.log('[11] Transport bar edit mode');
  await tab(page, 'players');
  await shot(page, '11-transport-edit-mode');
  await shotCanvas(page, '11b-canvas-edit-with-ants');

  // ════════════════════════════════════════════════════════
  // 12 — RUN SIMULATION (four-corners)
  // ════════════════════════════════════════════════════════
  console.log('[12] Run simulation (four-corners)');
  await clickRun(page);
  await page.waitForTimeout(3000);
  await shot(page, '12-simulation-running-3s');
  await shotCanvas(page, '12b-canvas-running-3s');

  // ════════════════════════════════════════════════════════
  // 13 — STATS TAB live
  // ════════════════════════════════════════════════════════
  console.log('[13] Stats live');
  await tab(page, 'stats');
  await page.waitForTimeout(800);
  await shot(page, '13-tab-stats-live');

  // ════════════════════════════════════════════════════════
  // 14 — EVENTS TAB live
  // ════════════════════════════════════════════════════════
  console.log('[14] Events live');
  await tab(page, 'events');
  await page.waitForTimeout(800);
  await shot(page, '14-tab-events-live');

  // ════════════════════════════════════════════════════════
  // 15 — SPEED ×8 more data
  // ════════════════════════════════════════════════════════
  console.log('[15] Speed ×8 — more data');
  await setSpeed(page, 8);
  await page.waitForTimeout(5000);
  await tab(page, 'stats');
  await page.waitForTimeout(800);
  await shot(page, '15-stats-after-x8');
  await tab(page, 'events');
  await page.waitForTimeout(600);
  await shot(page, '15b-events-after-x8');

  // ════════════════════════════════════════════════════════
  // 16 — PAUSE + STEP CONTROLS
  // ════════════════════════════════════════════════════════
  console.log('[16] Pause + step back');
  await clickPause(page);
  await tab(page, 'players');
  await shot(page, '16-paused-transport');
  await shotCanvas(page, '16b-canvas-paused');
  // step back
  const stepBackBtn = page.locator('button').filter({ hasText: '−1' }).first();
  if (await stepBackBtn.count()) await stepBackBtn.click();
  await page.waitForTimeout(400);
  await shot(page, '16c-after-step-back');

  // ════════════════════════════════════════════════════════
  // 17 — HEATMAPS (need to have run already)
  // ════════════════════════════════════════════════════════
  console.log('[17] Heatmaps');
  await tab(page, 'visual');
  await page.waitForTimeout(500);
  const allSelects = page.locator('select');
  const sCount = await allSelects.count();
  let heatSel = null;
  for (let i = 0; i < sCount; i++) {
    const opts = await allSelects.nth(i).locator('option').allTextContents();
    if (opts.some(o => /deaths|captures|contested/i.test(o))) {
      heatSel = allSelects.nth(i); break;
    }
  }
  if (heatSel) {
    await shot(page, '17-visual-tab-with-heatmap');
    await heatSel.selectOption('deaths'); await page.waitForTimeout(700);
    await shotCanvas(page, '17b-heatmap-deaths');
    await shot(page, '17b2-heatmap-deaths-full');
    await heatSel.selectOption('captures'); await page.waitForTimeout(500);
    await shotCanvas(page, '17c-heatmap-captures');
    await heatSel.selectOption('contested'); await page.waitForTimeout(500);
    await shotCanvas(page, '17d-heatmap-contested');
    await heatSel.selectOption('off');
  }

  // ════════════════════════════════════════════════════════
  // 18 — MUTATIONS TAB live progress
  // ════════════════════════════════════════════════════════
  console.log('[18] Mutations live');
  await tab(page, 'mutations');
  await page.waitForTimeout(600);
  await shot(page, '18-tab-mutations-live');

  // ════════════════════════════════════════════════════════
  // 19 — CHAOS EIGHT PRESET
  // ════════════════════════════════════════════════════════
  console.log('[19] Chaos Eight preset');
  if (await runPreset(page, /chaos eight|Chaos Eight/i, 4, 6000)) {
    await shot(page, '19-chaos-eight-overview');
    await shotCanvas(page, '19b-chaos-eight-canvas');
    await tab(page, 'stats');
    await page.waitForTimeout(600);
    await shot(page, '19c-chaos-eight-stats');
  }

  // ════════════════════════════════════════════════════════
  // 20 — SNOWFLAKE PRESET
  // ════════════════════════════════════════════════════════
  console.log('[20] Snowflake preset');
  if (await runPreset(page, /snowflake|Snowflake/i, 2, 5000)) {
    await shotCanvas(page, '20-snowflake-canvas');
    await shot(page, '20b-snowflake-overview');
  }

  // ════════════════════════════════════════════════════════
  // 21 — PATH MARATHON (mutations visible)
  // ════════════════════════════════════════════════════════
  console.log('[21] Path Marathon preset');
  if (await runPreset(page, /path marathon|Path Marathon/i, 8, 6000)) {
    await shotCanvas(page, '21-path-marathon-canvas');
    await tab(page, 'mutations');
    await page.waitForTimeout(600);
    await shot(page, '21b-path-marathon-mutations');
    await tab(page, 'stats');
    await page.waitForTimeout(600);
    await shot(page, '21c-path-marathon-stats');
  }

  // ════════════════════════════════════════════════════════
  // 22 — QUADRANT MANDALA
  // ════════════════════════════════════════════════════════
  console.log('[22] Quadrant Mandala preset');
  if (await runPreset(page, /mandala|Mandala/i, 4, 5000)) {
    await shotCanvas(page, '22-mandala-canvas');
    await shot(page, '22b-mandala-overview');
  }

  // ════════════════════════════════════════════════════════
  // 23 — LONE WOLF (single ant, no combat)
  // ════════════════════════════════════════════════════════
  console.log('[23] Lone Wolf preset');
  if (await runPreset(page, /lone wolf|Lone Wolf/i, 1, 5000)) {
    await shotCanvas(page, '23-lone-wolf-canvas');
    await shot(page, '23b-lone-wolf-overview');
  }

  // ════════════════════════════════════════════════════════
  // 24 — HALO GARDEN (mutations + win condition)
  // ════════════════════════════════════════════════════════
  console.log('[24] Halo Garden preset');
  if (await runPreset(page, /halo garden|Halo Garden/i, 4, 6000)) {
    await shotCanvas(page, '24-halo-garden-canvas');
    await tab(page, 'mutations');
    await page.waitForTimeout(600);
    await shot(page, '24b-halo-garden-mutations');
  }

  // ════════════════════════════════════════════════════════
  // 25 — WILD STORM
  // ════════════════════════════════════════════════════════
  console.log('[25] Wild Storm preset');
  if (await runPreset(page, /wild storm|Wild Storm/i, 4, 5000)) {
    await shotCanvas(page, '25-wild-storm-canvas');
    await tab(page, 'events');
    await page.waitForTimeout(600);
    await shot(page, '25b-wild-storm-events');
  }

  // ════════════════════════════════════════════════════════
  // 26 — RESET + RE-ROLL
  // ════════════════════════════════════════════════════════
  console.log('[26] Reset + re-roll');
  await resetSim(page);
  await tab(page, 'players');
  await shot(page, '26-reset-edit-mode');
  await page.locator('button').filter({ hasText: '⟳ Re-roll' }).first().click().catch(()=>{});
  await page.waitForTimeout(400);
  await shot(page, '26b-reroll-seed');

  // ════════════════════════════════════════════════════════
  // 27 — SETTINGS SCREEN
  // ════════════════════════════════════════════════════════
  console.log('[27] Settings screen');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.locator('button').filter({ hasText: /⚙/ }).first().click();
  await page.waitForTimeout(800);
  await shot(page, '27-settings-screen');

  // ════════════════════════════════════════════════════════
  // Done
  // ════════════════════════════════════════════════════════
  await browser.close();
  const files = readdirSync(OUT).filter(f => f.endsWith('.png')).sort();
  console.log(`\n✅ ${files.length} screenshots saved to ${OUT}`);
  files.forEach(f => console.log(`   ${f}`));
}
main().catch(e => { console.error(e); process.exit(1); });
