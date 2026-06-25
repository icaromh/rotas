import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));
  page.on('dialog', async dialog => {
    console.log('DIALOG:', dialog.message());
    await dialog.dismiss();
  });
  
  page.on('workercreated', worker => {
    console.log('WORKER CREATED:', worker.url());
    worker.on('console', msg => console.log('WORKER LOG:', msg.text()));
    worker.on('pageerror', error => console.log('WORKER ERROR:', error.message));
  });
  
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
  
  await page.evaluate(() => {
    // Fire the draw:created event with a dummy rectangle
    const bounds = window.L.latLngBounds(
      window.L.latLng(-23.55, -46.63),
      window.L.latLng(-23.555, -46.635)
    );
    const layer = window.L.rectangle(bounds);
    window.map.fire('draw:created', { layer: layer });
  });

  console.log('Page loaded and drawn. Clicking generate button...');
  await page.click('#generate-btn');
  
  const btnHTML = await page.evaluate(() => document.querySelector('#generate-btn')?.innerHTML);
  console.log('BTN HTML AFTER CLICK:', btnHTML);
  
  // Wait a bit to see if anything happens
  await new Promise(r => setTimeout(r, 8000));
  
  await browser.close();
})();
