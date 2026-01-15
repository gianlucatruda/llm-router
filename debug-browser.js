/**
 * Debug script to interact with the browser and capture console errors
 */
const { chromium } = require('playwright');

async function debugBrowser() {
  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: false,  // Show browser so you can see what's happening
    devtools: true    // Open DevTools automatically
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error' || type === 'warning') {
      console.log(`[BROWSER ${type.toUpperCase()}]`, text);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    console.log('[BROWSER PAGE ERROR]', error.message);
    console.log(error.stack);
  });

  // Capture network errors
  page.on('requestfailed', request => {
    console.log('[NETWORK ERROR]', request.url(), request.failure()?.errorText);
  });

  // Navigate to the app
  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173');

  console.log('\nBrowser is ready! You can interact with the app.');
  console.log('Console errors will be displayed here in the terminal.');
  console.log('Press Ctrl+C to close the browser.\n');

  // Keep the script running
  await new Promise(() => {});
}

debugBrowser().catch(console.error);
