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

async function waitForModelReady(page) {
  await page.waitForFunction(() => {
    const meta = document.querySelector('.model-meta');
    return meta && (meta.textContent || '').trim().length > 0;
  }, { timeout: 10000 });
}

async function waitForAssistantDone(page) {
  await page.waitForFunction(() => {
    const metas = Array.from(document.querySelectorAll('.message.assistant .message-meta'));
    if (metas.length === 0) return false;
    return metas.every((el) => {
      const text = (el.textContent || '').toLowerCase();
      return !text.includes('pending') && !text.includes('streaming');
    });
  }, { timeout: 20000 });
  await page.waitForFunction(() => {
    const content = document.querySelector('.message.assistant:last-child .message-content');
    return content && (content.textContent || '').trim().length > 0;
  }, { timeout: 20000 });
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
  await waitForModelReady(page);

  await page.fill('.message-input', 'Write two lines about neon rain.');
  await page.keyboard.press('Enter');
  log('sent poetry');
  await waitForAssistantDone(page);

  await page.click('.menu-button');
  await page.waitForSelector('.panel-overlay.visible');
  await page.waitForFunction(() => {
    const items = document.querySelectorAll('.conversation-item');
    return items.length > 0;
  }, { timeout: 10000 });
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
  await waitForAssistantDone(page);
  const afterReload = await page.$$eval('.message', (els) => els.length);
  log(`messages after reload: ${afterReload}`);

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
