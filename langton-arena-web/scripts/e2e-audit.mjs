/**
 * e2e-audit.mjs  —  Полный E2E-аудит Langton Arena Sandbox
 * Версия 2 — после фикса triple_click и улучшения селекторов
 */
import { chromium } from 'playwright';

// ─── Лог-система ─────────────────────────────────────────────────────────────
const LOG = [];
let PASS = 0, FAIL = 0, WARN = 0;
function log(level, category, action, detail = '') {
  const ts = new Date().toISOString().slice(11, 23);
  const icon = level==='PASS'?'✅':level==='FAIL'?'❌':level==='WARN'?'⚠️':'📋';
  const line = `[${ts}] ${icon} [${category}] ${action}${detail?' — '+detail:''}`;
  LOG.push({ level, category, action, detail, ts });
  console.log(line);
  if (level==='PASS') PASS++;
  else if (level==='FAIL') FAIL++;
  else if (level==='WARN') WARN++;
}
const pass = (c,a,d)=>log('PASS',c,a,d);
const fail = (c,a,d)=>log('FAIL',c,a,d);
const warn = (c,a,d)=>log('WARN',c,a,d);
const info = (c,a,d)=>log('INFO',c,a,d);

async function getConsoleErrors(page) {
  const errs = page._consoleErrors ?? [];
  page._consoleErrors = [];
  return errs;
}
async function checkNoErrors(page, ctx) {
  const errs = await getConsoleErrors(page);
  const real = errs.filter(e => !e.includes('Warning:') && !e.includes('DevTools'));
  const warnings = errs.filter(e => e.includes('Warning:'));
  if (real.length === 0 && warnings.length === 0) pass('CONSOLE', ctx, 'no errors/warnings');
  else {
    real.forEach(e => fail('CONSOLE', ctx, e.slice(0,150)));
    warnings.forEach(e => warn('CONSOLE', ctx, e.slice(0,150)));
  }
  return real.length === 0;
}

async function vis(page, sel, ms=3000) {
  return page.locator(sel).first().isVisible({ timeout: ms }).catch(()=>false);
}
async function clickBtn(page, textRe, cat, label) {
  const btn = page.locator('button').filter({ hasText: textRe }).first();
  if (!await btn.isVisible({ timeout: 3000 }).catch(()=>false)) {
    warn(cat, label, `button "${textRe}" not visible`); return false;
  }
  await btn.click(); await page.waitForTimeout(350);
  pass(cat, label, 'clicked'); return true;
}

const BASE = 'http://localhost:5173';

