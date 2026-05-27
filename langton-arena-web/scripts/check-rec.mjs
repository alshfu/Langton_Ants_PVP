// /tmp/check-rec.mjs — debug check: видны ли REC controls на проде после клика Run
import { chromium } from 'playwright';

const BASE = 'https://alshfu.github.io/Langton_Ants_PVP';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/rec-01-menu.png' });

// Click Sandbox
const sandboxBtn = page.locator('button, a').filter({ hasText: /sandbox/i }).first();
await sandboxBtn.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/rec-02-sandbox-edit.png' });

// Click ▶ Run
const runBtn = page.locator('button').filter({ hasText: /▶\s*Run/ }).first();
await runBtn.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/rec-03-sandbox-run-full.png' });

// Screenshot just the top bar
const topBar = page.locator('div').filter({ hasText: /editing|live|tick|TPS/ }).first();
const topBox = await topBar.boundingBox();
console.log('Top bar bounds:', topBox);

// Crop top 100px screenshot
await page.screenshot({
  path: '/tmp/rec-04-topbar-only.png',
  clip: { x: 0, y: 0, width: 1440, height: 100 },
});

// Find REC text
const body = await page.locator('body').innerText();
console.log('\n--- Body text contains: ---');
console.log('REC ready  ?', /REC ready/i.test(body));
console.log('REC ·     ?', /REC ·/i.test(body));
console.log('Save      ?', /Save/i.test(body));
console.log('Discard   ?', /Discard|🗑/i.test(body));
console.log('live      ?', /\blive\b/i.test(body));
console.log('paused    ?', /paused/i.test(body));

// Find specific elements
const recReadyCount = await page.locator('text=REC ready').count();
const recActiveCount = await page.locator('text=/REC ·/').count();
console.log('\n--- Element counts: ---');
console.log('REC ready chips:', recReadyCount);
console.log('REC · chips:    ', recActiveCount);

// Find all chip-like elements in top bar
const chips = await page.locator('div').filter({ hasText: /^(editing|live|paused|REC|tick|TPS)/ }).allInnerTexts().catch(() => []);
console.log('\n--- All top-bar text fragments: ---');
chips.slice(0, 20).forEach(c => console.log(' »', c.slice(0, 100)));

await browser.close();
console.log('\nScreenshots: /tmp/rec-01-menu.png, /tmp/rec-02-sandbox-edit.png, /tmp/rec-03-sandbox-run-full.png, /tmp/rec-04-topbar-only.png');
