const { chromium } = require('playwright');

const BASE_URL = process.env.UX_BASE_URL || 'http://127.0.0.1:5173/';

const cases = [
  { model: 'gpt-5.1', reasoning: 'low', temp: '0.3', expectReasoning: true },
  { model: 'o1', reasoning: 'low', temp: '0.0', expectReasoning: true },
  { model: 'o3', reasoning: 'high', temp: '0.0', expectReasoning: true },
  { model: 'gpt-4o', reasoning: 'low', temp: '0.7', expectReasoning: false },
  { model: 'claude-3-5-sonnet-20240620', reasoning: 'low', temp: '0.5', expectReasoning: false },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const log = (msg) => console.log(`[ux-matrix] ${msg}`);

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.header');

  for (const test of cases) {
    log(`case: ${test.model}`);
    await page.fill('.message-input', `/model ${test.model}`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const selectedValue = await page.$eval('.model-selector', (el) => el.value);
    log(`selected model: ${selectedValue}`);

    await page.fill('.message-input', `/reasoning ${test.reasoning}`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const errorState = await page.$eval('.error-banner', (el) => ({
      visible: getComputedStyle(el).display !== 'none',
      text: (el.querySelector('span')?.textContent || '').trim(),
    }));
    if (test.expectReasoning && errorState.visible) {
      log(`unexpected reasoning error: ${errorState.text}`);
    }
    if (!test.expectReasoning && !errorState.visible) {
      log('expected reasoning error but none shown');
    }

    await page.fill('.message-input', `/temp ${test.temp}`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    await page.fill('.message-input', `Quick check for ${test.model}.`);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => {
      const pending = Array.from(document.querySelectorAll('.message.assistant .message-meta'))
        .some((el) => (el.textContent || '').includes('pending'));
      return !pending;
    }, { timeout: 15000 });

    const meta = await page.$eval('.message.assistant:last-child .message-meta', (el) => el.textContent || '');
    log(`meta: ${meta.trim()}`);
  }

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