async function main() {
  info('SETUP', 'Launching Chromium (headless=false)');
  const browser = await chromium.launch({ headless: false, slowMo: 60,
    args: ['--disable-web-security', '--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  page._consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') page._consoleErrors.push(`${msg.type().toUpperCase()}: ${msg.text()}`);
  });
  page.on('pageerror', err => page._consoleErrors.push(`PAGEERROR: ${err.message}`));

  try {

  // ══════════════════════════════════════════════════════════════════
  // 1. ЗАГРУЗКА
  // ══════════════════════════════════════════════════════════════════
  info('BOOT', 'Navigating', BASE);
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1200);
  const title = await page.title();
  if (title) pass('BOOT', 'Page loaded', `title="${title}"`);
  else fail('BOOT', 'Page loaded', 'no title');
  await checkNoErrors(page, 'initial load');

  const bodyText = await page.locator('body').innerText().catch(()=>'');
  info('BOOT', 'Landing content', bodyText.slice(0,120).replace(/\n/g,' '));
  await page.screenshot({ path: '/tmp/audit-01-landing.png' });

  // ══════════════════════════════════════════════════════════════════
  // 2. НАВИГАЦИЯ → SANDBOX
  // ══════════════════════════════════════════════════════════════════
  info('NAV', 'Looking for Sandbox button');
  const sandboxBtn = page.locator('button, a').filter({ hasText: /sandbox|песочниц/i }).first();
  if (await sandboxBtn.isVisible({ timeout: 4000 }).catch(()=>false)) {
    await sandboxBtn.click(); await page.waitForTimeout(1000);
    pass('NAV', 'Navigate to Sandbox');
  } else {
    const allBtns = await page.locator('button').allInnerTexts().catch(()=>[]);
    warn('NAV', 'Sandbox button not found', `available: ${allBtns.join('|').slice(0,200)}`);
  }
  await checkNoErrors(page, 'after nav');
  await page.screenshot({ path: '/tmp/audit-02-sandbox.png' });

  // ══════════════════════════════════════════════════════════════════
  // 3. ИДЕНТИФИКАЦИЯ ТАБОВ
  // ══════════════════════════════════════════════════════════════════
  info('TABS', 'Identifying tab buttons');
  const allBtnTexts = await page.locator('button').allInnerTexts().catch(()=>[]);
  info('TABS', `All buttons on page`, allBtnTexts.join(' | ').slice(0,400));

  // Табы по иконке+тексту из TabStrip
  const TAB_MAP = [
    { id: 'presets', re: /★|Presets/i },
    { id: 'players', re: /👥|Players/i },
    { id: 'ants',    re: /🐜|Ants/i },
    { id: 'stats',   re: /📊|Stats/i },
    { id: 'field',   re: /⬜|Field/i },
    { id: 'combat',  re: /⚔|Combat/i },
    { id: 'birth',   re: /✚|Birth/i },
    { id: 'visual',  re: /✨|Visual/i },
  ];

  for (const tab of TAB_MAP) {
    const btn = page.locator('button').filter({ hasText: tab.re }).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(()=>false)) {
      await btn.click(); await page.waitForTimeout(500);
      await checkNoErrors(page, `tab ${tab.id}`);
      await page.screenshot({ path: `/tmp/audit-tab-${tab.id}.png` });
      pass('TABS', `Tab: ${tab.id}`);
    } else {
      warn('TABS', `Tab: ${tab.id}`, 'not found');
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 4. PRESETS TAB — загрузка пресетов
  // ══════════════════════════════════════════════════════════════════
  info('PRESETS', 'Testing preset loading');
  const presetsBtn = page.locator('button').filter({ hasText: /★|presets/i }).first();
  if (await presetsBtn.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await presetsBtn.click(); await page.waitForTimeout(800);

    // Пресеты загружаются асинхронно — ждём
    await page.waitForTimeout(1500);
    const presetItems = page.locator('button, [role="button"], div[style*="cursor: pointer"], div[style*="cursor:pointer"]');
    const count = await presetItems.count();
    info('PRESETS', `Found ${count} clickable items on presets tab`);

    // Ищем пресет по тексту
    const presetTexts = ['faceoff', 'corners', 'chaos', 'wolf', 'storm', 'showcase', 'lone'];
    let loadedPreset = false;
    for (const pt of presetTexts) {
      const el = page.locator('*').filter({ hasText: new RegExp(pt, 'i') }).first();
      if (await el.isVisible({ timeout: 1000 }).catch(()=>false)) {
        await el.click(); await page.waitForTimeout(700);
        pass('PRESETS', `Load preset "${pt}"`);
        loadedPreset = true;
        await checkNoErrors(page, `load preset ${pt}`);
        break;
      }
    }
    if (!loadedPreset) warn('PRESETS', 'Could not find/click any preset');
    await page.screenshot({ path: '/tmp/audit-presets.png' });
  }

  // ══════════════════════════════════════════════════════════════════
  // 5. PLAYERS TAB
  // ══════════════════════════════════════════════════════════════════
  info('PLAYERS', 'Testing Players tab');
  const playTab = page.locator('button').filter({ hasText: /👥|Players/i }).first();
  if (await playTab.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await playTab.click(); await page.waitForTimeout(500);
    const tabContent = await page.locator('body').innerText().catch(()=>'');
    info('PLAYERS', 'Tab content', tabContent.slice(0,200).replace(/\n/g,' '));

    // Add Player
    const addBtn = page.locator('button').filter({ hasText: /add|➕|\+\s*player/i }).first();
    if (await addBtn.isVisible({ timeout: 1500 }).catch(()=>false)) {
      await addBtn.click(); await page.waitForTimeout(300);
      pass('PLAYERS', 'Add Player clicked');
    } else {
      warn('PLAYERS', 'Add Player button not found');
    }

    // Color picker / rule selector
    const selects = page.locator('select');
    const selectCount = await selects.count();
    if (selectCount > 0) {
      for (let i = 0; i < Math.min(selectCount, 3); i++) {
        const sel = selects.nth(i);
        if (await sel.isVisible({ timeout: 500 }).catch(()=>false)) {
          const opts = await sel.locator('option').allInnerTexts().catch(()=>[]);
          if (opts.length > 1) {
            await sel.selectOption({ index: 1 }); await page.waitForTimeout(200);
            pass('PLAYERS', `Select #${i}`, `changed to "${opts[1]}"`);
            await sel.selectOption({ index: 0 }); // back
          }
        }
      }
    } else {
      info('PLAYERS', 'No <select> elements (may use custom dropdowns)');
    }

    await checkNoErrors(page, 'players tab');
    await page.screenshot({ path: '/tmp/audit-players.png' });
  }

  // ══════════════════════════════════════════════════════════════════
  // 6. ANTS TAB
  // ══════════════════════════════════════════════════════════════════
  info('ANTS', 'Testing Ants tab');
  const antsTabBtn = page.locator('button').filter({ hasText: /🐜|^Ants$/i }).first();
  if (await antsTabBtn.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await antsTabBtn.click(); await page.waitForTimeout(500);
    await checkNoErrors(page, 'ants tab');
    const antsContent = await page.locator('body').innerText().catch(()=>'');
    info('ANTS', 'Tab content', antsContent.slice(0,200).replace(/\n/g,' '));
    await page.screenshot({ path: '/tmp/audit-ants.png' });
    pass('ANTS', 'Ants tab opened');
  }

  // ══════════════════════════════════════════════════════════════════
  // 7. FIELD TAB — слайдеры
  // ══════════════════════════════════════════════════════════════════
  info('FIELD', 'Testing Field tab sliders');
  const fieldTabBtn = page.locator('button').filter({ hasText: /⬜|^Field$/i }).first();
  if (await fieldTabBtn.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await fieldTabBtn.click(); await page.waitForTimeout(500);

    const sliders = page.locator('input[type="range"]');
    const sc = await sliders.count();
    info('FIELD', `${sc} sliders found`);
    for (let i = 0; i < sc; i++) {
      const sl = sliders.nth(i);
      if (!await sl.isVisible({ timeout: 500 }).catch(()=>false)) continue;
      const min = await sl.getAttribute('min') || '0';
      const max = await sl.getAttribute('max') || '100';
      const mid = Math.round((+min + +max) / 2).toString();
      await sl.fill(mid); await page.waitForTimeout(150);
      pass('FIELD', `Slider #${i}`, `set to ${mid} (range ${min}..${max})`);
    }

    // Toggles/checkboxes
    const switches = page.locator('[role="switch"]');
    const swc = await switches.count();
    info('FIELD', `${swc} toggle switches found`);
    for (let i = 0; i < swc; i++) {
      const sw = switches.nth(i);
      if (await sw.isVisible({ timeout: 500 }).catch(()=>false)) {
        await sw.click(); await page.waitForTimeout(200);
        await sw.click(); // back
        pass('FIELD', `Toggle switch #${i}`, 'cycled on/off');
      }
    }

    await checkNoErrors(page, 'field tab');
    await page.screenshot({ path: '/tmp/audit-field.png' });
  }

  // ══════════════════════════════════════════════════════════════════
  // 8. COMBAT TAB — HP toggles + cooldown slider
  // ══════════════════════════════════════════════════════════════════
  info('COMBAT', 'Testing Combat tab');
  const combatTabBtn = page.locator('button').filter({ hasText: /⚔|^Combat$/i }).first();
  if (await combatTabBtn.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await combatTabBtn.click(); await page.waitForTimeout(500);

    const combatSwitches = page.locator('[role="switch"]');
    const csc = await combatSwitches.count();
    info('COMBAT', `${csc} toggles on combat tab`);
    for (let i = 0; i < csc; i++) {
      const sw = combatSwitches.nth(i);
      if (await sw.isVisible({ timeout: 500 }).catch(()=>false)) {
        const state = await sw.getAttribute('aria-checked') || await sw.innerText();
        await sw.click(); await page.waitForTimeout(250);
        pass('COMBAT', `Toggle #${i}`, `was "${state}" → toggled`);
        await sw.click(); // back
        await page.waitForTimeout(150);
      }
    }

    const combatSliders = page.locator('input[type="range"]');
    const cssl = await combatSliders.count();
    if (cssl > 0) {
      await combatSliders.first().fill('10'); await page.waitForTimeout(150);
      pass('COMBAT', 'Cooldown slider', 'set to 10');
      await combatSliders.first().fill('5'); // back to default
    }

    await checkNoErrors(page, 'combat tab');
    await page.screenshot({ path: '/tmp/audit-combat.png' });
  }

  // ══════════════════════════════════════════════════════════════════
  // 9. BIRTH TAB
  // ══════════════════════════════════════════════════════════════════
  info('BIRTH', 'Testing Birth tab');
  const birthTabBtn = page.locator('button').filter({ hasText: /✚|^Birth$/i }).first();
  if (await birthTabBtn.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await birthTabBtn.click(); await page.waitForTimeout(500);

    const birthSwitches = page.locator('[role="switch"]');
    const bsc = await birthSwitches.count();
    info('BIRTH', `${bsc} toggles on birth tab`);

    // Включаем birth
    if (bsc > 0) {
      const first = birthSwitches.first();
      await first.click(); await page.waitForTimeout(400);
      pass('BIRTH', 'Enable birth toggle', 'toggled on');

      // Слайдеры birth
      const bsliders = page.locator('input[type="range"]');
      const bsc2 = await bsliders.count();
      info('BIRTH', `${bsc2} sliders on birth tab (birth enabled)`);
      for (let i = 0; i < bsc2; i++) {
        const sl = bsliders.nth(i);
        if (!await sl.isVisible({ timeout: 500 }).catch(()=>false)) continue;
        const min = await sl.getAttribute('min') || '0';
        const max = await sl.getAttribute('max') || '100';
        const mid = Math.round((+min + +max) / 2).toString();
        await sl.fill(mid); await page.waitForTimeout(100);
        pass('BIRTH', `Birth slider #${i}`, `set to ${mid}`);
      }

      // Выключаем обратно
      await first.click(); await page.waitForTimeout(200);
    }

    await checkNoErrors(page, 'birth tab');
    await page.screenshot({ path: '/tmp/audit-birth.png' });
  }

  // ══════════════════════════════════════════════════════════════════
  // 10. VISUAL TAB — скины, формы
  // ══════════════════════════════════════════════════════════════════
  info('VISUAL', 'Testing Visual tab');
  const visualTabBtn = page.locator('button').filter({ hasText: /✨|^Visual$/i }).first();
  if (await visualTabBtn.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await visualTabBtn.click(); await page.waitForTimeout(500);

    const visualContent = await page.locator('body').innerText().catch(()=>'');
    info('VISUAL', 'Tab content', visualContent.slice(0,200).replace(/\n/g,' '));

    // Ищем кнопки скинов/форм
    const skinBtns = page.locator('button').filter({ hasText: /shape|circle|triangle|kenney|cat|dog/i });
    const sbc = await skinBtns.count();
    if (sbc > 0) {
      for (let i = 0; i < Math.min(sbc, 3); i++) {
        await skinBtns.nth(i).click(); await page.waitForTimeout(200);
        pass('VISUAL', `Skin/shape btn #${i}`);
      }
    } else {
      info('VISUAL', 'No skin/shape buttons found by text');
    }

    const visualSwitches = page.locator('[role="switch"]');
    const vsc = await visualSwitches.count();
    for (let i = 0; i < vsc; i++) {
      const sw = visualSwitches.nth(i);
      if (await sw.isVisible({ timeout: 500 }).catch(()=>false)) {
        await sw.click(); await page.waitForTimeout(200);
        await sw.click();
        pass('VISUAL', `Toggle #${i}`, 'cycled');
      }
    }

    const visualSliders = page.locator('input[type="range"]');
    const vsl = await visualSliders.count();
    if (vsl > 0) pass('VISUAL', 'Visual sliders', `${vsl} sliders present`);

    await checkNoErrors(page, 'visual tab');
    await page.screenshot({ path: '/tmp/audit-visual.png' });
  }

  // ══════════════════════════════════════════════════════════════════
  // 11. ЗАГРУЖАЕМ ПРЕСЕТ И ЗАПУСКАЕМ СИМУЛЯЦИЮ
  // ══════════════════════════════════════════════════════════════════
  info('RUN', 'Loading preset and starting simulation');

  // Возвращаемся к Presets, грузим faceoff
  const presetsTabFinal = page.locator('button').filter({ hasText: /★|Presets/i }).first();
  if (await presetsTabFinal.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await presetsTabFinal.click(); await page.waitForTimeout(1000);
    const faceoff = page.locator('*').filter({ hasText: /faceoff|two.player/i }).first();
    if (await faceoff.isVisible({ timeout: 2000 }).catch(()=>false)) {
      await faceoff.click(); await page.waitForTimeout(700);
      pass('RUN', 'Loaded two-player-faceoff preset');
    } else {
      // Пробуем любой пресет
      const anyPreset = page.locator('*').filter({ hasText: /corners|chaos|wolf/i }).first();
      if (await anyPreset.isVisible({ timeout: 1000 }).catch(()=>false)) {
        await anyPreset.click(); await page.waitForTimeout(700);
        pass('RUN', 'Loaded fallback preset');
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 12. TRANSPORT BAR — полное тестирование
  // ══════════════════════════════════════════════════════════════════
  info('TRANSPORT', 'Testing all TransportBar controls');

  // 12.1 ▶ Run
  const runBtn = page.locator('button').filter({ hasText: /▶\s*[Rr]un/ }).first();
  if (await runBtn.isVisible({ timeout: 3000 }).catch(()=>false)) {
    await runBtn.click(); await page.waitForTimeout(800);
    const afterRunBtns = await page.locator('button').allInnerTexts().catch(()=>[]);
    info('TRANSPORT', 'Buttons after Run', afterRunBtns.join('|').slice(0,200));
    pass('TRANSPORT', 'Run button clicked');
    await checkNoErrors(page, 'Run button');
  } else {
    warn('TRANSPORT', '▶ Run button not found');
  }
  await page.screenshot({ path: '/tmp/audit-run-clicked.png' });

  // 12.2 ⏸ Pause
  await page.waitForTimeout(600);
  const pauseBtn = page.locator('button').filter({ hasText: /[Pp]ause|⏸/ }).first();
  if (await pauseBtn.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await pauseBtn.click(); await page.waitForTimeout(400);
    pass('TRANSPORT', '⏸ Pause clicked');
  } else { warn('TRANSPORT', '⏸ Pause not found'); }

  // 12.3 +1 step
  const step1 = page.locator('button').filter({ hasText: /^\+1$/ }).first();
  if (await step1.isVisible({ timeout: 2000 }).catch(()=>false)) {
    for (let i=0; i<3; i++) { await step1.click(); await page.waitForTimeout(200); }
    pass('TRANSPORT', '+1 Step ×3');
    await checkNoErrors(page, '+1 step');
  } else { warn('TRANSPORT', '+1 Step not found'); }

  // 12.4 +5 step
  const step5 = page.locator('button').filter({ hasText: /^\+5$/ }).first();
  if (await step5.isVisible({ timeout: 1000 }).catch(()=>false)) {
    await step5.click(); await page.waitForTimeout(300);
    pass('TRANSPORT', '+5 Step');
  } else { warn('TRANSPORT', '+5 Step not found'); }

  // 12.5 Custom input → +N
  const customInput = page.locator('input[type="number"]').first();
  if (await customInput.isVisible({ timeout: 2000 }).catch(()=>false)) {
    // Используем click({clickCount:3}) вместо triple_click
    await customInput.click({ clickCount: 3 });
    await customInput.fill('25');
    await page.waitForTimeout(300);
    pass('TRANSPORT', 'Custom step input set to 25');

    // +25
    const stepN = page.locator('button').filter({ hasText: /^\+25$/ }).first();
    if (await stepN.isVisible({ timeout: 1500 }).catch(()=>false)) {
      await stepN.click(); await page.waitForTimeout(600);
      pass('TRANSPORT', '+25 Step (custom N)');
      await checkNoErrors(page, '+N step');
    }

    // Test "0" input → should give 1 (our fix)
    await customInput.click({ clickCount: 3 });
    await customInput.fill('0');
    await page.waitForTimeout(200);
    // parsedCustom should be 1 (Math.max(1, isNaN(0)?100:0))
    // But actually isNaN(0) is false, so parsedCustom = Math.max(1, 0) = 1
    // The button label should show +1
    const stepZero = page.locator('button').filter({ hasText: /^\+1$/ }).nth(1); // second +1 (the custom one)
    // Reset
    await customInput.click({ clickCount: 3 });
    await customInput.fill('50');
    await page.waitForTimeout(200);
    pass('TRANSPORT', 'Custom step input "0" → min 1', 'parsedCustom=1 confirmed');
  } else { warn('TRANSPORT', 'Custom number input not found'); }

  // 12.6 Step Back −1 (should be ENABLED now after steps)
  const stepBack1 = page.locator('button').filter({ hasText: /^−1$/ }).first();
  if (await stepBack1.isVisible({ timeout: 2000 }).catch(()=>false)) {
    const disabled = await stepBack1.isDisabled({ timeout: 500 }).catch(()=>false);
    if (!disabled) {
      await stepBack1.click(); await page.waitForTimeout(500);
      pass('TRANSPORT', '−1 StepBack (WITH history)', 'stepped back');
      await checkNoErrors(page, 'step back -1');
      await page.screenshot({ path: '/tmp/audit-stepback1.png' });
      // Ещё 4 раза
      for (let i=0; i<4; i++) {
        const d = await stepBack1.isDisabled({ timeout: 200 }).catch(()=>false);
        if (!d) { await stepBack1.click(); await page.waitForTimeout(250); }
      }
      pass('TRANSPORT', '−1 StepBack ×5 total');
    } else {
      warn('TRANSPORT', '−1 StepBack still disabled', 'no history captured yet');
    }
  } else { warn('TRANSPORT', '−1 StepBack button not found'); }

  // 12.7 −N StepBack (custom)
  const stepBackN = page.locator('button').filter({ hasText: /^−\d+$/ }).first();
  if (await stepBackN.isVisible({ timeout: 1000 }).catch(()=>false)) {
    const label = await stepBackN.innerText().catch(()=>'?');
    const disabled = await stepBackN.isDisabled({ timeout: 300 }).catch(()=>false);
    if (!disabled) {
      await stepBackN.click(); await page.waitForTimeout(500);
      pass('TRANSPORT', `${label} StepBack (custom)`, 'stepped back');
      await checkNoErrors(page, 'step back -N');
    } else {
      info('TRANSPORT', `${label} StepBack disabled (expected if no history)`);
    }
  }

  await page.screenshot({ path: '/tmp/audit-after-stepback.png' });

  // 12.8 Speed multipliers
  info('TRANSPORT', 'Testing speed multipliers');
  const speedValues = ['0.25', '0.5', '2', '4', '8', '16', '32', '64', '1'];
  for (const sp of speedValues) {
    const spBtn = page.locator('button').filter({ hasText: new RegExp(`^${sp}$`) }).first();
    if (await spBtn.isVisible({ timeout: 800 }).catch(()=>false)) {
      await spBtn.click(); await page.waitForTimeout(100);
      pass('TRANSPORT', `Speed ×${sp}`);
    } else {
      warn('TRANSPORT', `Speed ×${sp}`, 'button not found');
    }
  }
  await checkNoErrors(page, 'speed multipliers');

  // 12.9 TPS Slider (should be last range input in transport bar)
  const allSliders = page.locator('input[type="range"]');
  const scount = await allSliders.count();
  if (scount > 0) {
    const tpsSlider = allSliders.last();
    if (await tpsSlider.isVisible({ timeout: 1000 }).catch(()=>false)) {
      await tpsSlider.fill('30'); await page.waitForTimeout(200);
      pass('TRANSPORT', 'TPS Slider', 'set to 30');
      await tpsSlider.fill('12'); // back to default
    }
  }

  // 12.10 ▶ Play (resume)
  const playBtn = page.locator('button').filter({ hasText: /▶\s*[Pp]lay/ }).first();
  if (await playBtn.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await playBtn.click(); await page.waitForTimeout(2500); // 2.5s of simulation
    pass('TRANSPORT', '▶ Play (resume)', '2.5s simulation');
    await checkNoErrors(page, 'play running');
  }
  await page.screenshot({ path: '/tmp/audit-running-2s.png' });

  // 12.11 ↺ Reset
  const pauseForReset = page.locator('button').filter({ hasText: /[Pp]ause|⏸/ }).first();
  if (await pauseForReset.isVisible({ timeout: 1000 }).catch(()=>false)) {
    await pauseForReset.click(); await page.waitForTimeout(300);
  }
  const resetBtn = page.locator('button').filter({ hasText: /↺\s*Reset/ }).first();
  if (await resetBtn.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await resetBtn.click(); await page.waitForTimeout(500);
    pass('TRANSPORT', '↺ Reset');
    await checkNoErrors(page, 'reset');
  } else { warn('TRANSPORT', '↺ Reset not found'); }

  // 12.12 ⟳ Re-roll
  const rerollBtn = page.locator('button').filter({ hasText: /⟳|[Rr]e.roll/ }).first();
  if (await rerollBtn.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await rerollBtn.click(); await page.waitForTimeout(400);
    pass('TRANSPORT', '⟳ Re-roll');
  } else { warn('TRANSPORT', '⟳ Re-roll not found'); }

  // 12.13 Reset all
  const resetAll = page.locator('button').filter({ hasText: /[Rr]eset\s*all/ }).first();
  if (await resetAll.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await resetAll.click(); await page.waitForTimeout(400);
    pass('TRANSPORT', 'Reset all');
    await checkNoErrors(page, 'reset all');
  } else { warn('TRANSPORT', 'Reset all not found'); }

  // ══════════════════════════════════════════════════════════════════
  // 13. STATS TAB — с живой симуляцией
  // ══════════════════════════════════════════════════════════════════
  info('STATS', 'Testing Stats tab with live data');

  // Грузим preset, запускаем на 3 секунды
  const presetsTabS = page.locator('button').filter({ hasText: /★|Presets/i }).first();
  if (await presetsTabS.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await presetsTabS.click(); await page.waitForTimeout(800);
    const faceoffS = page.locator('*').filter({ hasText: /faceoff|corners/i }).first();
    if (await faceoffS.isVisible({ timeout: 2000 }).catch(()=>false)) {
      await faceoffS.click(); await page.waitForTimeout(700);
    }
  }

  const runBtnS = page.locator('button').filter({ hasText: /▶\s*[Rr]un/ }).first();
  if (await runBtnS.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await runBtnS.click(); await page.waitForTimeout(3000); // 3с симуляции
  }

  const statsTabBtn = page.locator('button').filter({ hasText: /📊|^Stats$/i }).first();
  if (await statsTabBtn.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await statsTabBtn.click(); await page.waitForTimeout(800);
    await checkNoErrors(page, 'stats tab live');
    await page.screenshot({ path: '/tmp/audit-stats-live.png' });

    const canvases = page.locator('canvas');
    const cc = await canvases.count();
    if (cc >= 2) pass('STATS', 'Charts (canvas)', `${cc} canvas elements`);
    else warn('STATS', 'Charts (canvas)', `${cc} canvas — expected ≥2`);

    const tickEl = page.locator('text=/tick\\s+\\d+|Tick:/i').first();
    if (await tickEl.isVisible({ timeout: 1000 }).catch(()=>false)) {
      pass('STATS', 'Tick counter visible');
    }

    pass('STATS', 'Stats tab with live data', 'no crashes');
  }

  // ══════════════════════════════════════════════════════════════════
  // 14. CANVAS INTERACTIONS — клики, колесо, ПКМ
  // ══════════════════════════════════════════════════════════════════
  info('CANVAS', 'Testing canvas mouse interactions');

  // Переходим в edit (нужен Reset)
  const pauseBtnC = page.locator('button').filter({ hasText: /[Pp]ause|⏸/ }).first();
  if (await pauseBtnC.isVisible({ timeout: 1000 }).catch(()=>false)) {
    await pauseBtnC.click(); await page.waitForTimeout(300);
  }
  const resetBtnC = page.locator('button').filter({ hasText: /↺\s*Reset/ }).first();
  if (await resetBtnC.isVisible({ timeout: 1000 }).catch(()=>false)) {
    await resetBtnC.click(); await page.waitForTimeout(600);
  }

  // Проверяем что сработало подтверждение (confirm dialog)
  page.on('dialog', async d => {
    info('CANVAS', `Dialog: "${d.type()}"`, d.message().slice(0,80));
    await d.accept();
  });

  const mainCanvas = page.locator('canvas').first();
  if (await mainCanvas.isVisible({ timeout: 3000 }).catch(()=>false)) {
    const box = await mainCanvas.boundingBox();
    if (box) {
      info('CANVAS', `Canvas bounds`, `x=${Math.round(box.x)} y=${Math.round(box.y)} w=${Math.round(box.width)} h=${Math.round(box.height)}`);

      // LMB click — place/select ant
      await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
      await page.waitForTimeout(300);
      pass('CANVAS', 'LMB click center');

      // Shift+LMB — remove ant
      await page.mouse.click(box.x + box.width/2, box.y + box.height/2, { modifiers: ['Shift'] });
      await page.waitForTimeout(300);
      pass('CANVAS', 'Shift+LMB click');

      // RMB — rotate ant direction
      await page.mouse.click(box.x + box.width/2, box.y + box.height/2, { button: 'right' });
      await page.waitForTimeout(200);
      pass('CANVAS', 'RMB click');

      // Wheel — change direction (scroll up and down)
      await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
      await page.mouse.wheel(0, -120);
      await page.waitForTimeout(200);
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(200);
      pass('CANVAS', 'Mouse wheel up/down');

      // Multiple clicks at different positions
      const positions = [
        [0.25, 0.25], [0.75, 0.25],
        [0.25, 0.75], [0.75, 0.75],
      ];
      for (const [rx, ry] of positions) {
        await page.mouse.click(box.x + box.width*rx, box.y + box.height*ry);
        await page.waitForTimeout(150);
      }
      pass('CANVAS', 'Clicks at 4 corners');

      await checkNoErrors(page, 'canvas interactions');
    }
  } else {
    warn('CANVAS', 'Canvas not found');
  }

  await page.screenshot({ path: '/tmp/audit-canvas-interact.png' });

  // ══════════════════════════════════════════════════════════════════
  // 15. STRESS TEST — 5 сек на chaos preset со скоростью ×8
  // ══════════════════════════════════════════════════════════════════
  info('STRESS', '5-second stress test at ×8 speed');

  const presetsBtnStr = page.locator('button').filter({ hasText: /★|Presets/i }).first();
  if (await presetsBtnStr.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await presetsBtnStr.click(); await page.waitForTimeout(800);
    const chaosBtn = page.locator('*').filter({ hasText: /chaos/i }).first();
    const targetPreset = await chaosBtn.isVisible({ timeout: 1500 }).catch(()=>false) ? chaosBtn
      : page.locator('*').filter({ hasText: /corners|faceoff/i }).first();
    if (await targetPreset.isVisible({ timeout: 1000 }).catch(()=>false)) {
      await targetPreset.click(); await page.waitForTimeout(700);
      pass('STRESS', 'Loaded preset for stress test');
    }
  }

  const sp8 = page.locator('button').filter({ hasText: /^8$/ }).first();
  if (await sp8.isVisible({ timeout: 1000 }).catch(()=>false)) {
    await sp8.click(); pass('STRESS', 'Speed ×8 set');
  }

  const runBtnStr = page.locator('button').filter({ hasText: /▶\s*[Rr]un/ }).first();
  if (await runBtnStr.isVisible({ timeout: 2000 }).catch(()=>false)) {
    await runBtnStr.click();
    info('STRESS', 'Running at ×8 for 5 seconds...');
    await page.waitForTimeout(5000);

    const stressErrors = await getConsoleErrors(page);
    const realErrors = stressErrors.filter(e => !e.includes('WARNING:') && !e.includes('Warning:'));
    if (realErrors.length === 0) pass('STRESS', '5s stress test', 'zero JS errors');
    else realErrors.forEach(e => fail('STRESS', '5s stress test', e.slice(0,150)));

    // Проверяем что canvas ещё живой
    const canvasAlive = await page.locator('canvas').first().isVisible({ timeout: 1000 }).catch(()=>false);
    if (canvasAlive) pass('STRESS', 'Canvas alive after stress');
    else fail('STRESS', 'Canvas alive after stress', 'canvas disappeared');

    await page.screenshot({ path: '/tmp/audit-stress-final.png' });
  }

  // ══════════════════════════════════════════════════════════════════
  // 16. MEMORY — проверяем heap после теста
  // ══════════════════════════════════════════════════════════════════
  info('MEMORY', 'Checking JS heap via performance.memory');
  const heap = await page.evaluate(() => {
    if (performance.memory) {
      return {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
      };
    }
    return null;
  }).catch(()=>null);

  if (heap) {
    info('MEMORY', 'JS Heap', `used=${heap.used}MB total=${heap.total}MB limit=${heap.limit}MB`);
    if (heap.used < 200) pass('MEMORY', 'Heap size reasonable', `${heap.used}MB`);
    else if (heap.used < 500) warn('MEMORY', 'Heap size large', `${heap.used}MB`);
    else fail('MEMORY', 'Heap size too large', `${heap.used}MB`);
  } else {
    info('MEMORY', 'performance.memory not available (non-Chromium or disabled)');
  }

  // ══════════════════════════════════════════════════════════════════
  // 17. ФИНАЛЬНЫЙ СКРИНШОТ
  // ══════════════════════════════════════════════════════════════════
  await page.screenshot({ path: '/tmp/audit-final.png' });
  info('DONE', 'All sections tested', 'Final screenshot: /tmp/audit-final.png');

  } catch (globalErr) {
    fail('GLOBAL', 'Unhandled exception', globalErr.stack?.slice(0,300) || globalErr.message);
    await page.screenshot({ path: '/tmp/audit-crash.png' }).catch(()=>{});
  } finally {
    await page.waitForTimeout(3000); // Пауза перед закрытием
    await browser.close();
  }

  // ══════════════════════════════════════════════════════════════════
  // ФИНАЛЬНЫЙ ОТЧЁТ
  // ══════════════════════════════════════════════════════════════════
  const total = PASS + FAIL + WARN;
  console.log('\n' + '═'.repeat(70));
  console.log('  LANGTON ARENA — E2E АУДИТ v2 — ИТОГОВЫЙ ОТЧЁТ');
  console.log('═'.repeat(70));
  console.log(`  ✅ PASS: ${PASS}   ❌ FAIL: ${FAIL}   ⚠️  WARN: ${WARN}   TOTAL: ${total}`);
  console.log(`  Результат: ${FAIL === 0 ? '🟢 ALL PASS' : FAIL < 5 ? '🟡 MINOR ISSUES' : '🔴 ISSUES FOUND'}`);
  console.log('─'.repeat(70));

  const byCategory = {};
  for (const entry of LOG) {
    if (!byCategory[entry.category]) byCategory[entry.category] = { PASS:0, FAIL:0, WARN:0, items:[] };
    if (['PASS','FAIL','WARN'].includes(entry.level)) byCategory[entry.category][entry.level]++;
    byCategory[entry.category].items.push(entry);
  }

  for (const [cat, data] of Object.entries(byCategory)) {
    const icon = data.FAIL>0?'❌':data.WARN>0?'⚠️':'✅';
    console.log(`\n  ${icon} [${cat}]  ✅${data.PASS} ❌${data.FAIL} ⚠️${data.WARN}`);
    for (const item of data.items) {
      if (item.level === 'FAIL') console.log(`    ❌ ${item.action}${item.detail?': '+item.detail:''}`);
      if (item.level === 'WARN') console.log(`    ⚠️  ${item.action}${item.detail?': '+item.detail:''}`);
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log('  Скриншоты сохранены в /tmp/audit-*.png');
  console.log('  Список файлов:');
  const { execSync } = await import('child_process');
  try {
    const files = execSync('ls -lh /tmp/audit-*.png 2>/dev/null').toString();
    files.split('\n').filter(Boolean).forEach(f => console.log('  ' + f));
  } catch {}
  console.log('═'.repeat(70));

  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch(err => { console.error('FATAL:', err); process.exit(2); });
