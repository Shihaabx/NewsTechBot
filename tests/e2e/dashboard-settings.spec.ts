import { expect, test } from '@playwright/test';

const unlock = async (page: any) => {
  await page.goto('/');
  await page.locator('#tokenInput').fill('test-dashboard-token-1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#loginOverlay')).toBeHidden();
};

test('user can operate Discord, system, brand and session controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await unlock(page);

  await page.locator('[data-view="discord"]').click();
  await expect(page.locator('#pageTitle')).toHaveText('Discord');
  await expect(page.locator('#discordBotName')).toHaveText('NewsTech');
  await page.locator('[data-channel-input="incoming"]').fill('333333333333333');
  await page.locator('[data-channel-input="videoIdeas"]').fill('444444444444444');
  await page.locator('[data-channel-input="usedNews"]').fill('555555555555555');
  await page.locator('#saveDiscordBtn').click();
  await expect(page.locator('#toast')).toContainText('Discord channels saved');

  await page.locator('#refreshDiscordBtn').click();
  await expect(page.locator('#toast')).toContainText('Discord connection refreshed');
  await page.locator('#sendTestBtn').click();
  await expect(page.locator('#toast')).toContainText('Test card sent to Discord');

  await page.locator('[data-view="system"]').click();
  await expect(page.locator('#pageTitle')).toHaveText('System');
  await page.locator('#pollInterval').fill('7');
  await page.locator('#maxItems').fill('9');
  await page.locator('#maxAge').fill('48');
  await page.locator('#newsMinScore').fill('62');
  await page.locator('#breakingMinScore').fill('86');
  await page.locator('#allowedUsers').fill('666666666666666\n777777777777777');
  await page.locator('#dryRun').check();
  await page.locator('#saveSystemBtn').click();
  await expect(page.locator('#toast')).toContainText('System settings saved');

  await page.locator('#newsMinScore').fill('90');
  await page.locator('#breakingMinScore').fill('80');
  await page.locator('#saveSystemBtn').click();
  await expect(page.locator('#toast')).toContainText('greater than or equal');
  // Chrome logs the intentionally rejected HTTP 400 as a console network error.
  // The validation toast above proves the UI handled it correctly.
  while (errors.some((entry) => entry.includes('status of 400'))) {
    errors.splice(errors.findIndex((entry) => entry.includes('status of 400')), 1);
  }
  await page.locator('#newsMinScore').fill('62');
  await page.locator('#breakingMinScore').fill('86');
  await page.locator('#saveSystemBtn').click();

  await page.locator('#clearHistoryBtn').click();
  await page.locator('#confirmCancel').click();
  await page.locator('#clearHistoryBtn').click();
  await page.locator('#confirmOk').click();
  await expect(page.locator('#toast')).toContainText('Duplicate history cleared');

  await page.locator('[data-view="brand"]').click();
  await expect(page.locator('#pageTitle')).toHaveText('Brand');
  await page.locator('#logoFile').setInputFiles({
    name: 'newstech-test.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZL6kAAAAASUVORK5CYII=', 'base64'),
  });
  await page.locator('#uploadLogoBtn').click();
  await expect(page.locator('#toast')).toContainText('Logo uploaded');

  await page.locator('#applyIdentityBtn').click();
  await expect(page.locator('#toast')).toContainText('Discord bot identity updated');

  await page.locator('#resetLogoBtn').click();
  await page.locator('#confirmOk').click();
  await expect(page.locator('#toast')).toContainText('Default NewsTech logo restored');

  for (const [view, title] of [
    ['overview','Overview'],
    ['sources','Sources'],
    ['filters','Filters'],
    ['discord','Discord'],
    ['system','System'],
    ['brand','Brand'],
  ] as const) {
    await page.locator('[data-view="' + view + '"]').click();
    await expect(page.locator('#pageTitle')).toHaveText(title);
  }

  await page.locator('#logoutBtn').click();
  await expect(page.locator('#loginOverlay')).toBeVisible();
  await page.locator('#tokenInput').fill('test-dashboard-token-1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#loginOverlay')).toBeHidden();

  expect(errors).toEqual([]);
});
