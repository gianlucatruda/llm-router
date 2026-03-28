const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { assistantEntryCount, waitForAssistantDone, waitForModelReady } = require('./ux-helpers');

const BASE_URL = process.env.UX_BASE_URL || 'http://127.0.0.1:5173/';
const SCREEN_DIR = path.resolve(__dirname, '..', 'docs', 'screenshots');
const TS = new Date().toISOString().replace(/[:.]/g, '-');

function ensureDir() {
  fs.mkdirSync(SCREEN_DIR, { recursive: true });
}

function screenshotPath(label) {
  return path.join(SCREEN_DIR, `${TS}-${label}.png`);
}

async function run() {
  ensureDir();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const log = (msg) => console.log(`[ux-smoke] ${msg}`);

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.topbar');
  await waitForModelReady(page);
  const versionLabel = await page.$eval('.brand-version', (el) => (el.textContent || '').trim());
  log(`version label: ${versionLabel || 'missing'}`);
  await page.screenshot({ path: screenshotPath('mobile-home') });
  log('loaded mobile view');

  await page.fill('.composer-input', '/help');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  log('sent /help');

  await page.fill('.composer-input', '/model gpt-5.1');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  log('switched model');

  await page.fill('.composer-input', '/temp 0.3');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  log('set temperature');

  await page.fill('.composer-input', '/reasoning low');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  log('set reasoning');

  await page.click('.session-toggle');
  await page.waitForFunction(() => document.getElementById('app')?.dataset.drawerOpen === 'true');
  await page.screenshot({ path: screenshotPath('mobile-sessions') });
  log('sessions panel opened');

  await page.click('.drawer-close');
  log('sessions panel closed');

  await page.fill('.composer-input', 'Write a short haiku about circuit boards.');
  await page.keyboard.press('Enter');
  log('sent haiku message');

  await waitForAssistantDone(page, 1);
  const assistantContent = await page.$eval('.app-probe', (el) => el.textContent || '');
  log(`assistant content length: ${assistantContent.trim().length}`);

  await page.fill('.composer-input', 'Return a JavaScript function that sums an array.');
  await page.keyboard.press('Enter');
  log('sent code request');
  await waitForAssistantDone(page, 2);

  const codeFences = await page.$eval('.app-probe', (el) => ((el.textContent || '').match(/```/g) || []).length);
  log(`code fences found: ${codeFences}`);

  await page.click('.session-toggle');
  await page.waitForFunction(() => {
    const items = document.querySelectorAll('.session-item');
    return items.length > 0;
  }, null, { timeout: 10000 });
  const items = await page.$$eval('.session-item', (els) => els.length);
  log(`conversation items: ${items}`);

  if (items > 0) {
    await page.click('.session-main');
    await page.waitForTimeout(600);
    log('selected conversation');
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.terminal-output');
  await waitForAssistantDone(page, 2);
  const afterReload = await assistantEntryCount(page);
  log(`messages after reload: ${afterReload}`);

  await page.setViewportSize({ width: 834, height: 1112 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: screenshotPath('tablet') });
  log('resized to tablet');

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: screenshotPath('desktop') });
  log('resized to desktop');

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
