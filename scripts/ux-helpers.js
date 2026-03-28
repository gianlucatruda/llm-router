async function waitForModelReady(page) {
  await page.waitForFunction(() => {
    const meta = document.querySelector('.status-model');
    return meta && (meta.textContent || '').trim().length > 0;
  }, { timeout: 10000 });
}

async function waitForAssistantDone(page, count = 1) {
  await page.evaluate((expectedCount) => {
    window.__expectedAssistantCount = expectedCount;
  }, count);
  await page.waitForFunction(() => {
    const root = document.getElementById('app');
    const probe = document.querySelector('.app-probe');
    const text = probe?.textContent || '';
    const matches = text.match(/^ASSISTANT /gm) || [];
    return root?.dataset.streaming === 'false' && matches.length >= window.__expectedAssistantCount;
  }, null, { timeout: 20000, polling: 250 });
}

async function assistantEntryCount(page) {
  return page.$eval('.app-probe', (el) => ((el.textContent || '').match(/^ASSISTANT /gm) || []).length);
}

module.exports = {
  assistantEntryCount,
  waitForAssistantDone,
  waitForModelReady,
};
