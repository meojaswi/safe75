const puppeteer = require('puppeteer');
(async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    // Stub login token to bypass login page if needed
    await page.goto('http://localhost:3000/dashboard.html');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'test_token');
    });
    // Go to dashboard
    await page.goto('http://localhost:3000/dashboard.html', { waitUntil: 'networkidle2' });
    
    await browser.close();
    console.log('Puppeteer check complete.');
  } catch (err) {
    console.error('PUPPETEER ERROR:', err);
  }
})();
