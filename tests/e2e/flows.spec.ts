import { test, expect } from '@playwright/test';

test.describe('App E2E Flows', () => {
  test.beforeEach(async ({ page, context }) => {
    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    } catch (e) {
      // WebKit doesn't support clipboard permissions this way, ignore
    }
  });

  test('Flow 1: Cycling path generation and share', async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    await page.goto('/');

    // 1. Choose cycling
    const sportSelect = page.locator('#sport-select');
    await sportSelect.selectOption('bike');

    // 2. Manually draw a polygon (programmatically simulate Leaflet event for reliability)
    await page.evaluate(() => {
      const latlngs = [
        [41.387, 2.168],
        [41.387, 2.169],
        [41.388, 2.169]
      ];
      const layer = (window as any).L.polygon(latlngs);
      (window as any).map.fire('draw:created', { layerType: 'polygon', layer });
    });

    // 3. Generate path and check results
    if (await page.locator('#mobile-generate-btn').isVisible()) {
      await page.locator('#mobile-generate-btn').click();
    } else {
      await page.locator('#generate-btn').click();
    }
    
    // Wait for the results panel to appear and distance to be calculated
    const resultsPanel = page.locator('#results-panel');
    await expect(resultsPanel).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#result-distance')).not.toContainText('-- km');
    await expect(page.locator('#result-time')).not.toContainText('--:--');

    // 4. Click share, get the url
    let dialogMessage = '';
    page.on('dialog', dialog => {
      dialogMessage = dialog.message();
      console.log('Dialog:', dialogMessage);
      dialog.accept();
    });

    // Disable native share and mock clipboard to avoid WebKit permission issues
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      (window as any).__mockClipboard = '';
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text: string) => { (window as any).__mockClipboard = text; },
          readText: async () => (window as any).__mockClipboard
        },
        configurable: true
      });
    });
    
    await page.locator('#share-btn').click();
    
    // Wait for clipboard alert
    await expect.poll(() => dialogMessage).toBe('Route link copied to clipboard!');

    // Get the URL from mock clipboard
    const clipboardText = await page.evaluate(() => (window as any).__mockClipboard);
    expect(clipboardText).toContain('?route=');
    expect(clipboardText).toContain('mode=bike');
  });

  test('Flow 2: Walking path generation and opening shared URL', async ({ page }) => {
    await page.goto('/');

    // 1. Choose walking
    const sportSelect = page.locator('#sport-select');
    await sportSelect.selectOption('walk');

    // 2. Manually draw a polygon
    await page.evaluate(() => {
      const latlngs = [
        [41.387, 2.168],
        [41.387, 2.169],
        [41.388, 2.169]
      ];
      const layer = (window as any).L.polygon(latlngs);
      (window as any).map.fire('draw:created', { layerType: 'polygon', layer });
    });

    // 3. Generate path
    if (await page.locator('#mobile-generate-btn').isVisible()) {
      await page.locator('#mobile-generate-btn').click();
    } else {
      await page.locator('#generate-btn').click();
    }
    
    // Wait for the results
    const resultsPanel = page.locator('#results-panel');
    await expect(resultsPanel).toBeVisible({ timeout: 30000 });
    
    // 4. Share and get the URL
    let dialogMessage = '';
    page.on('dialog', dialog => {
      dialogMessage = dialog.message();
      console.log('Dialog:', dialogMessage);
      dialog.accept();
    });

    // Disable native share and mock clipboard
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      (window as any).__mockClipboard = '';
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text: string) => { (window as any).__mockClipboard = text; },
          readText: async () => (window as any).__mockClipboard
        },
        configurable: true
      });
    });

    await page.locator('#share-btn').click();
    await expect.poll(() => dialogMessage).toBe('Route link copied to clipboard!');

    const sharedUrl = await page.evaluate(() => (window as any).__mockClipboard);
    expect(sharedUrl).toContain('mode=walk');

    // 5. Open the shared URL and verify parsing
    await page.goto(sharedUrl);

    // Assert that the UI correctly parsed the shared state
    await expect(page.locator('#shared-notice')).toBeVisible();
    await expect(page.locator('#results-panel')).toBeVisible();
    await expect(page.locator('#sport-tag')).toHaveText('Walk');
    
    // The share button should be hidden in shared view
    await expect(page.locator('#share-btn')).toBeHidden();
  });
});
