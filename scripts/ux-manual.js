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
  const log = (msg) => console.log(`[ux-manual] ${msg}`);

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.topbar');
  await waitForModelReady(page);
  await page.screenshot({ path: screenshotPath('start') });

  // Slash command suggestions
  await page.fill('.composer-input', '/model');
  await page.waitForTimeout(300);
  const suggestionVisible = await page.$eval('.suggestion-list', (el) => !el.hidden);
  log(`suggestions visible: ${suggestionVisible}`);
  await page.keyboard.press('Enter');

  // Model gpt-5.1 + reasoning + temp
  await page.fill('.composer-input', '/model gpt-5.1');
  await page.keyboard.press('Enter');
  await page.fill('.composer-input', '/reasoning low');
  await page.keyboard.press('Enter');
  await page.fill('.composer-input', '/temp 0.4');
  await page.keyboard.press('Enter');

  let assistantCount = 1;
  await page.fill('.composer-input', 'Say hello in one sentence.');
  await page.keyboard.press('Enter');
  await waitForAssistantDone(page, assistantCount);

  await page.screenshot({ path: screenshotPath('after-gpt-5-1') });

  // Switch to gpt-4o (no reasoning)
  await page.fill('.composer-input', '/model gpt-4o');
  await page.keyboard.press('Enter');
  await page.fill('.composer-input', '/reasoning low');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const errorText = await page.$eval('.error-strip', (el) => el.textContent || '');
  log(`reasoning error: ${errorText.trim()}`);
  await page.fill('.composer-input', '/temp 0.7');
  await page.keyboard.press('Enter');

  assistantCount += 1;
  await page.fill('.composer-input', 'Return a fenced code block with a JS sum function.');
  await page.keyboard.press('Enter');
  await waitForAssistantDone(page, assistantCount);

  const metaText = await page.$eval('.app-probe', (el) => {
    const lines = (el.textContent || '').trim().split('\n').slice(-6);
    return lines.join(' | ');
  });
  log(`assistant tail: ${metaText.trim()}`);

  await page.screenshot({ path: screenshotPath('after-gpt-4o') });

  // Ensure input remains enabled
  const inputDisabled = await page.$eval('.composer-input', (el) => el.disabled);
  log(`input disabled: ${inputDisabled}`);

  // Long conversation + model switch back
  for (let i = 0; i < 3; i += 1) {
    assistantCount += 1;
    await page.fill('.composer-input', `Quick reply ${i + 1}`);
    await page.keyboard.press('Enter');
    await waitForAssistantDone(page, assistantCount);
  }

  await page.fill('.composer-input', '/model gpt-5.1');
  await page.keyboard.press('Enter');
  assistantCount += 1;
  await page.fill('.composer-input', 'Another response after model switch.');
  await page.keyboard.press('Enter');
  await waitForAssistantDone(page, assistantCount);

  await page.screenshot({ path: screenshotPath('after-long-thread') });

  // Reload and verify metadata persists
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.terminal-output');
  await waitForModelReady(page);
  const persistedMeta = await assistantEntryCount(page);
  log(`persisted meta count: ${persistedMeta}`);
  await page.screenshot({ path: screenshotPath('after-reload') });

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
