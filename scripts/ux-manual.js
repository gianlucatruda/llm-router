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

async function waitForAssistant(page) {
  await page.waitForFunction(() => {
    const pending = Array.from(document.querySelectorAll('.message.assistant .message-meta'))
      .some((el) => (el.textContent || '').includes('pending'));
    return !pending;
  }, { timeout: 15000 });
}

async function run() {
  ensureDir();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const log = (msg) => console.log(`[ux-manual] ${msg}`);

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.header');
  await page.screenshot({ path: screenshotPath('start') });

  // Slash command suggestions
  await page.fill('.message-input', '/model');
  await page.waitForTimeout(300);
  const suggestionVisible = await page.$eval('.command-suggestions', (el) => getComputedStyle(el).display !== 'none');
  log(`suggestions visible: ${suggestionVisible}`);
  await page.keyboard.press('Enter');

  // Model gpt-5.1 + reasoning + temp
  await page.fill('.message-input', '/model gpt-5.1');
  await page.keyboard.press('Enter');
  await page.fill('.message-input', '/reasoning low');
  await page.keyboard.press('Enter');
  await page.fill('.message-input', '/temp 0.4');
  await page.keyboard.press('Enter');

  await page.fill('.message-input', 'Say hello in one sentence.');
  await page.keyboard.press('Enter');
  await waitForAssistant(page);

  await page.screenshot({ path: screenshotPath('after-gpt-5-1') });

  // Switch to gpt-4o (no reasoning)
  await page.fill('.message-input', '/model gpt-4o');
  await page.keyboard.press('Enter');
  await page.fill('.message-input', '/reasoning low');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const errorText = await page.$eval('.error-banner span', (el) => el.textContent || '');
  log(`reasoning error: ${errorText.trim()}`);
  await page.fill('.message-input', '/temp 0.7');
  await page.keyboard.press('Enter');

  await page.fill('.message-input', 'Return a fenced code block with a JS sum function.');
  await page.keyboard.press('Enter');
  await waitForAssistant(page);

  const metaText = await page.$eval('.message.assistant:last-child .message-meta', (el) => el.textContent || '');
  log(`assistant meta: ${metaText.trim()}`);

  await page.screenshot({ path: screenshotPath('after-gpt-4o') });

  // Ensure input remains enabled
  const inputDisabled = await page.$eval('.message-input', (el) => (el).disabled);
  log(`input disabled: ${inputDisabled}`);

  // Long conversation + model switch back
  for (let i = 0; i < 3; i += 1) {
    await page.fill('.message-input', `Quick reply ${i + 1}`);
    await page.keyboard.press('Enter');
    await waitForAssistant(page);
  }

  await page.fill('.message-input', '/model gpt-5.1');
  await page.keyboard.press('Enter');
  await page.fill('.message-input', 'Another response after model switch.');
  await page.keyboard.press('Enter');
  await waitForAssistant(page);

  await page.screenshot({ path: screenshotPath('after-long-thread') });

  // Reload and verify metadata persists
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.messages-container');
  const persistedMeta = await page.$$eval('.message.assistant .message-meta', (nodes) => nodes.map((n) => n.textContent || ''));
  log(`persisted meta count: ${persistedMeta.length}`);
  await page.screenshot({ path: screenshotPath('after-reload') });

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
