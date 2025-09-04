const { chromium } = require('playwright');

async function testLiveSite() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const jsErrors = [];
  const pageErrors = [];
  
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      jsErrors.push(msg.text());
      console.log('Console error:', msg.text());
    }
  });
  
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
    console.log('Page error:', error.message);
  });
  
  console.log('Testing live site: https://salunga-olebr4akt-james-3002s-projects.vercel.app/');
  
  try {
    const response = await page.goto('https://salunga-olebr4akt-james-3002s-projects.vercel.app/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log('Response status:', response?.status());
    
    if (response?.status() !== 200) {
      throw new Error(`Expected 200 status, got ${response?.status()}`);
    }
    
    // Check for critical errors
    const criticalErrors = [...jsErrors, ...pageErrors].filter(error => 
      error.includes('SyntaxError') || 
      error.includes('Unexpected EOF') ||
      error.includes('TypeError')
    );
    
    if (criticalErrors.length > 0) {
      console.log('❌ Critical errors found:', criticalErrors);
      process.exit(1);
    } else {
      console.log('✅ No critical JavaScript errors found');
    }
    
    // Check if page has basic content
    await page.waitForTimeout(2000);
    const title = await page.title();
    console.log('Page title:', title);
    
    console.log('✅ Site is loading successfully without EOF errors!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testLiveSite();