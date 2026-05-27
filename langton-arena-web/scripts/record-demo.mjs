/**
 * scripts/record-demo.mjs — записывает демо-видео гейплея для README/social.
 *
 * Pipeline:
 *   Playwright → .webm (native recording)
 *   ffmpeg     → .gif + .mp4 (для README на GitHub)
 *
 * Usage:
 *   node scripts/record-demo.mjs                       # дефолты (см. ниже)
 *   DEMO_PRESET="Star Burst" node scripts/record-demo.mjs
 *   DEMO_DURATION=20000 node scripts/record-demo.mjs   # 20 сек
 *   DEMO_BASE=http://localhost:5173 node scripts/record-demo.mjs
 *   DEMO_SPEED=8 node scripts/record-demo.mjs          # ×8 vs default ×4
 *   DEMO_WIDTH=960 DEMO_HEIGHT=540 node ...            # smaller frame
 *   DEMO_HEADED=1 ...                                  # см. в реальном времени
 *
 * Output:
 *   /tmp/demo/<timestamp>/demo.webm   ← Playwright native
 *   docs/demo.gif                      ← README hero (если ffmpeg найден)
 *   docs/demo.mp4                      ← compact MP4 (если ffmpeg найден)
 *
 * Default preset: "Star Burst · 8" (8 цветов, radial симметрия — самый кинематографичный).
 *
 * NOTE: Playwright video chunks browser в headless mode при maximize. Если кадры
 * "лагают" — используйте headed mode (DEMO_HEADED=1) на физическом мониторе.
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '..');

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE       = process.env.DEMO_BASE || 'https://alshfu.github.io/Langton_Ants_PVP';
const PRESET     = process.env.DEMO_PRESET || 'Chaos Eight';
const DURATION   = parseInt(process.env.DEMO_DURATION || '15000', 10);
const SPEED      = parseInt(process.env.DEMO_SPEED || '4', 10);
const VP_W       = parseInt(process.env.DEMO_WIDTH  || '1280', 10);
const VP_H       = parseInt(process.env.DEMO_HEIGHT || '720', 10);
const HEADED     = process.env.DEMO_HEADED === '1';
const OUT_VID    = path.join('/tmp', 'demo', String(Date.now()));
const OUT_DOCS   = path.join(REPO_ROOT, 'docs');

mkdirSync(OUT_VID, { recursive: true });
mkdirSync(OUT_DOCS, { recursive: true });

// ─── Helpers ─────────────────────────────────────────────────────────────────
function log(msg) { console.log(`[demo] ${msg}`); }

function findFfmpeg() {
  const r = spawnSync('which', ['ffmpeg']);
  if (r.status === 0) return r.stdout.toString().trim();
  return null;
}

function newestWebm(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.webm'));
  if (files.length === 0) return null;
  return files
    .map((f) => ({ f, t: statSync(path.join(dir, f)).mtime.getTime() }))
    .sort((a, b) => b.t - a.t)[0].f;
}

// ─── Main ────────────────────────────────────────────────────────────────────
// Tracks when "▶ Run" was clicked relative to recording start — used to skip
// boring setup phase when converting to GIF.
let recordingStart = 0;
let runClickedAtVideoSec = 0;

async function main() {
  log(`Base: ${BASE}`);
  log(`Preset: "${PRESET}" · ${DURATION}ms × speed=${SPEED} · ${VP_W}×${VP_H} · headed=${HEADED}`);
  log(`Output dir: ${OUT_VID}`);

  // Headless Chrome тротлит requestAnimationFrame когда страница "невидима".
  // Без этих флагов engine стоит — записываем только тик 0.
  const browser = await chromium.launch({
    headless: !HEADED,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-features=CalculateNativeWinOcclusion',
    ],
  });
  const ctx = await browser.newContext({
    viewport: { width: VP_W, height: VP_H },
    recordVideo: { dir: OUT_VID, size: { width: VP_W, height: VP_H } },
  });
  recordingStart = Date.now();
  const page = await ctx.newPage();

  try {
    // 1. Load
    log('Loading page…');
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // 2. Click Sandbox
    log('Navigating to Sandbox…');
    const sandboxBtn = page.locator('button, a').filter({ hasText: /sandbox/i }).first();
    await sandboxBtn.click();
    await page.waitForTimeout(800);

    // 3. Click Presets tab
    log('Opening Presets tab…');
    await page.locator('button').filter({ hasText: /★|Presets/i }).first().click();
    await page.waitForTimeout(500);

    // 4. Click chosen preset card. Иногда нужен scroll внутри tab content
    // (например Star Burst — последний из 26).
    log(`Loading preset "${PRESET}"…`);
    const card = page.locator('div[style*="cursor: pointer"]').filter({ hasText: new RegExp(PRESET, 'i') }).first();
    if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
      await card.scrollIntoViewIfNeeded();
      await card.click();
      await page.waitForTimeout(600);
    } else {
      log(`! Preset "${PRESET}" not visible — пытаюсь scroll вниз и снова найти`);
      // Scroll tab content
      const tabPane = page.locator('div').filter({ hasText: /Built-in|Save current/i }).last();
      await tabPane.evaluate((el) => { el.scrollTop = 10000; }).catch(() => {});
      await page.waitForTimeout(400);
      if (await card.isVisible({ timeout: 1500 }).catch(() => false)) {
        await card.click();
        await page.waitForTimeout(600);
      } else {
        log(`! Не нашёл "${PRESET}" — fallback на первый preset`);
        await page.locator('div[style*="cursor: pointer"]').first().click();
        await page.waitForTimeout(600);
      }
    }

    // 5. Click ▶ Run — в edit/run toggle (top bar, не в transport bar)
    log('Pressing ▶ Run…');
    // Top bar Edit/Run toggle — оба кнопки в одном div. Берём вторую (Run).
    // Чтобы избежать конфликта с transport bar — фильтруем по точному тексту.
    const runBtn = page.locator('button:text-is("▶ Run")').first();
    if (await runBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await runBtn.click();
    } else {
      // Fallback: regex
      await page.locator('button').filter({ hasText: /▶\s*Run/ }).first().click();
    }
    runClickedAtVideoSec = (Date.now() - recordingStart) / 1000;
    log(`Run clicked at video offset: ${runClickedAtVideoSec.toFixed(2)}s`);
    await page.waitForTimeout(500);

    // 6. Verify sim actually ticking via page.evaluate
    const t1 = await page.evaluate(() => {
      const text = document.body.innerText;
      const m = text.match(/tick\s+(\d+)/i);
      return m ? parseInt(m[1], 10) : -1;
    });
    await page.waitForTimeout(1000);
    const t2 = await page.evaluate(() => {
      const text = document.body.innerText;
      const m = text.match(/tick\s+(\d+)/i);
      return m ? parseInt(m[1], 10) : -1;
    });
    log(`Tick after Run: ${t1}, after 1s: ${t2} (Δ=${t2 - t1})`);
    if (t2 - t1 < 1) {
      log('! Engine не тикает. Headless throttling? Попробуйте DEMO_HEADED=1.');
    }

    // 7. Set speed multiplier (×N button in transport bar — обычно в нижней панели)
    log(`Setting speed ×${SPEED}…`);
    const speedBtn = page.locator('button').filter({ hasText: new RegExp(`^${SPEED}$`) }).first();
    if (await speedBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await speedBtn.click();
    }

    // 8. Record gameplay
    log(`Recording ${DURATION}ms of gameplay…`);
    await page.waitForTimeout(DURATION);
    log('Done. Closing browser to flush video…');
  } finally {
    await ctx.close();           // ← flush video to disk
    await browser.close();
  }

  // ─── Find recorded video ───────────────────────────────────────────────────
  const webm = newestWebm(OUT_VID);
  if (!webm) {
    log('FATAL: no .webm found in output dir');
    process.exit(2);
  }
  const webmPath = path.join(OUT_VID, webm);
  log(`✓ Recorded: ${webmPath}`);
  copyFileSync(webmPath, path.join(OUT_DOCS, 'demo.webm'));
  log(`✓ Copied to ${path.join(OUT_DOCS, 'demo.webm')}`);

  // ─── Convert to GIF + MP4 via ffmpeg if available ─────────────────────────
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    log('! ffmpeg not found — skipping GIF/MP4 conversion.');
    log('  Install: brew install ffmpeg (macOS) или apt install ffmpeg (Linux)');
    log('  Then manually convert:');
    log(`    ffmpeg -i ${webmPath} -vf "fps=15,scale=800:-1:flags=lanczos" -loop 0 docs/demo.gif`);
    log(`    ffmpeg -i ${webmPath} -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p docs/demo.mp4`);
    process.exit(0);
  }

  const gifPath = path.join(OUT_DOCS, 'demo.gif');
  const mp4Path = path.join(OUT_DOCS, 'demo.mp4');

  // Skip setup phase: start GIF from "Run clicked" timestamp + small buffer
  // (даём UI 0.8s чтобы applied state стал visually clear)
  const startOffset = Math.max(0, runClickedAtVideoSec + 0.8).toFixed(2);
  log(`Converting → GIF (600px wide, 12fps, skip first ${startOffset}s setup)…`);
  const gifRes = spawnSync(ffmpeg, [
    '-y',
    '-ss', startOffset,           // skip setup phase
    '-i', webmPath,
    '-vf', 'fps=12,scale=600:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5',
    '-loop', '0',
    gifPath,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (gifRes.status === 0) {
    const size = statSync(gifPath).size;
    log(`✓ GIF: ${gifPath} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  } else {
    log('! GIF conversion failed');
  }

  log('Converting → MP4 (compact h264, skipping setup)…');
  const mp4Res = spawnSync(ffmpeg, [
    '-y',
    '-ss', startOffset,
    '-i', webmPath,
    '-c:v', 'libx264', '-crf', '23', '-preset', 'slow',
    '-pix_fmt', 'yuv420p',  // обязательно для GitHub preview
    '-movflags', '+faststart',
    mp4Path,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (mp4Res.status === 0) {
    const size = statSync(mp4Path).size;
    log(`✓ MP4: ${mp4Path} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  } else {
    log('! MP4 conversion failed');
  }

  log('');
  log('═══════════════════════════════════════════');
  log('Demo media ready:');
  log(`  ${path.join(OUT_DOCS, 'demo.webm')}  (source, lossless)`);
  if (existsSync(gifPath)) log(`  ${gifPath}  (README hero, GIF)`);
  if (existsSync(mp4Path)) log(`  ${mp4Path}  (compact MP4 for social)`);
  log('');
  log('Add to README:');
  log('  <p align="center"><img src="docs/demo.gif" alt="Langton Arena demo" width="800"></p>');
  log('═══════════════════════════════════════════');
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
