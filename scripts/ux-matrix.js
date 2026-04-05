const { chromium } = require('playwright');
const { waitForAssistantDone, waitForModelReady } = require('./ux-helpers');

const BASE_URL = process.env.UX_BASE_URL || 'http://127.0.0.1:5173/';

const baseCases = [
  { model: 'gpt-5.1', reasoning: 'low', temp: '0.3', expectReasoning: true },
  { model: 'o1', reasoning: 'low', temp: '0.0', expectReasoning: true },
  { model: 'o3', reasoning: 'high', temp: '0.0', expectReasoning: true },
  { model: 'gpt-4o', reasoning: 'low', temp: '0.7', expectReasoning: false },
];

async function getAvailableAnthropicModel() {
  try {
    const resp = await fetch('http://127.0.0.1:8000/api/usage/models');
    const data = await resp.json();
    const available = data.models
      .filter((model) => model.provider === 'anthropic' && model.available);
    return available[0]?.id || null;
  } catch (error) {
    return null;
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const log = (msg) => console.log(`[ux-matrix] ${msg}`);

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.topbar');
  await waitForModelReady(page);

  const anthroModel = await getAvailableAnthropicModel();
  const cases = [
    ...baseCases,
    ...(anthroModel
      ? [{ model: anthroModel, reasoning: 'low', temp: '0.5', expectReasoning: false }]
      : []),
  ];

  let assistantCount = 0;

  for (const test of cases) {
    log(`case: ${test.model}`);
    await page.fill('.composer-input', `/model ${test.model}`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const selectedLabel = await page.$eval('.status-model', (el) => el.textContent || '');
    log(`selected model: ${selectedLabel.trim()}`);

    await page.fill('.composer-input', `/reasoning ${test.reasoning}`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const errorState = await page.$eval('.error-strip', (el) => ({
      visible: !el.hidden,
      text: (el.textContent || '').trim(),
    }));
    if (test.expectReasoning && errorState.visible) {
      log(`unexpected reasoning error: ${errorState.text}`);
    }
    if (!test.expectReasoning && !errorState.visible) {
      log('expected reasoning error but none shown');
    }

    await page.fill('.composer-input', `/temp ${test.temp}`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    assistantCount += 1;
    await page.fill('.composer-input', `Quick check for ${test.model}.`);
    await page.keyboard.press('Enter');
    await waitForAssistantDone(page, assistantCount);

    const meta = await page.$eval('.app-probe', (el) => {
      const text = el.textContent || '';
      const lines = text.trim().split('\n').slice(-6);
      return lines.join(' | ');
    });
    log(`tail: ${meta.trim()}`);
  }

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
