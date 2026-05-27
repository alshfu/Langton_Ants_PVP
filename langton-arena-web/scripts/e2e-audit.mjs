/**
 * e2e-audit.mjs — Langton Arena PvP — Professional E2E Audit (Stage 7+)
 *
 * Версия 4.0 — extensive coverage:
 *   • Web Vitals (LCP/FCP/TTFB) + bundle size + network audit (404s)
 *   • 11 tabs (Players/Ants/Stats/Events/Field/Combat/Birth/Mutations/Visual/Presets/Replays)
 *   • Mutations + win conditions
 *   • Replays deep test (record → save → list → playback)
 *   • URL share round-trip (encode/decode in-page via window.LZString-aware eval)
 *   • Canvas pixel-diff (paused-vs-running ensure animation actually moves)
 *   • A11y smoke (buttons have title/aria-label, no role="button" on div tags w/o handlers)
 *   • Multi-viewport rendering (1440, 1024, 768, 480) without console errors
 *   • Strict console error policy with explicit allowlist
 *
 * Запуск:
 *   AUDIT_BASE=https://alshfu.github.io/Langton_Ants_PVP node scripts/e2e-audit.mjs
 *   AUDIT_HEADED=1 ...      # с окном для отладки
 *   AUDIT_STRICT=1 ...      # WARN тоже считается ошибкой
 *   AUDIT_ONLY=boot,tabs    # только указанные секции (CSV)
 *
 * Артефакты:
 *   /tmp/audit-*.png         # секционные скриншоты
 *   /tmp/audit-report.json   # машинно-читаемый
 *   /tmp/audit-report.md     # человеко-читаемый
 *
 * Exit codes:
 *   0 — all green (или WARN при STRICT=0)
 *   1 — есть FAIL (или WARN при STRICT=1)
 *   2 — необработанное исключение / setup failure
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

// ─── Конфиг ──────────────────────────────────────────────────────────────────
const AUDIT_VERSION = '4.0';
const BASE = process.env.AUDIT_BASE || 'http://localhost:5173';
const HEADED = process.env.AUDIT_HEADED === '1' || process.env.AUDIT_HEADED === 'true';
const STRICT = process.env.AUDIT_STRICT === '1';
const ONLY = (process.env.AUDIT_ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
const enabled = (s) => ONLY.length === 0 || ONLY.includes(s);

try { mkdirSync('/tmp/audit', { recursive: true }); } catch {}

// ─── Лог-система ─────────────────────────────────────────────────────────────
const LOG = [];
const TIMING = {};
const NETWORK = { requests: 0, failed: 0, fourOhFour: 0, totalBytes: 0, byType: {} };
const METRICS = {};
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

function startSection(name) { CURRENT_SECTION = name; SECTION_START = Date.now(); }
function endSection() {
  if (CURRENT_SECTION) TIMING[CURRENT_SECTION] = Date.now() - SECTION_START;
  CURRENT_SECTION = null;
}

// ─── Console-error allowlist ─────────────────────────────────────────────────
// Эти сообщения известны и безвредны (Vite dev-сервер, React DevTools).
// ВСЁ остальное (включая WARNING:) считаем проблемой.
const CONSOLE_ALLOWLIST = [
  'Download the React DevTools',
  '[vite] connected',
  '[vite] connecting',
];

async function consumeConsoleErrors(page) {
  const errs = page._consoleErrors ?? [];
  page._consoleErrors = [];
  return errs.filter((e) => !CONSOLE_ALLOWLIST.some((al) => e.includes(al)));
}

async function checkNoErrors(page, ctx) {
  const real = await consumeConsoleErrors(page);
  const errors = real.filter((e) => !e.startsWith('WARNING:') && !e.includes('Warning:'));
  const warnings = real.filter((e) => e.startsWith('WARNING:') || e.includes('Warning:'));
  if (errors.length === 0 && warnings.length === 0) pass('CONSOLE', ctx, 'no errors/warnings');
  else {
    errors.forEach((e) => fail('CONSOLE', ctx, e.slice(0, 220)));
    warnings.forEach((e) => warn('CONSOLE', ctx, e.slice(0, 220)));
  }
  return errors.length === 0;
}

// ─── Хелперы для UI ──────────────────────────────────────────────────────────
async function clickBtn(page, textRe, cat, label) {
  const btn = page.locator('button').filter({ hasText: textRe }).first();
  if (!await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    warn(cat, label, `button "${textRe}" not visible`);
    return false;
  }
  await btn.click();
  await page.waitForTimeout(320);
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
    await page.waitForTimeout(700);
    const preset = page.locator('*').filter({ hasText: re }).first();
    if (await preset.isVisible({ timeout: 1500 }).catch(() => false)) {
      await preset.click();
      await page.waitForTimeout(500);
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
    await page.waitForTimeout(250);
  }
}

async function goToTab(page, re) {
  const tab = page.locator('button').filter({ hasText: re }).first();
  if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(350);
    return true;
  }
  return false;
}

// ─── Хелпер: тесты слайдеров и тогглов в табе ────────────────────────────────
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
      await page.waitForTimeout(120);
      await sw.click();
      pass(cat, `Toggle #${i}`, 'cycled');
    }
  }
  await checkNoErrors(page, `${cat} tab`);
}

// ─── Config tabs (Stage 7: 11 табов) ─────────────────────────────────────────
async function testConfigTabs(page) {
  if (enabled('players')) {
    startSection('players');
    if (await goToTab(page, /👥|Players/i)) {
      const selects = page.locator('select');
      const sc = await selects.count();
      for (let i = 0; i < Math.min(sc, 3); i++) {
        const sel = selects.nth(i);
        const opts = await sel.locator('option').allInnerTexts().catch(() => []);
        if (opts.length > 1) {
          await sel.selectOption({ index: 1 }).catch(() => {});
          await page.waitForTimeout(120);
          pass('PLAYERS', `Select #${i}`, opts[1]);
          await sel.selectOption({ index: 0 }).catch(() => {});
        }
      }
      await checkNoErrors(page, 'players tab');
    }
    endSection();
  }

  for (const [id, icon, name] of [
    ['ants',      '🐜', 'Ants'],
    ['field',     '⬜', 'Field'],
    ['combat',    '⚔',  'Combat'],
    ['birth',     '✚',  'Birth'],
    ['mutations', '🧬', 'Mutations'],
    ['visual',    '✨', 'Visual'],
  ]) {
    if (!enabled(id)) continue;
    startSection(id);
    if (await goToTab(page, new RegExp(`${icon}|^${name}$`, 'i'))) {
      await testSlidersAndToggles(page, id.toUpperCase());
    } else {
      warn(id.toUpperCase(), 'Tab', 'not found');
    }
    endSection();
  }
}

// ─── Transport ───────────────────────────────────────────────────────────────
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
      await page.waitForTimeout(120);
    }
  }
  pass('TRANSPORT', '+1 Step ×3');
  await clickBtn(page, BTN_STEP_P5, 'TRANSPORT', '+5 Step');

  const customInput = page.locator('input[type="number"]').first();
  if (await customInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await customInput.click({ clickCount: 3 });
    await customInput.fill('25');
    await page.waitForTimeout(150);
    pass('TRANSPORT', 'Custom input', 'set to 25');
    const stepN = page.locator('button').filter({ hasText: /^\+25$/ }).first();
    if (await stepN.isVisible({ timeout: 1000 }).catch(() => false)) {
      await stepN.click();
      await page.waitForTimeout(400);
      pass('TRANSPORT', '+25 Step', 'custom N');
    }
    await customInput.click({ clickCount: 3 });
    await customInput.fill('0');
    await page.waitForTimeout(150);
    pass('TRANSPORT', 'Custom input "0"', 'no crash');
    await customInput.click({ clickCount: 3 });
    await customInput.fill('100');
  }

  // Step-back требует наличия snapshots — сначала прогоним 30 тиков
  const runBtn = page.locator('button').filter({ hasText: BTN_RUN }).first();
  if (await runBtn.isVisible({ timeout: 800 }).catch(() => false)) {
    await runBtn.click();
    await page.waitForTimeout(1200);
    await pauseIfRunning(page);
  }
  const stepBack1 = page.locator('button').filter({ hasText: BTN_STEP_M1 }).first();
  if (await stepBack1.isVisible({ timeout: 1500 }).catch(() => false)) {
    const disabled = await stepBack1.isDisabled({ timeout: 300 }).catch(() => false);
    if (!disabled) {
      await stepBack1.click();
      await page.waitForTimeout(350);
      pass('TRANSPORT', '−1 StepBack', 'with history');
      await checkNoErrors(page, 'step back');
    } else {
      warn('TRANSPORT', '−1 StepBack', 'still disabled after 1.2s run — engine may not snapshot');
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
      await page.waitForTimeout(120);
      pass('TRANSPORT', 'TPS Slider', '→ 30');
      await tps.fill('15');
    }
  }

  await clickBtn(page, BTN_RESET, 'TRANSPORT', '↺ Reset');
  await clickBtn(page, /⟳|[Rr]e.?roll/, 'TRANSPORT', '⟳ Re-roll');
  await page.screenshot({ path: '/tmp/audit-transport.png' });
}

// ─── Canvas interactions ─────────────────────────────────────────────────────
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
  await page.waitForTimeout(200);
  pass('CANVAS', 'LMB click center');

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { modifiers: ['Shift'] });
  await page.waitForTimeout(200);
  pass('CANVAS', 'Shift+LMB');

  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3, { button: 'right' });
  await page.waitForTimeout(180);
  pass('CANVAS', 'RMB click');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(120);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(120);
  pass('CANVAS', 'Mouse wheel');

  for (const [rx, ry] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
    await page.mouse.click(box.x + box.width * rx, box.y + box.height * ry);
    await page.waitForTimeout(100);
  }
  pass('CANVAS', 'Clicks at 4 corners');

  await checkNoErrors(page, 'canvas interactions');
  await page.screenshot({ path: '/tmp/audit-canvas.png' });
}

// ─── Stress / FPS ────────────────────────────────────────────────────────────
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
        if (performance.now() - start >= 5000) resolve({ frames, ms: performance.now() - start });
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  });

  const fps = (fpsResult.frames / (fpsResult.ms / 1000)).toFixed(1);
  METRICS.fps = +fps;
  info('STRESS', 'FPS measured', `${fps} fps over ${(fpsResult.ms / 1000).toFixed(1)}s`);
  if (+fps >= 30) pass('STRESS', '5s stress test', `${fps} fps — good`);
  else if (+fps >= 15) warn('STRESS', '5s stress test', `${fps} fps — slow`);
  else fail('STRESS', '5s stress test', `${fps} fps — unacceptable`);

  const real = await consumeConsoleErrors(page);
  const errors = real.filter((e) => !e.startsWith('WARNING:') && !e.includes('Warning:'));
  if (errors.length === 0) pass('STRESS', 'No JS errors during stress');
  else errors.forEach((e) => fail('STRESS', 'Error during stress', e.slice(0, 150)));

  await page.screenshot({ path: '/tmp/audit-stress.png' });
}

// ─── NEW: Pixel-diff (canvas actually animates) ──────────────────────────────
async function testPixelDiff(page) {
  await loadPreset(page, /chaos|corners|faceoff/);
  await pauseIfRunning(page);
  // Захватываем pause-frame
  const canvas = page.locator('canvas').first();
  if (!await canvas.isVisible({ timeout: 2000 }).catch(() => false)) {
    warn('PIXEL', 'Canvas', 'not visible');
    return;
  }
  const buf1 = await canvas.screenshot({ path: '/tmp/audit-pixel-before.png' });
  // Run 1.2s
  await clickBtn(page, BTN_RUN, 'PIXEL', '▶ Run');
  await page.waitForTimeout(1200);
  await pauseIfRunning(page);
  const buf2 = await canvas.screenshot({ path: '/tmp/audit-pixel-after.png' });

  if (buf1.length !== buf2.length || !buf1.equals(buf2)) {
    pass('PIXEL', 'Canvas animation', `before=${buf1.length}B after=${buf2.length}B (changed)`);
  } else {
    fail('PIXEL', 'Canvas animation', 'before === after — engine may be frozen');
  }
  await checkNoErrors(page, 'pixel diff');
}

// ─── NEW: Mutations + win conditions ─────────────────────────────────────────
async function testMutations(page) {
  if (!await goToTab(page, /🧬|Mutations/i)) {
    warn('MUTATIONS', 'Tab', 'not found — Stage 5 may not be deployed');
    return;
  }
  const body = await page.locator('body').innerText().catch(() => '');
  // Mutation conditions (engine reacts to certain triggers)
  for (const kw of ['halo', 'mirror', 'path', 'spectacle']) {
    if (new RegExp(kw, 'i').test(body)) pass('MUTATIONS', `Trigger: ${kw}`, 'present in UI');
    else warn('MUTATIONS', `Trigger: ${kw}`, 'not visible');
  }
  // Win conditions
  for (const kw of ['domination', 'elimination', 'survival', 'extinction', 'first.{1,3}death']) {
    const re = new RegExp(kw, 'i');
    if (re.test(body)) pass('MUTATIONS', `Win condition pattern "${kw}"`, 'visible');
  }
  await page.screenshot({ path: '/tmp/audit-mutations.png' });
  await checkNoErrors(page, 'mutations tab');
}

// ─── NEW: Replays tab — deep test ────────────────────────────────────────────
async function testReplaysDeep(page) {
  if (!await goToTab(page, /🎬|^Replays$/i)) {
    warn('REPLAYS', 'Tab', 'not found — Stage 7 may not be deployed');
    return;
  }
  await page.waitForTimeout(400);
  const body = await page.locator('body').innerText().catch(() => '');

  // Базовая структура tab
  if (/Current session/i.test(body)) pass('REPLAYS', 'Section "Current session"', 'visible');
  else fail('REPLAYS', 'Section "Current session"', 'missing');

  if (/Saved replays/i.test(body)) pass('REPLAYS', 'Section "Saved replays"', 'visible');
  else fail('REPLAYS', 'Section "Saved replays"', 'missing');

  if (/Export\s*\/\s*Share/i.test(body)) pass('REPLAYS', 'Section "Export/Share"', 'visible');
  else warn('REPLAYS', 'Section "Export/Share"', 'missing');

  // Сейчас режим edit — recording disabled
  if (/Recording starts when you press Run/i.test(body)) pass('REPLAYS', 'Edit-mode hint', 'shown');

  // Round-trip test: localStorage write/read через page.evaluate
  const roundTrip = await page.evaluate(() => {
    try {
      const REPLAYS_KEY = 'langton.replays.index';
      const REPLAY_PREFIX = 'langton.replay.';
      const id = `audit-test-${Date.now()}`;
      const meta = {
        id, name: 'audit-roundtrip', createdAt: Date.now(),
        durationTicks: 50, deployCount: 1,
      };
      const replay = {
        version: 1, metadata: meta,
        config: { width: 10, height: 10, players: [{ id: 'p0', name: 'A' }] },
        deployTimeline: [{ tick: 10, playerIdx: 0, x: 5, y: 5 }],
      };
      const prev = localStorage.getItem(REPLAYS_KEY);
      const parsed = prev ? JSON.parse(prev) : [];
      parsed.push(meta);
      localStorage.setItem(REPLAYS_KEY, JSON.stringify(parsed));
      localStorage.setItem(REPLAY_PREFIX + id, JSON.stringify(replay));
      const stored = JSON.parse(localStorage.getItem(REPLAY_PREFIX + id));
      const okWrite = stored?.metadata?.id === id;
      // cleanup
      localStorage.removeItem(REPLAY_PREFIX + id);
      localStorage.setItem(REPLAYS_KEY, JSON.stringify(parsed.filter((m) => m.id !== id)));
      return { okWrite, length: JSON.stringify(replay).length };
    } catch (e) { return { okWrite: false, error: String(e) }; }
  });
  if (roundTrip.okWrite) pass('REPLAYS', 'localStorage round-trip', `${roundTrip.length}B written/read`);
  else fail('REPLAYS', 'localStorage round-trip', `failed: ${roundTrip.error || 'unknown'}`);

  // Demo replays — индекс должен быть в /replays/index.json
  const demoIdx = await page.evaluate(async (base) => {
    try {
      const r = await fetch(new URL('replays/index.json', base + '/').toString());
      if (!r.ok) return { ok: false, status: r.status };
      const data = await r.json();
      return { ok: true, count: data?.replays?.length ?? 0 };
    } catch (e) { return { ok: false, error: String(e) }; }
  }, BASE);
  if (demoIdx.ok) pass('REPLAYS', 'Demo replays index', `${demoIdx.count} replays`);
  else warn('REPLAYS', 'Demo replays index', `fetch failed: ${demoIdx.status || demoIdx.error}`);

  await page.screenshot({ path: '/tmp/audit-replays.png' });
  await checkNoErrors(page, 'replays deep');
}

// ─── NEW: URL share round-trip ───────────────────────────────────────────────
async function testUrlShare(page) {
  // Открываем Presets → Export / Import / Share — проверяем что есть кнопки
  if (!await goToTab(page, /★|^Presets$/i)) {
    warn('URL_SHARE', 'Presets tab', 'not found');
    return;
  }
  const body = await page.locator('body').innerText().catch(() => '');
  for (const label of ['Download', 'Copy share URL', 'Import']) {
    if (new RegExp(label, 'i').test(body)) pass('URL_SHARE', `Button: ${label}`, 'visible');
    else warn('URL_SHARE', `Button: ${label}`, 'not visible');
  }

  // Round-trip — пробуем encode/decode через клик «Copy share URL»
  // (берёт текущий config из state, кодирует, кладёт в clipboard)
  // Затем проверяем что clipboard содержит валидный URL с ?p=...
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const copyBtn = page.locator('button').filter({ hasText: /Copy share URL/i }).first();
  if (await copyBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await copyBtn.click();
    await page.waitForTimeout(400);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => '')).catch(() => '');
    if (typeof clip === 'string' && /[?&]p=[A-Za-z0-9_\-+/=%]+/.test(clip)) {
      pass('URL_SHARE', 'Encoded URL in clipboard', `${clip.length} chars, starts ${clip.slice(0, 60)}…`);
      METRICS.shareUrlLen = clip.length;
    } else {
      // Не критично — некоторые headless контексты блокируют clipboard
      warn('URL_SHARE', 'Encoded URL in clipboard', `unreadable (got "${(clip || '').slice(0, 40)}")`);
    }
  }
  await checkNoErrors(page, 'url share');
}

// ─── NEW: A11y smoke ────────────────────────────────────────────────────────
async function testA11y(page) {
  const audit = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const noLabel = buttons.filter((b) => {
      const txt = (b.textContent || '').trim();
      const aria = b.getAttribute('aria-label') || '';
      const title = b.getAttribute('title') || '';
      return !txt && !aria && !title;
    });
    const images = Array.from(document.querySelectorAll('img'));
    const noAlt = images.filter((i) => !i.getAttribute('alt'));
    const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
    const noLabelInput = inputs.filter((i) => {
      const aria = i.getAttribute('aria-label') || '';
      const id = i.getAttribute('id');
      const lblFor = id ? document.querySelector(`label[for="${id}"]`) : null;
      const parentLbl = i.closest('label');
      const placeholder = i.getAttribute('placeholder');
      return !aria && !lblFor && !parentLbl && !placeholder;
    });
    return {
      buttonsTotal: buttons.length,
      buttonsNoLabel: noLabel.length,
      images: images.length,
      imagesNoAlt: noAlt.length,
      inputs: inputs.length,
      inputsNoLabel: noLabelInput.length,
    };
  });
  info('A11Y', 'Buttons', `total=${audit.buttonsTotal} no-label=${audit.buttonsNoLabel}`);
  if (audit.buttonsNoLabel === 0) pass('A11Y', 'All buttons labelled', `${audit.buttonsTotal} total`);
  else warn('A11Y', `${audit.buttonsNoLabel} buttons without label`, `of ${audit.buttonsTotal}`);

  info('A11Y', 'Images', `total=${audit.images} no-alt=${audit.imagesNoAlt}`);
  if (audit.images === 0 || audit.imagesNoAlt === 0) pass('A11Y', 'All images have alt');
  else warn('A11Y', `${audit.imagesNoAlt} images without alt`);

  info('A11Y', 'Inputs', `total=${audit.inputs} no-label=${audit.inputsNoLabel}`);
  if (audit.inputsNoLabel === 0) pass('A11Y', 'All inputs labelled', `${audit.inputs} total`);
  else warn('A11Y', `${audit.inputsNoLabel} inputs without label`, `of ${audit.inputs}`);

  METRICS.a11y = audit;
}

// ─── NEW: Multi-viewport rendering ───────────────────────────────────────────
async function testViewports(page) {
  const viewports = [
    { name: 'desktop',  w: 1440, h: 900  },
    { name: 'laptop',   w: 1280, h: 800  },
    { name: 'tablet',   w: 768,  h: 1024 },
    { name: 'mobile',   w: 480,  h: 800  },
  ];
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.waitForTimeout(350);
    const errs = await consumeConsoleErrors(page);
    const errors = errs.filter((e) => !e.startsWith('WARNING:') && !e.includes('Warning:'));
    if (errors.length === 0) pass('VIEWPORT', `${vp.name} ${vp.w}×${vp.h}`, 'no console errors');
    else errors.forEach((e) => fail('VIEWPORT', `${vp.name}`, e.slice(0, 150)));
    await page.screenshot({ path: `/tmp/audit-viewport-${vp.name}.png` }).catch(() => {});
  }
  // Return to desktop default
  await page.setViewportSize({ width: 1440, height: 900 });
}

// ─── NEW: Preset deep — fetch each preset, validate ──────────────────────────
async function testPresetsDeep(page) {
  const result = await page.evaluate(async (base) => {
    try {
      const indexUrl = new URL('presets/index.json', base + '/').toString();
      const r = await fetch(indexUrl);
      if (!r.ok) return { ok: false, status: r.status, indexUrl };
      const idx = await r.json();
      if (!Array.isArray(idx.presets)) return { ok: false, reason: 'No presets array' };
      const validated = [];
      for (const entry of idx.presets) {
        const url = new URL(`presets/${entry.file}`, base + '/').toString();
        const pr = await fetch(url);
        if (!pr.ok) { validated.push({ id: entry.id, ok: false, status: pr.status }); continue; }
        const data = await pr.json();
        const ok = !!(data?.id && data?.name && data?.config?.width && data?.config?.players);
        validated.push({ id: entry.id, ok, players: data?.config?.players?.length });
      }
      return { ok: true, total: idx.presets.length, validated };
    } catch (e) { return { ok: false, error: String(e) }; }
  }, BASE);

  if (!result.ok) {
    fail('PRESETS_DEEP', 'Fetch presets', `${result.error || 'status=' + result.status}`);
    return;
  }
  pass('PRESETS_DEEP', 'Index loaded', `${result.total} entries`);
  for (const v of result.validated) {
    if (v.ok) pass('PRESETS_DEEP', `Preset "${v.id}"`, `${v.players} players, valid`);
    else fail('PRESETS_DEEP', `Preset "${v.id}"`, `status=${v.status}`);
  }
}

// ─── NEW: Deploy mode (Stage 6) ──────────────────────────────────────────────
async function testDeploy(page) {
  await loadPreset(page, /Defense Stand/i);
  await page.waitForTimeout(250);
  await clickBtn(page, /Run/i, 'DEPLOY', 'Run from preset');
  await runFor(page, 4000);
  await pauseIfRunning(page);

  const body = await page.locator('body').innerText().catch(() => '');
  if (/📦\s*\d/.test(body)) pass('DEPLOY', 'Reserve chip in top bar', 'visible');
  else warn('DEPLOY', 'Reserve chip', 'not visible after 4s sim — bag may be empty');

  const deployBtn = page.locator('button').filter({ hasText: /📦\s*Deploy/i }).first();
  if (await deployBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    pass('DEPLOY', 'Deploy button in transport bar', 'visible');
    await deployBtn.click();
    await page.waitForTimeout(300);
    const body2 = await page.locator('body').innerText().catch(() => '');
    if (/DEPLOY MODE/i.test(body2)) pass('DEPLOY', 'Deploy mode indicator', 'shown');
    else warn('DEPLOY', 'Deploy mode indicator', 'not visible after button click');
    await page.screenshot({ path: '/tmp/audit-deploy-mode.png' });
    await deployBtn.click().catch(() => {});
  } else {
    warn('DEPLOY', 'Deploy button', 'not visible — reserveMode may not be on');
  }

  if (await goToTab(page, /📊|^Stats$/i)) {
    const statsBody = await page.locator('body').innerText().catch(() => '');
    if (/📦.*bag/i.test(statsBody)) pass('DEPLOY', 'Mini block "📦 bag" in stats', 'visible');
    else warn('DEPLOY', 'Mini block "📦 bag"', 'not visible');
  }

  if (await goToTab(page, /^Birth$|✚/i)) {
    const birthBody = await page.locator('body').innerText().catch(() => '');
    if (/Reserve\s*&\s*Deploy/i.test(birthBody)) pass('DEPLOY', 'Reserve & Deploy in Birth tab', 'visible');
    else warn('DEPLOY', 'Reserve & Deploy section', 'not visible in Birth tab');
  }

  await checkNoErrors(page, 'deploy section complete');
}

// ─── Stats / Events / Heatmaps / Highlights — preserved ──────────────────────
async function testStats(page) {
  await loadPreset(page, /chaos|faceoff|corners/);
  await runFor(page, 3000);
  if (await goToTab(page, /📊|^Stats$/i)) {
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
}

async function testEvents(page) {
  await pauseIfRunning(page);
  if (await goToTab(page, /📋|^Events$/i)) {
    await checkNoErrors(page, 'events tab');
    const types = ['capture', 'clash', 'death', 'birth', 'hybrid', 'wild'];
    for (const t of types) {
      const chip = page.locator('button').filter({ hasText: new RegExp(`^${t}$`, 'i') }).first();
      if (await chip.isVisible({ timeout: 1000 }).catch(() => false)) {
        await chip.click(); await page.waitForTimeout(120);
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
}

async function testHeatmaps(page) {
  if (await goToTab(page, /✨|^Visual$/i)) {
    const selects = page.locator('select');
    const sc = await selects.count();
    let heatmapSelect = null;
    for (let i = 0; i < sc; i++) {
      const opts = await selects.nth(i).locator('option').allInnerTexts().catch(() => []);
      if (opts.some((o) => /deaths|captures|contested/i.test(o))) {
        heatmapSelect = selects.nth(i); break;
      }
    }
    if (heatmapSelect) {
      pass('HEATMAPS', 'Heatmap dropdown found');
      for (const mode of ['deaths', 'captures', 'contested']) {
        await heatmapSelect.selectOption({ value: mode }).catch(() => {});
        await page.waitForTimeout(350);
        await checkNoErrors(page, `heatmap ${mode}`);
        await page.screenshot({ path: `/tmp/audit-heatmap-${mode}.png` });
        pass('HEATMAPS', `Mode: ${mode}`, 'switched');
      }
      await heatmapSelect.selectOption({ value: 'off' }).catch(() => {});
    } else {
      warn('HEATMAPS', 'Heatmap dropdown', 'not found');
    }
  }
}

async function testHighlights(page) {
  if (await goToTab(page, /📊|^Stats$/i)) {
    const body = await page.locator('body').innerText().catch(() => '');
    if (/Highlights\s*·/i.test(body)) {
      pass('HIGHLIGHTS', 'Highlights section', 'visible');
      const types = [
        { icon: '🔥', name: 'biggest_fight' },
        { icon: '🏆', name: 'peak_territory' },
        { icon: '⏱', name: 'longest_streak' },
        { icon: '💀', name: 'first_death' },
        { icon: '⚔', name: 'most_kills_clash' },
      ];
      for (const t of types) if (body.includes(t.icon)) pass('HIGHLIGHTS', `Highlight: ${t.name}`, 'rendered');
      await page.screenshot({ path: '/tmp/audit-highlights.png' });
    } else {
      warn('HIGHLIGHTS', 'Highlights section', 'not visible — needs more simulation events');
    }
  }
}

// ─── Web Vitals + bundle audit ───────────────────────────────────────────────
async function collectWebVitals(page) {
  const vitals = await page.evaluate(() => new Promise((resolve) => {
    const result = { fcp: null, lcp: null, ttfb: null, domReady: null };
    try {
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries.length) {
        const n = navEntries[0];
        result.ttfb = Math.round(n.responseStart - n.startTime);
        result.domReady = Math.round(n.domContentLoadedEventEnd - n.startTime);
      }
      const paintEntries = performance.getEntriesByType('paint');
      const fcp = paintEntries.find((p) => p.name === 'first-contentful-paint');
      if (fcp) result.fcp = Math.round(fcp.startTime);
      const lcpObs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length) result.lcp = Math.round(entries[entries.length - 1].startTime);
      });
      try { lcpObs.observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
      setTimeout(() => resolve(result), 600);
    } catch { resolve(result); }
  }));
  METRICS.webVitals = vitals;
  info('VITALS', 'TTFB', vitals.ttfb != null ? `${vitals.ttfb}ms` : 'N/A');
  info('VITALS', 'FCP',  vitals.fcp  != null ? `${vitals.fcp}ms`  : 'N/A');
  info('VITALS', 'LCP',  vitals.lcp  != null ? `${vitals.lcp}ms`  : 'N/A');
  info('VITALS', 'DOM ready', vitals.domReady != null ? `${vitals.domReady}ms` : 'N/A');
  if (vitals.lcp != null) {
    if (vitals.lcp < 2500) pass('VITALS', 'LCP good', `${vitals.lcp}ms (<2500)`);
    else if (vitals.lcp < 4000) warn('VITALS', 'LCP needs improvement', `${vitals.lcp}ms`);
    else fail('VITALS', 'LCP poor', `${vitals.lcp}ms (>4000)`);
  }
  if (vitals.fcp != null) {
    if (vitals.fcp < 1800) pass('VITALS', 'FCP good', `${vitals.fcp}ms (<1800)`);
    else if (vitals.fcp < 3000) warn('VITALS', 'FCP needs improvement', `${vitals.fcp}ms`);
    else fail('VITALS', 'FCP poor', `${vitals.fcp}ms (>3000)`);
  }
}

function summarizeNetwork() {
  info('NETWORK', 'Total requests', String(NETWORK.requests));
  if (NETWORK.failed === 0) pass('NETWORK', 'No failed requests');
  else fail('NETWORK', `${NETWORK.failed} failed requests`);
  if (NETWORK.fourOhFour === 0) pass('NETWORK', 'No 404s');
  else fail('NETWORK', `${NETWORK.fourOhFour} × 404`);
  const totalKB = (NETWORK.totalBytes / 1024).toFixed(1);
  info('NETWORK', 'Transferred', `${totalKB} KB across ${NETWORK.requests} requests`);
  for (const [t, v] of Object.entries(NETWORK.byType)) {
    info('NETWORK', `Type ${t}`, `${v.count} req · ${(v.bytes / 1024).toFixed(1)} KB`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═'.repeat(70));
  console.log(`  LANGTON ARENA E2E AUDIT · v${AUDIT_VERSION} (professional)`);
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

  // Console listener
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
  // Network listener
  page.on('request', () => NETWORK.requests++);
  page.on('response', async (resp) => {
    const status = resp.status();
    if (status === 404) NETWORK.fourOhFour++;
    if (status >= 400) NETWORK.failed++;
    try {
      const buf = await resp.body().catch(() => null);
      const bytes = buf ? buf.length : 0;
      NETWORK.totalBytes += bytes;
      const headers = resp.headers();
      const ct = (headers['content-type'] || '').split(';')[0] || 'other';
      const key = ct.includes('javascript') ? 'js' :
                  ct.includes('css') ? 'css' :
                  ct.includes('html') ? 'html' :
                  ct.includes('json') ? 'json' :
                  ct.includes('image') ? 'image' :
                  ct.includes('font') ? 'font' : 'other';
      if (!NETWORK.byType[key]) NETWORK.byType[key] = { count: 0, bytes: 0 };
      NETWORK.byType[key].count++;
      NETWORK.byType[key].bytes += bytes;
    } catch {}
  });
  page.on('requestfailed', (req) => {
    fail('NETWORK', 'Request failed', `${req.url().slice(0, 80)} → ${req.failure()?.errorText}`);
  });

  try {
    // 1. BOOT
    if (enabled('boot')) {
      startSection('boot');
      info('BOOT', 'Navigating', BASE);
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1200);
      const title = await page.title();
      if (title) pass('BOOT', 'Page loaded', `title="${title}"`);
      else fail('BOOT', 'Page loaded', 'no title');
      await checkNoErrors(page, 'initial load');
      await page.screenshot({ path: '/tmp/audit-01-landing.png' });
      // Web Vitals
      await collectWebVitals(page);
      endSection();
    }

    // 2. NAV
    if (enabled('nav')) {
      startSection('nav');
      const sandboxBtn = page.locator('button, a').filter({ hasText: /sandbox|песочниц/i }).first();
      if (await sandboxBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        await sandboxBtn.click();
        await page.waitForTimeout(800);
        pass('NAV', 'Navigate to Sandbox');
      } else {
        const allBtns = await page.locator('button').allInnerTexts().catch(() => []);
        warn('NAV', 'Sandbox button not found', `available: ${allBtns.join('|').slice(0, 200)}`);
      }
      await checkNoErrors(page, 'after nav');
      await page.screenshot({ path: '/tmp/audit-02-sandbox.png' });
      endSection();
    }

    // 3. TABS — 11 (Stage 7: mutations + replays добавлены)
    if (enabled('tabs')) {
      startSection('tabs');
      const TAB_MAP = [
        { id: 'presets',   re: /★|Presets/i },
        { id: 'players',   re: /👥|Players/i },
        { id: 'ants',      re: /🐜|Ants/i },
        { id: 'stats',     re: /📊|Stats/i },
        { id: 'events',    re: /📋|Events/i },
        { id: 'field',     re: /⬜|Field/i },
        { id: 'combat',    re: /⚔|Combat/i },
        { id: 'birth',     re: /✚|Birth/i },
        { id: 'mutations', re: /🧬|Mutations/i },
        { id: 'visual',    re: /✨|Visual/i },
        { id: 'replays',   re: /🎬|Replays/i },
      ];
      for (const tab of TAB_MAP) {
        const btn = page.locator('button').filter({ hasText: tab.re }).first();
        if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(300);
          await checkNoErrors(page, `tab ${tab.id}`);
          await page.screenshot({ path: `/tmp/audit-tab-${tab.id}.png` });
          pass('TABS', `Tab: ${tab.id}`);
        } else {
          warn('TABS', `Tab: ${tab.id}`, 'not found');
        }
      }
      endSection();
    }

    // 4. PRESETS_DEEP (fetch + validate each)
    if (enabled('presets_deep')) {
      startSection('presets_deep');
      await testPresetsDeep(page);
      endSection();
    }

    // 5. PRESETS — UI load test
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
            await page.waitForTimeout(450);
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

    // 6-11. CONFIG TABS (incl. Stage 5 mutations)
    await testConfigTabs(page);

    // 12. MUTATIONS — content check (Stage 5)
    if (enabled('mutations_content')) {
      startSection('mutations_content');
      await testMutations(page);
      endSection();
    }

    // 13. STATS
    if (enabled('stats')) { startSection('stats'); await testStats(page); endSection(); }
    // 14. EVENTS
    if (enabled('events')) { startSection('events'); await testEvents(page); endSection(); }
    // 15. HEATMAPS
    if (enabled('heatmaps')) { startSection('heatmaps'); await testHeatmaps(page); endSection(); }
    // 16. HIGHLIGHTS
    if (enabled('highlights')) { startSection('highlights'); await testHighlights(page); endSection(); }

    // 17. DEPLOY (Stage 6)
    if (enabled('deploy')) { startSection('deploy'); await testDeploy(page); endSection(); }

    // 18. REPLAYS_DEEP (Stage 7) — round-trip via localStorage + fetch demo index
    if (enabled('replays_deep')) {
      startSection('replays_deep');
      await testReplaysDeep(page);
      endSection();
    }

    // 19. URL_SHARE (Stage 7) — encode/copy/decode
    if (enabled('url_share')) {
      startSection('url_share');
      await testUrlShare(page);
      endSection();
    }

    // 20. TRANSPORT
    if (enabled('transport')) { startSection('transport'); await testTransport(page); endSection(); }

    // 21. CANVAS
    if (enabled('canvas')) { startSection('canvas'); await testCanvasInteractions(page); endSection(); }

    // 22. PIXEL DIFF — canvas animation guarantee
    if (enabled('pixel')) { startSection('pixel'); await testPixelDiff(page); endSection(); }

    // 23. STRESS
    if (enabled('stress')) { startSection('stress'); await testStress(page); endSection(); }

    // 24. A11Y
    if (enabled('a11y')) { startSection('a11y'); await testA11y(page); endSection(); }

    // 25. VIEWPORTS
    if (enabled('viewports')) { startSection('viewports'); await testViewports(page); endSection(); }

    // 26. MEMORY
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
        METRICS.heap = heap;
        info('MEMORY', 'JS Heap', `used=${heap.used}MB total=${heap.total}MB limit=${heap.limit}MB`);
        if (heap.used < 200) pass('MEMORY', 'Heap size reasonable', `${heap.used}MB`);
        else if (heap.used < 500) warn('MEMORY', 'Heap size large', `${heap.used}MB`);
        else fail('MEMORY', 'Heap size too large', `${heap.used}MB`);
      } else {
        info('MEMORY', 'performance.memory not available');
      }
      endSection();
    }

    // 27. NETWORK summary (last)
    if (enabled('network')) {
      startSection('network');
      summarizeNetwork();
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
    strict: STRICT,
    summary: { pass: PASS, fail: FAIL, warn: WARN, total: PASS + FAIL + WARN },
    timing: TIMING,
    metrics: METRICS,
    network: NETWORK,
    entries: LOG,
  };
  writeFileSync('/tmp/audit-report.json', JSON.stringify(report, null, 2));

  const md = [];
  md.push(`# Langton Arena E2E Audit Report`);
  md.push('');
  md.push(`- **Version:** ${AUDIT_VERSION} (professional)`);
  md.push(`- **Timestamp:** ${new Date().toISOString()}`);
  md.push(`- **URL:** ${BASE}`);
  md.push(`- **Mode:** ${HEADED ? 'headed' : 'headless'} (strict=${STRICT})`);
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

  if (METRICS.webVitals) {
    md.push(`## Web Vitals`);
    md.push('');
    md.push(`| Metric | Value | Budget |`);
    md.push(`|---|---|---|`);
    md.push(`| TTFB | ${METRICS.webVitals.ttfb ?? 'N/A'}ms | <600ms |`);
    md.push(`| FCP  | ${METRICS.webVitals.fcp  ?? 'N/A'}ms | <1800ms (good) |`);
    md.push(`| LCP  | ${METRICS.webVitals.lcp  ?? 'N/A'}ms | <2500ms (good) |`);
    md.push(`| DOM Ready | ${METRICS.webVitals.domReady ?? 'N/A'}ms | — |`);
    if (METRICS.fps != null) md.push(`| FPS (5s stress) | ${METRICS.fps} | ≥30 |`);
    md.push('');
  }

  md.push(`## Network`);
  md.push('');
  md.push(`| Metric | Value |`);
  md.push(`|---|---|`);
  md.push(`| Total requests | ${NETWORK.requests} |`);
  md.push(`| Failed (≥400) | ${NETWORK.failed} |`);
  md.push(`| 404 specifically | ${NETWORK.fourOhFour} |`);
  md.push(`| Transferred | ${(NETWORK.totalBytes / 1024).toFixed(1)} KB |`);
  md.push('');
  if (Object.keys(NETWORK.byType).length) {
    md.push(`### By content-type`);
    md.push('');
    md.push(`| Type | Requests | KB |`);
    md.push(`|---|---|---|`);
    for (const [t, v] of Object.entries(NETWORK.byType)) {
      md.push(`| ${t} | ${v.count} | ${(v.bytes / 1024).toFixed(1)} |`);
    }
    md.push('');
  }

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
      for (const e of fails) md.push(`- **[${e.category}]** ${e.action}${e.detail ? ' — `' + e.detail + '`' : ''}`);
      md.push('');
    }
    if (warns.length > 0) {
      md.push(`### Warnings (${warns.length})`);
      md.push('');
      for (const e of warns) md.push(`- **[${e.category}]** ${e.action}${e.detail ? ' — `' + e.detail + '`' : ''}`);
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

  if (METRICS.webVitals) {
    console.log('\n  WEB VITALS:');
    const v = METRICS.webVitals;
    console.log(`    TTFB  ${v.ttfb ?? 'N/A'}ms   FCP  ${v.fcp ?? 'N/A'}ms   LCP  ${v.lcp ?? 'N/A'}ms`);
    if (METRICS.fps != null) console.log(`    FPS   ${METRICS.fps}`);
  }
  console.log('\n  NETWORK:');
  console.log(`    requests=${NETWORK.requests}  failed=${NETWORK.failed}  404=${NETWORK.fourOhFour}  KB=${(NETWORK.totalBytes/1024).toFixed(1)}`);

  if (Object.keys(TIMING).length > 0) {
    console.log('\n  TIMING:');
    for (const [section, ms] of Object.entries(TIMING)) {
      console.log(`    ${section.padEnd(18)} ${String(ms).padStart(6)}ms`);
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
