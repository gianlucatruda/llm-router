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
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(8000);

  const log = (msg) => console.log(`[ux-extended] ${msg}`);

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.topbar');
  await waitForModelReady(page);

  await page.fill('.composer-input', 'Write two lines about neon rain.');
  await page.keyboard.press('Enter');
  log('sent poetry');
  await waitForAssistantDone(page, 1);

  await page.click('.session-toggle');
  await page.waitForFunction(() => {
    const items = document.querySelectorAll('.session-item');
    return items.length > 0;
  }, null, { timeout: 10000 });
  await page.screenshot({ path: screenshotPath('sessions-after-poetry') });

  const firstItem = await page.$('.session-item');
  if (firstItem) {
    const cloneButton = await firstItem.$('.session-action');
    if (cloneButton) {
      await cloneButton.click();
      log('cloned conversation');
      await page.waitForTimeout(1000);
    }
  }

  await page.screenshot({ path: screenshotPath('after-clone') });

  const items = await page.$$eval('.session-item', (els) => els.length);
  log(`conversation items: ${items}`);

  const overlayVisible = await page.evaluate(() => {
    return document.getElementById('app')?.dataset.drawerOpen === 'true';
  });
  if (overlayVisible) {
    await page.click('.drawer-overlay', { position: { x: 10, y: 10 } });
  }

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 8000 });
  await page.waitForSelector('.terminal-output');
  await waitForAssistantDone(page, 1);
  const afterReload = await assistantEntryCount(page);
  log(`messages after reload: ${afterReload}`);

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
