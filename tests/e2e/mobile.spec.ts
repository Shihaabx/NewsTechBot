import { expect, test } from '@playwright/test';

test('dashboard remains usable on a phone-sized viewport', async ({ page }) => {
  await page.goto('/');
  await page.locator('#tokenInput').fill('test-dashboard-token-1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#loginOverlay')).toBeHidden();

  await expect(page.locator('.sidebar')).toBeVisible();

  await page.locator('[data-view="sources"]').click();
  await expect(page.locator('#pageTitle')).toHaveText('Sources');
  await page.locator('#addSourceBtn').click();
  await expect(page.locator('#sourceModal')).toBeVisible();
  await page.locator('#closeSourceModal').click();

  await page.locator('[data-view="system"]').click();
  await expect(page.locator('#pollInterval')).toBeVisible();

  await page.locator('[data-view="brand"]').click();
  await expect(page.locator('#brandPreview')).toBeVisible();
});
