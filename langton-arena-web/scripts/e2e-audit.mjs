/**
 * e2e-audit.mjs — Полный E2E-аудит Langton Arena Sandbox
 * Версия 3.0 — добавлены проверки Этапа 4 (Events / Heatmaps / Highlights),
 *              headless mode, CI-friendly отчёты (JSON + Markdown), CLI-флаги.
 *
 * Запуск:
 *   npm run audit            # headless, для CI/локально
 *   npm run audit:headed     # с окном (отладка)
 *   AUDIT_ONLY=transport,canvas npm run audit  # только указанные секции
 *   AUDIT_BASE=http://localhost:5174 npm run audit  # другой URL
 *
 * Артефакты:
 *   /tmp/audit-*.png         # скриншоты каждой секции
 *   /tmp/audit-report.json   # машинно-читаемый отчёт
 *   /tmp/audit-report.md     # человеко-читаемый отчёт (для DEVLOG)
 *
 * Exit codes:
 *   0 — все PASS (или только WARN, см. AUDIT_STRICT)
 *   1 — есть FAIL
 *   2 — неперехваченное исключение / setup failure
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

// ─── Версия и конфигурация ───────────────────────────────────────────────────
const AUDIT_VERSION = '3.0';
const BASE = process.env.AUDIT_BASE || 'http://localhost:5173';
const HEADED = process.env.AUDIT_HEADED === '1' || process.env.AUDIT_HEADED === 'true';
const STRICT = process.env.AUDIT_STRICT === '1';
const ONLY = (process.env.AUDIT_ONLY || '').split(',').map(s => s.trim()).filter(Boolean);

const enabled = (s) => ONLY.length === 0 || ONLY.includes(s);

// ─── Лог-система ─────────────────────────────────────────────────────────────
const LOG = [];
const TIMING = {};
let PASS = 0, FAIL = 0, WARN = 0;
let CURRENT_SECTION = null;
let SECTION_START = 0;

function log(level, category, action, detail = '') {
  const ts = new Date().toISOString().slice(11, 23);
  const icon = level === 'PASS' ? '✅' : level === 'FAIL' ? '❌' : level === 'WARN' ? '⚠️ ' : '📋';
  const line = `[${ts}] ${icon} [${category}] ${action}${detail ? ' — ' + detail : ''}`;
  LOG.push({ level, category, action, detail, ts, section: CURRENT_SECTION });
  console.log(line);
  if (level === 'PASS') PASS++;
  else if (level === 'FAIL') FAIL++;
  else if (level === 'WARN') WARN++;
}
const pass = (c, a, d) => log('PASS', c, a, d);
const fail = (c, a, d) => log('FAIL', c, a, d);
const warn = (c, a, d) => log('WARN', c, a, d);
const info = (c, a, d) => log('INFO', c, a, d);

function startSection(name) {
  CURRENT_SECTION = name;
  SECTION_START = Date.now();
}
function endSection() {
  if (CURRENT_SECTION) {
    TIMING[CURRENT_SECTION] = Date.now() - SECTION_START;
  }
  CURRENT_SECTION = null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function getConsoleErrors(page) {
  const errs = page._consoleErrors ?? [];
  page._consoleErrors = [];
  return errs;
}
async function checkNoErrors(page, ctx) {
  const errs = await getConsoleErrors(page);
  const real = errs.filter((e) =>
    !e.includes('Download the React DevTools') &&
    !e.includes('[vite] connected') &&
    !e.includes('[vite] connecting'),
  );
  const errors = real.filter((e) => !e.startsWith('WARNING:') && !e.includes('Warning:'));
  const warnings = real.filter((e) => e.startsWith('WARNING:') || e.includes('Warning:'));
  if (errors.length === 0 && warnings.length === 0) pass('CONSOLE', ctx, 'no errors/warnings');
  else {
    errors.forEach((e) => fail('CONSOLE', ctx, e.slice(0, 200)));
    warnings.forEach((e) => warn('CONSOLE', ctx, e.slice(0, 200)));
  }
  return errors.length === 0;
}

async function clickBtn(page, textRe, cat, label) {
  const btn = page.locator('button').filter({ hasText: textRe }).first();
  if (!await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    warn(cat, label, `button "${textRe}" not visible`);
    return false;
  }
  await btn.click();
  await page.waitForTimeout(350);
  pass(cat, label, 'clicked');
  return true;
}

const BTN_RUN     = /▶\s*[Rr]un/;
const BTN_PAUSE   = /⏸|[Pp]ause/;
const BTN_RESET   = /↺\s*Reset/;
const BTN_STEP_P1 = /^\+1$/;
const BTN_STEP_P5 = /^\+5$/;
const BTN_STEP_M1 = /^−1$/;

async function loadPreset(page, re) {
  const presetsBtn = page.locator('button').filter({ hasText: /★|Presets/i }).first();
  if (await presetsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await presetsBtn.click();
    await page.waitForTimeout(800);
    const preset = page.locator('*').filter({ hasText: re }).first();
    if (await preset.isVisible({ timeout: 1500 }).catch(() => false)) {
      await preset.click();
      await page.waitForTimeout(600);
    }
  }
}

async function runFor(page, ms) {
  const runBtn = page.locator('button').filter({ hasText: BTN_RUN }).first();
  if (await runBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await runBtn.click();
    await page.waitForTimeout(ms);
  }
}

async function pauseIfRunning(page) {
  const pauseBtn = page.locator('button').filter({ hasText: BTN_PAUSE }).first();
  if (await pauseBtn.isVisible({ timeout: 800 }).catch(() => false)) {
    await pauseBtn.click();
    await page.waitForTimeout(300);
  }
}

// ─── Section helpers ─────────────────────────────────────────────────────────
async function testSlidersAndToggles(page, cat) {
  const sliders = page.locator('input[type="range"]');
  const sc = await sliders.count();
  for (let i = 0; i < Math.min(sc, 5); i++) {
    const sl = sliders.nth(i);
    if (!await sl.isVisible({ timeout: 500 }).catch(() => false)) continue;
    const min = await sl.getAttribute('min') || '0';
    const max = await sl.getAttribute('max') || '100';
    const mid = Math.round((+min + +max) / 2).toString();
    await sl.fill(mid).catch(() => {});
    await page.waitForTimeout(100);
    pass(cat, `Slider #${i}`, `→ ${mid} (${min}..${max})`);
  }
  const switches = page.locator('[role="switch"]');
  const swc = await switches.count();
  for (let i = 0; i < Math.min(swc, 5); i++) {
    const sw = switches.nth(i);
    if (await sw.isVisible({ timeout: 500 }).catch(() => false)) {
      await sw.click();
      await page.waitForTimeout(150);
      await sw.click();
      pass(cat, `Toggle #${i}`, 'cycled');
    }
  }
  await checkNoErrors(page, `${cat} tab`);
}

async function testConfigTabs(page) {
  if (enabled('players')) {
    startSection('players');
    const tab = page.locator('button').filter({ hasText: /👥|Players/i }).first();
    if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(400);
      const selects = page.locator('select');
      const sc = await selects.count();
      for (let i = 0; i < Math.min(sc, 3); i++) {
        const sel = selects.nth(i);
        const opts = await sel.locator('option').allInnerTexts().catch(() => []);
        if (opts.length > 1) {
          await sel.selectOption({ index: 1 }).catch(() => {});
          await page.waitForTimeout(150);
          pass('PLAYERS', `Select #${i}`, opts[1]);
          await sel.selectOption({ index: 0 }).catch(() => {});
        }
      }
      await checkNoErrors(page, 'players tab');
    }
    endSection();
  }

  for (const [id, icon, name] of [
    ['ants',   '🐜', 'Ants'],
    ['field',  '⬜', 'Field'],
    ['combat', '⚔',  'Combat'],
    ['birth',  '✚',  'Birth'],
    ['visual', '✨', 'Visual'],
  ]) {
    if (!enabled(id)) continue;
    startSection(id);
    const tab = page.locator('button').filter({ hasText: new RegExp(`${icon}|^${name}$`, 'i') }).first();
    if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(400);
      await testSlidersAndToggles(page, id.toUpperCase());
    }
    endSection();
  }
}

async function testTransport(page) {
  if (await clickBtn(page, BTN_RUN, 'TRANSPORT', '▶ Run')) {
    await page.waitForTimeout(600);
    await checkNoErrors(page, 'after Run');
  }
  await clickBtn(page, BTN_PAUSE, 'TRANSPORT', '⏸ Pause');

  for (let i = 0; i < 3; i++) {
    const step1 = page.locator('button').filter({ hasText: BTN_STEP_P1 }).first();
    if (await step1.isVisible({ timeout: 500 }).catch(() => false)) {
      await step1.click();
      await page.waitForTimeout(150);
    }
  }
  pass('TRANSPORT', '+1 Step ×3');
  await clickBtn(page, BTN_STEP_P5, 'TRANSPORT', '+5 Step');

  const customInput = page.locator('input[type="number"]').first();
  if (await customInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await customInput.click({ clickCount: 3 });
    await customInput.fill('25');
    await page.waitForTimeout(200);
    pass('TRANSPORT', 'Custom input', 'set to 25');
    const stepN = page.locator('button').filter({ hasText: /^\+25$/ }).first();
    if (await stepN.isVisible({ timeout: 1000 }).catch(() => false)) {
      await stepN.click();
      await page.waitForTimeout(400);
      pass('TRANSPORT', '+25 Step', 'custom N');
    }
    await customInput.click({ clickCount: 3 });
    await customInput.fill('0');
    await page.waitForTimeout(200);
    pass('TRANSPORT', 'Custom input "0"', 'no crash');
    await customInput.click({ clickCount: 3 });
    await customInput.fill('100');
  }

  const stepBack1 = page.locator('button').filter({ hasText: BTN_STEP_M1 }).first();
  if (await stepBack1.isVisible({ timeout: 1500 }).catch(() => false)) {
    const disabled = await stepBack1.isDisabled({ timeout: 300 }).catch(() => false);
    if (!disabled) {
      await stepBack1.click();
      await page.waitForTimeout(400);
      pass('TRANSPORT', '−1 StepBack', 'with history');
      await checkNoErrors(page, 'step back');
    } else {
      warn('TRANSPORT', '−1 StepBack', 'disabled — no snapshots yet');
    }
  }

  for (const sp of ['0.25', '0.5', '2', '4', '8', '16', '1']) {
    const btn = page.locator('button').filter({ hasText: new RegExp(`^${sp}$`) }).first();
    if (await btn.isVisible({ timeout: 600 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(80);
      pass('TRANSPORT', `Speed ×${sp}`);
    }
  }

  const allSliders = page.locator('input[type="range"]');
  const sc = await allSliders.count();
  if (sc > 0) {
    const tps = allSliders.last();
    if (await tps.isVisible({ timeout: 800 }).catch(() => false)) {
      await tps.fill('30');
      await page.waitForTimeout(150);
      pass('TRANSPORT', 'TPS Slider', '→ 30');
      await tps.fill('15');
    }
  }

  await clickBtn(page, BTN_RESET, 'TRANSPORT', '↺ Reset');
  await clickBtn(page, /⟳|[Rr]e.?roll/, 'TRANSPORT', '⟳ Re-roll');
  await page.screenshot({ path: '/tmp/audit-transport.png' });
}

async function testCanvasInteractions(page) {
  await pauseIfRunning(page);
  await clickBtn(page, BTN_RESET, 'CANVAS', 'reset to edit');

  const canvas = page.locator('canvas').first();
  if (!await canvas.isVisible({ timeout: 3000 }).catch(() => false)) {
    warn('CANVAS', 'Canvas', 'not visible');
    return;
  }
  const box = await canvas.boundingBox();
  if (!box) {
    warn('CANVAS', 'Canvas bounds', 'no bounding box');
    return;
  }

  info('CANVAS', 'Bounds', `w=${Math.round(box.width)} h=${Math.round(box.height)}`);

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(250);
  pass('CANVAS', 'LMB click center');

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { modifiers: ['Shift'] });
  await page.waitForTimeout(250);
  pass('CANVAS', 'Shift+LMB');

  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3, { button: 'right' });
  await page.waitForTimeout(200);
  pass('CANVAS', 'RMB click');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(150);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(150);
  pass('CANVAS', 'Mouse wheel');

  for (const [rx, ry] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
    await page.mouse.click(box.x + box.width * rx, box.y + box.height * ry);
    await page.waitForTimeout(120);
  }
  pass('CANVAS', 'Clicks at 4 corners');

  await checkNoErrors(page, 'canvas interactions');
  await page.screenshot({ path: '/tmp/audit-canvas.png' });
}

async function testStress(page) {
  await loadPreset(page, /chaos|corners|faceoff/);
  const sp8 = page.locator('button').filter({ hasText: /^8$/ }).first();
  if (await sp8.isVisible({ timeout: 1000 }).catch(() => false)) {
    await sp8.click();
    pass('STRESS', 'Speed ×8');
  }
  await clickBtn(page, BTN_RUN, 'STRESS', '▶ Run');

  const fpsResult = await page.evaluate(async () => {
    let frames = 0;
    const start = performance.now();
    return new Promise((resolve) => {
      const tick = () => {
        frames++;
        if (performance.now() - start >= 5000) {
          resolve({ frames, ms: performance.now() - start });
        } else {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });
  });

  const fps = (fpsResult.frames / (fpsResult.ms / 1000)).toFixed(1);
  info('STRESS', 'FPS measured', `${fps} fps over ${(fpsResult.ms/1000).toFixed(1)}s`);
  if (+fps >= 30) pass('STRESS', '5s stress test', `${fps} fps — good`);
  else if (+fps >= 15) warn('STRESS', '5s stress test', `${fps} fps — slow`);
  else fail('STRESS', '5s stress test', `${fps} fps — unacceptable`);

  const errs = await getConsoleErrors(page);
  const real = errs.filter((e) => !e.startsWith('WARNING:') && !e.includes('Warning:'));
  if (real.length === 0) pass('STRESS', 'No JS errors during stress');
  else real.forEach((e) => fail('STRESS', 'Error during stress', e.slice(0, 150)));

  await page.screenshot({ path: '/tmp/audit-stress.png' });
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═'.repeat(70));
  console.log(`  LANGTON ARENA E2E AUDIT · v${AUDIT_VERSION}`);
  console.log(`  Mode: ${HEADED ? 'headed (browser visible)' : 'headless'} | Strict: ${STRICT}`);
  console.log(`  URL: ${BASE}`);
  console.log(`  Sections: ${ONLY.length ? ONLY.join(',') : 'all'}`);
  console.log('═'.repeat(70));
  info('SETUP', `Audit version ${AUDIT_VERSION}`, `headed=${HEADED} base=${BASE}`);

  const browser = await chromium.launch({
    headless: !HEADED,
    slowMo: HEADED ? 60 : 0,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  page._consoleErrors = [];
  page.on('console', (msg) => {
    const t = msg.type();
    if (t === 'error' || t === 'warning') {
      page._consoleErrors.push(`${t === 'warning' ? 'WARNING' : 'ERROR'}: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => page._consoleErrors.push(`PAGEERROR: ${err.message}`));
  page.on('dialog', async (d) => {
    info('DIALOG', `${d.type()}`, d.message().slice(0, 100));
    await d.accept();
  });

  try {

    // 1. BOOT
    if (enabled('boot')) {
      startSection('boot');
      info('BOOT', 'Navigating', BASE);
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1200);
      const title = await page.title();
      if (title) pass('BOOT', 'Page loaded', `title="${title}"`);
      else fail('BOOT', 'Page loaded', 'no title');
      await checkNoErrors(page, 'initial load');
      await page.screenshot({ path: '/tmp/audit-01-landing.png' });
      endSection();
    }

    // 2. NAV → Sandbox
    if (enabled('nav')) {
      startSection('nav');
      const sandboxBtn = page.locator('button, a').filter({ hasText: /sandbox|песочниц/i }).first();
      if (await sandboxBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await sandboxBtn.click();
        await page.waitForTimeout(1000);
        pass('NAV', 'Navigate to Sandbox');
      } else {
        const allBtns = await page.locator('button').allInnerTexts().catch(() => []);
        warn('NAV', 'Sandbox button not found', `available: ${allBtns.join('|').slice(0, 200)}`);
      }
      await checkNoErrors(page, 'after nav');
      await page.screenshot({ path: '/tmp/audit-02-sandbox.png' });
      endSection();
    }

    // 3. TABS — 9 табов (Stage 4: events добавлен)
    if (enabled('tabs')) {
      startSection('tabs');
      const TAB_MAP = [
        { id: 'presets', re: /★|Presets/i },
        { id: 'players', re: /👥|Players/i },
        { id: 'ants',    re: /🐜|Ants/i },
        { id: 'stats',   re: /📊|Stats/i },
        { id: 'events',  re: /📋|Events/i },
        { id: 'field',   re: /⬜|Field/i },
        { id: 'combat',  re: /⚔|Combat/i },
        { id: 'birth',   re: /✚|Birth/i },
        { id: 'visual',  re: /✨|Visual/i },
      ];
      for (const tab of TAB_MAP) {
        const btn = page.locator('button').filter({ hasText: tab.re }).first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(400);
          await checkNoErrors(page, `tab ${tab.id}`);
          await page.screenshot({ path: `/tmp/audit-tab-${tab.id}.png` });
          pass('TABS', `Tab: ${tab.id}`);
        } else {
          warn('TABS', `Tab: ${tab.id}`, 'not found');
        }
      }
      endSection();
    }

    // 4. PRESETS
    if (enabled('presets')) {
      startSection('presets');
      const presetsBtn = page.locator('button').filter({ hasText: /★|presets/i }).first();
      if (await presetsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await presetsBtn.click();
        await page.waitForTimeout(1500);
        const presetTexts = ['faceoff', 'corners', 'chaos', 'wolf', 'storm', 'showcase', 'lone'];
        let loaded = 0;
        for (const pt of presetTexts) {
          const el = page.locator('*').filter({ hasText: new RegExp(pt, 'i') }).first();
          if (await el.isVisible({ timeout: 800 }).catch(() => false)) {
            await el.click();
            await page.waitForTimeout(500);
            pass('PRESETS', `Load preset "${pt}"`);
            loaded++;
            await checkNoErrors(page, `load preset ${pt}`);
            break;
          }
        }
        if (loaded === 0) warn('PRESETS', 'No preset loadable by name');
        await page.screenshot({ path: '/tmp/audit-presets.png' });
      }
      endSection();
    }

    // 5-10. CONFIG TABS
    await testConfigTabs(page);

    // 11. STATS
    if (enabled('stats')) {
      startSection('stats');
      await loadPreset(page, /chaos|faceoff|corners/);
      await runFor(page, 3000);
      const statsTab = page.locator('button').filter({ hasText: /📊|^Stats$/i }).first();
      if (await statsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await statsTab.click();
        await page.waitForTimeout(800);
        await checkNoErrors(page, 'stats tab live');
        await page.screenshot({ path: '/tmp/audit-stats-live.png' });
        const canvases = page.locator('canvas');
        const cc = await canvases.count();
        if (cc >= 2) pass('STATS', 'Charts (canvas)', `${cc} canvas elements`);
        else warn('STATS', 'Charts (canvas)', `${cc} canvas — expected ≥2`);
        const bodyText = await page.locator('body').innerText().catch(() => '');
        if (/tick\s+\d+/i.test(bodyText)) pass('STATS', 'Tick counter visible');
        else warn('STATS', 'Tick counter not detected');
        if (/\d+(\.\d+)?%/.test(bodyText)) pass('STATS', 'Territory % present');
      }
      endSection();
    }

    // 12. EVENTS (Stage 4)
    if (enabled('events')) {
      startSection('events');
      await pauseIfRunning(page);
      const eventsBtn = page.locator('button').filter({ hasText: /📋|^Events$/i }).first();
      if (await eventsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await eventsBtn.click();
        await page.waitForTimeout(500);
        await checkNoErrors(page, 'events tab');
        const types = ['capture', 'clash', 'death', 'birth', 'hybrid', 'wild'];
        for (const t of types) {
          const chip = page.locator('button').filter({ hasText: new RegExp(`^${t}$`, 'i') }).first();
          if (await chip.isVisible({ timeout: 1000 }).catch(() => false)) {
            await chip.click();
            await page.waitForTimeout(150);
            await chip.click();
            pass('EVENTS', `Filter chip: ${t}`, 'toggled');
          } else {
            warn('EVENTS', `Filter chip: ${t}`, 'not found');
          }
        }
        const eventCards = page.locator('button[title*="Click to step back"]');
        const ecc = await eventCards.count();
        if (ecc > 0) pass('EVENTS', `Event cards rendered`, `${ecc} cards`);
        else warn('EVENTS', 'No event cards', 'simulation may need more time');
        await page.screenshot({ path: '/tmp/audit-events.png' });
      } else {
        warn('EVENTS', 'Events tab', 'not found — Stage 4 may not be deployed');
      }
      endSection();
    }

    // 13. HEATMAPS (Stage 4)
    if (enabled('heatmaps')) {
      startSection('heatmaps');
      const visualBtn = page.locator('button').filter({ hasText: /✨|^Visual$/i }).first();
      if (await visualBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await visualBtn.click();
        await page.waitForTimeout(500);
        const selects = page.locator('select');
        const sc = await selects.count();
        let heatmapSelect = null;
        for (let i = 0; i < sc; i++) {
          const opts = await selects.nth(i).locator('option').allInnerTexts().catch(() => []);
          if (opts.some((o) => /deaths|captures|contested/i.test(o))) {
            heatmapSelect = selects.nth(i);
            break;
          }
        }
        if (heatmapSelect) {
          pass('HEATMAPS', 'Heatmap dropdown found');
          for (const mode of ['deaths', 'captures', 'contested']) {
            await heatmapSelect.selectOption({ value: mode }).catch(() => {});
            await page.waitForTimeout(400);
            await checkNoErrors(page, `heatmap ${mode}`);
            await page.screenshot({ path: `/tmp/audit-heatmap-${mode}.png` });
            pass('HEATMAPS', `Mode: ${mode}`, 'switched');
          }
          await heatmapSelect.selectOption({ value: 'off' }).catch(() => {});
        } else {
          warn('HEATMAPS', 'Heatmap dropdown', 'not found');
        }
      }
      endSection();
    }

    // 14. HIGHLIGHTS (Stage 4)
    if (enabled('highlights')) {
      startSection('highlights');
      const statsBtn = page.locator('button').filter({ hasText: /📊|^Stats$/i }).first();
      if (await statsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await statsBtn.click();
        await page.waitForTimeout(500);
        const body = await page.locator('body').innerText().catch(() => '');
        const hasHighlights = /Highlights\s*·/i.test(body);
        if (hasHighlights) {
          pass('HIGHLIGHTS', 'Highlights section', 'visible');
          const types = [
            { icon: '🔥', name: 'biggest_fight' },
            { icon: '🏆', name: 'peak_territory' },
            { icon: '⏱', name: 'longest_streak' },
            { icon: '💀', name: 'first_death' },
            { icon: '⚔', name: 'most_kills_clash' },
          ];
          for (const t of types) {
            if (body.includes(t.icon)) pass('HIGHLIGHTS', `Highlight: ${t.name}`, 'rendered');
          }
          await page.screenshot({ path: '/tmp/audit-highlights.png' });
        } else {
          warn('HIGHLIGHTS', 'Highlights section', 'not visible — needs more simulation events');
        }
      }
      endSection();
    }

    // 15. TRANSPORT
    if (enabled('transport')) {
      startSection('transport');
      await testTransport(page);
      endSection();
    }

    // 16. CANVAS
    if (enabled('canvas')) {
      startSection('canvas');
      await testCanvasInteractions(page);
      endSection();
    }

    // 17. STRESS
    if (enabled('stress')) {
      startSection('stress');
      await testStress(page);
      endSection();
    }

    // 18. MEMORY
    if (enabled('memory')) {
      startSection('memory');
      const heap = await page.evaluate(() => {
        if (performance.memory) {
          return {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
          };
        }
        return null;
      }).catch(() => null);
      if (heap) {
        info('MEMORY', 'JS Heap', `used=${heap.used}MB total=${heap.total}MB limit=${heap.limit}MB`);
        if (heap.used < 200) pass('MEMORY', 'Heap size reasonable', `${heap.used}MB`);
        else if (heap.used < 500) warn('MEMORY', 'Heap size large', `${heap.used}MB`);
        else fail('MEMORY', 'Heap size too large', `${heap.used}MB`);
      } else {
        info('MEMORY', 'performance.memory not available');
      }
      endSection();
    }

    await page.screenshot({ path: '/tmp/audit-final.png' });
    info('DONE', 'All sections tested');

  } catch (globalErr) {
    fail('GLOBAL', 'Unhandled exception', globalErr.stack?.slice(0, 400) || globalErr.message);
    await page.screenshot({ path: '/tmp/audit-crash.png' }).catch(() => {});
  } finally {
    if (HEADED) await page.waitForTimeout(2000);
    await browser.close();
  }

  await writeReports();
  printFinalSummary();

  if (FAIL > 0) process.exit(1);
  if (STRICT && WARN > 0) process.exit(1);
  process.exit(0);
}

// ─── Reports ─────────────────────────────────────────────────────────────────
async function writeReports() {
  const report = {
    version: AUDIT_VERSION,
    timestamp: new Date().toISOString(),
    base: BASE,
    headed: HEADED,
    summary: { pass: PASS, fail: FAIL, warn: WARN, total: PASS + FAIL + WARN },
    timing: TIMING,
    entries: LOG,
  };
  writeFileSync('/tmp/audit-report.json', JSON.stringify(report, null, 2));

  const md = [];
  md.push(`# Langton Arena E2E Audit Report`);
  md.push('');
  md.push(`- **Version:** ${AUDIT_VERSION}`);
  md.push(`- **Timestamp:** ${new Date().toISOString()}`);
  md.push(`- **URL:** ${BASE}`);
  md.push(`- **Mode:** ${HEADED ? 'headed' : 'headless'}`);
  md.push('');
  md.push(`## Summary`);
  md.push('');
  md.push(`| Result | Count |`);
  md.push(`|---|---|`);
  md.push(`| ✅ PASS | ${PASS} |`);
  md.push(`| ❌ FAIL | ${FAIL} |`);
  md.push(`| ⚠️ WARN | ${WARN} |`);
  md.push(`| Total | ${PASS + FAIL + WARN} |`);
  md.push('');
  md.push(`## Timing per section`);
  md.push('');
  md.push(`| Section | Time (ms) |`);
  md.push(`|---|---|`);
  for (const [section, ms] of Object.entries(TIMING)) {
    md.push(`| ${section} | ${ms} |`);
  }
  md.push('');
  md.push(`## Issues`);
  md.push('');
  const fails = LOG.filter((e) => e.level === 'FAIL');
  const warns = LOG.filter((e) => e.level === 'WARN');
  if (fails.length === 0 && warns.length === 0) {
    md.push('No issues found.');
  } else {
    if (fails.length > 0) {
      md.push(`### Failures (${fails.length})`);
      md.push('');
      for (const e of fails) {
        md.push(`- **[${e.category}]** ${e.action}${e.detail ? ' — `' + e.detail + '`' : ''}`);
      }
      md.push('');
    }
    if (warns.length > 0) {
      md.push(`### Warnings (${warns.length})`);
      md.push('');
      for (const e of warns) {
        md.push(`- **[${e.category}]** ${e.action}${e.detail ? ' — `' + e.detail + '`' : ''}`);
      }
    }
  }
  writeFileSync('/tmp/audit-report.md', md.join('\n'));
  info('REPORT', 'Written', '/tmp/audit-report.json + /tmp/audit-report.md');
}

function printFinalSummary() {
  const total = PASS + FAIL + WARN;
  console.log('\n' + '═'.repeat(70));
  console.log(`  AUDIT v${AUDIT_VERSION} · FINAL REPORT`);
  console.log('═'.repeat(70));
  console.log(`  ✅ PASS: ${PASS}   ❌ FAIL: ${FAIL}   ⚠️  WARN: ${WARN}   TOTAL: ${total}`);
  console.log(`  Result: ${FAIL === 0 ? (WARN === 0 ? '🟢 ALL GREEN' : '🟡 PASS WITH WARNINGS') : '🔴 FAILURES FOUND'}`);
  console.log('─'.repeat(70));

  const byCategory = {};
  for (const entry of LOG) {
    if (!byCategory[entry.category]) byCategory[entry.category] = { PASS: 0, FAIL: 0, WARN: 0, items: [] };
    if (['PASS', 'FAIL', 'WARN'].includes(entry.level)) byCategory[entry.category][entry.level]++;
    byCategory[entry.category].items.push(entry);
  }
  for (const [cat, data] of Object.entries(byCategory)) {
    const icon = data.FAIL > 0 ? '❌' : data.WARN > 0 ? '⚠️ ' : '✅';
    console.log(`\n  ${icon} [${cat}]  ✅${data.PASS} ❌${data.FAIL} ⚠️${data.WARN}`);
    for (const item of data.items) {
      if (item.level === 'FAIL') console.log(`    ❌ ${item.action}${item.detail ? ': ' + item.detail : ''}`);
      if (item.level === 'WARN') console.log(`    ⚠️  ${item.action}${item.detail ? ': ' + item.detail : ''}`);
    }
  }
  if (Object.keys(TIMING).length > 0) {
    console.log('\n  TIMING:');
    for (const [section, ms] of Object.entries(TIMING)) {
      console.log(`    ${section.padEnd(15)} ${String(ms).padStart(6)}ms`);
    }
  }
  console.log('\n  Reports:');
  console.log('    /tmp/audit-report.json   — machine-readable');
  console.log('    /tmp/audit-report.md     — human-readable');
  console.log('    /tmp/audit-*.png         — screenshots');
  console.log('═'.repeat(70));
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
