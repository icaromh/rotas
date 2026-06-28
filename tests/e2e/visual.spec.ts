import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test('Initial Load UI', async ({ page }) => {
    await page.goto('/');
    
    // Wait for Leaflet to initialize the map and draw controls
    await page.waitForSelector('.leaflet-draw-toolbar');
    
    // Take a screenshot of the UI, masking the dynamic map background
    await expect(page).toHaveScreenshot('initial-ui.png', {
      mask: [page.locator('.leaflet-map-pane')],
      fullPage: true,
    });
  });

  test('Settings Modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.leaflet-draw-toolbar');

    // Open settings modal
    await page.locator('#settings-btn').click();
    
    // Wait for the modal to be visible
    const settingsModal = page.locator('#preferences-modal');
    await expect(settingsModal).toBeVisible();

    // Take screenshot of the modal overlay
    await expect(page).toHaveScreenshot('settings-modal.png', {
      mask: [page.locator('.leaflet-map-pane')],
      fullPage: true,
    });
  });

  test('Drawn Polygon UI State', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.leaflet-draw-toolbar');

    // Programmatically draw a polygon to reveal the edit/delete tools
    await page.evaluate(() => {
      const latlngs = [
        [41.387, 2.168],
        [41.387, 2.169],
        [41.388, 2.169]
      ];
      const layer = (window as any).L.polygon(latlngs);
      (window as any).map.fire('draw:created', { layerType: 'polygon', layer });
    });

    // Take screenshot
    await expect(page).toHaveScreenshot('drawn-polygon-ui.png', {
      mask: [
        page.locator('.leaflet-map-pane'), 
      ],
      fullPage: true,
    });
  });
});
