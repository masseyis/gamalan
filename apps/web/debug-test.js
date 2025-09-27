const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen to console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });

  // Listen to page errors
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  console.log('Navigating to homepage...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  console.log('Page title:', await page.title());
  console.log('Page URL:', page.url());

  // Check what's actually on the page
  const body = await page.locator('body').textContent();
  console.log('Body content preview:', body.substring(0, 500));

  // Check for h1 elements
  const h1Elements = await page.locator('h1').count();
  console.log('Number of h1 elements:', h1Elements);

  if (h1Elements > 0) {
    for (let i = 0; i < h1Elements; i++) {
      const h1Text = await page.locator('h1').nth(i).textContent();
      console.log(`H1 ${i + 1}:`, h1Text);
    }
  }

  await browser.close();
})().catch(console.error);
