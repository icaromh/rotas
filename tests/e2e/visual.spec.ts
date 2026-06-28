import { test, expect } from '@playwright/test';

const LOCALES = ['en-US', 'pt-BR', 'es-ES'];

for (const locale of LOCALES) {
  test.describe(`Visual Regression Tests [${locale}]`, () => {

    test.beforeEach(async ({ page }) => {
      // Intercept and mock tile requests with a solid gray PNG
      await page.route('**/*.basemaps.cartocdn.com/rastertiles/voyager/**/*.png', async route => {
        await route.fulfill({
          contentType: 'image/png',
          body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mM88x8AAp0BzdNIl+IAAAAASUVORK5CYII=', 'base64')
        });
      });

      await page.goto('/');
      await page.evaluate((l) => {
        localStorage.setItem('i18nextLng', l);
      }, locale);
      await page.reload();
      await page.waitForSelector('.leaflet-draw-toolbar');
    });

    test('Initial Load UI', async ({ page }) => {
      await expect(page).toHaveScreenshot(`initial-ui-${locale}.png`, {
        mask: [
          page.locator('.leaflet-control-attribution')
        ],
        fullPage: true,
      });
    });

    test('Settings Modal', async ({ page }) => {
      await page.locator('#settings-btn').click();

      const settingsModal = page.locator('#preferences-modal');
      await expect(settingsModal).toBeVisible();

      await expect(page).toHaveScreenshot(`settings-modal-${locale}.png`, {
        mask: [
          page.locator('.leaflet-control-attribution')
        ],
        fullPage: true,
      });
    });

    test('Drawing In Progress UI State', async ({ page, isMobile }) => {
      // Leaflet Draw touch simulation in Playwright can be flaky, skip on mobile
      if (isMobile) {
        test.skip();
      }
      // Start drawing
      await page.locator('.leaflet-draw-draw-polygon').first().click();
      
      // Click on map to place two points so all drawing action buttons appear
      await page.waitForTimeout(500);
      await page.locator('.leaflet-container').click({ position: { x: 200, y: 200 }, force: true });
      await page.waitForTimeout(500);
      await page.locator('.leaflet-container').click({ position: { x: 300, y: 200 }, force: true });
      
      const actions = page.locator('.leaflet-draw-actions').first();
      await expect(actions).toBeVisible();

      await expect(page).toHaveScreenshot(`drawing-in-progress-ui-${locale}.png`, {
        mask: [
          page.locator('.leaflet-control-attribution')
        ],
        fullPage: true,
      });
    });

    test('Drawn Polygon UI State', async ({ page }) => {
      await page.evaluate(() => {
        const latlngs = [
          [41.387, 2.168],
          [41.387, 2.169],
          [41.388, 2.169]
        ];
        const layer = (window as any).L.polygon(latlngs);
        (window as any).map.fire('draw:created', { layerType: 'polygon', layer });
      });

      await expect(page).toHaveScreenshot(`drawn-polygon-ui-${locale}.png`, {
        mask: [

          page.locator('.leaflet-tile-pane'),
          page.locator('.leaflet-control-attribution')
        ],
        fullPage: true,
      });
    });

    test('Generated Route UI State', async ({ page }) => {
      await page.evaluate(() => {
        const latlngs = [
          [41.387, 2.168],
          [41.387, 2.169],
          [41.388, 2.169]
        ];
        const layer = (window as any).L.polygon(latlngs);
        (window as any).map.fire('draw:created', { layerType: 'polygon', layer });
      });

      if (await page.locator('#mobile-generate-fab').isVisible()) {
        await page.locator('#mobile-generate-fab').click();
      } else {
        await page.locator('#generate-btn').click();
      }

      const resultsPanel = page.locator('#results-panel');
      await expect(resultsPanel).toBeVisible({ timeout: 30000 });

      await expect(page).toHaveScreenshot(`generated-route-ui-${locale}.png`, {
        mask: [

          page.locator('.leaflet-tile-pane'),
          page.locator('.leaflet-control-attribution')
        ],
        fullPage: true,
      });
    });
  });
}
