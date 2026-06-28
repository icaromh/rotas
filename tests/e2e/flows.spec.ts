import { test, expect } from '@playwright/test';

test.describe('App E2E Flows', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant clipboard permissions for share fallback
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
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
    await page.locator('#generate-btn').click();
    
    // Wait for the results panel to appear and distance to be calculated
    const resultsPanel = page.locator('#results-panel');
    await expect(resultsPanel).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#result-distance')).not.toContainText('-- km');
    await expect(page.locator('#result-time')).not.toContainText('--:--');

    // 4. Click share, get the url
    let dialogMessage = '';
    page.on('dialog', dialog => {
      dialogMessage = dialog.message();
      console.log('Dialog:', dialogMessage);
      dialog.accept();
    });

    await page.locator('#share-btn').click();
    
    // Wait for clipboard alert
    await expect.poll(() => dialogMessage).toBe('Link da rota copiado para a área de transferência!');

    // Get the URL from clipboard
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
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
    await page.locator('#generate-btn').click();
    
    // Wait for the results
    const resultsPanel = page.locator('#results-panel');
    await expect(resultsPanel).toBeVisible({ timeout: 15000 });
    
    // 4. Share and get the URL
    let dialogMessage = '';
    page.on('dialog', dialog => {
      dialogMessage = dialog.message();
      console.log('Dialog:', dialogMessage);
      dialog.accept();
    });

    await page.locator('#share-btn').click();
    await expect.poll(() => dialogMessage).toBe('Link da rota copiado para a área de transferência!');

    const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
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
