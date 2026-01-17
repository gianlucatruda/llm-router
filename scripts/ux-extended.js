const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

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
  await page.waitForSelector('.header');

  await page.fill('.message-input', 'Write two lines about neon rain.');
  await page.keyboard.press('Enter');
  log('sent poetry');
  await page.waitForTimeout(2500);

  await page.click('.menu-button');
  await page.waitForSelector('.panel-overlay.visible');
  await page.screenshot({ path: screenshotPath('sessions-after-poetry') });

  const firstItem = await page.$('.conversation-item');
  if (firstItem) {
    const cloneButton = await firstItem.$('.clone-button');
    if (cloneButton) {
      await cloneButton.click();
      log('cloned conversation');
      await page.waitForTimeout(1000);
    }
  }

  await page.screenshot({ path: screenshotPath('after-clone') });

  const items = await page.$$eval('.conversation-item', (els) => els.length);
  log(`conversation items: ${items}`);

  const overlayVisible = await page.evaluate(() => {
    const overlay = document.querySelector('.panel-overlay');
    return overlay ? overlay.classList.contains('visible') : false;
  });
  if (overlayVisible) {
    await page.click('.panel-overlay', { position: { x: 10, y: 10 } });
  }

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 8000 });
  await page.waitForSelector('.messages-container');
  const afterReload = await page.$$eval('.message', (els) => els.length);
  log(`messages after reload: ${afterReload}`);

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
