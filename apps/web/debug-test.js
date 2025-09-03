const { chromium } = require('playwright');

(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Listen for all console messages
  page.on('console', msg => {
    console.log(`CONSOLE [${msg.type()}]:`, msg.text());
  });
  
  // Listen for page errors
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });
  
  try {
    console.log('Navigating to page...');
    const response = await page.goto('https://salunga-mv0loo49v-james-3002s-projects.vercel.app/', {
      timeout: 30000,
      waitUntil: 'load'
    });
    
    console.log('Response status:', response.status());
    console.log('Page title:', await page.title());
    
    // Wait a bit to see if any errors occur
    await page.waitForTimeout(5000);
    
    console.log('Test completed successfully');
  } catch (error) {
    console.log('ERROR:', error.message);
  } finally {
    await browser.close();
  }
})();