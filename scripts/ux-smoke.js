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

  const log = (msg) => console.log(`[ux-smoke] ${msg}`);

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.header');
  await page.screenshot({ path: screenshotPath('mobile-home') });
  log('loaded mobile view');

  await page.fill('.message-input', '/help');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  log('sent /help');

  await page.fill('.message-input', '/model gpt-5.1');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  log('switched model');

  await page.fill('.message-input', '/temp 0.3');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  log('set temperature');

  await page.fill('.message-input', '/reasoning low');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  log('set reasoning');

  await page.click('.menu-button');
  await page.waitForSelector('.panel-overlay.visible');
  await page.screenshot({ path: screenshotPath('mobile-sessions') });
  log('sessions panel opened');

  await page.click('.panel-close');
  log('sessions panel closed');

  await page.fill('.message-input', 'Write a short haiku about circuit boards.');
  await page.keyboard.press('Enter');
  log('sent haiku message');

  await page.waitForFunction(() => {
    const pending = Array.from(document.querySelectorAll('.message.assistant .message-meta'))
      .some((el) => (el.textContent || '').includes('pending'));
    return !pending;
  }, { timeout: 15000 });
  const assistantContent = await page.$eval('.message.assistant .message-content', (el) => el.textContent || '');
  log(`assistant content length: ${assistantContent.trim().length}`);

  await page.fill('.message-input', 'Return a JavaScript function that sums an array.');
  await page.keyboard.press('Enter');
  log('sent code request');
  await page.waitForFunction(() => {
    const pending = Array.from(document.querySelectorAll('.message.assistant .message-meta'))
      .some((el) => (el.textContent || '').includes('pending'));
    return !pending;
  }, { timeout: 15000 });

  const codeBlocks = await page.$$eval('pre code', (items) => items.length);
  log(`code blocks found: ${codeBlocks}`);

  await page.click('.menu-button');
  await page.waitForSelector('.panel-overlay.visible');
  const items = await page.$$eval('.conversation-item', (els) => els.length);
  log(`conversation items: ${items}`);

  if (items > 0) {
    await page.click('.conversation-item');
    await page.waitForTimeout(600);
    log('selected conversation');
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.messages-container');
  const afterReload = await page.$$eval('.message', (els) => els.length);
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
