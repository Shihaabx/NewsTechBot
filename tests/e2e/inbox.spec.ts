import { expect, test } from '@playwright/test';

test('editor can review, filter, publish and reject news without Discord commands', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('/');
  await page.locator('#tokenInput').fill('test-dashboard-token-1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#loginOverlay')).toBeHidden();

  await page.locator('[data-view="inbox"]').click();
  await expect(page.locator('#pageTitle')).toHaveText('News Inbox');
  await expect(page.locator('#inboxList .inbox-item')).toHaveCount(3);
  await expect(page.locator('#inboxMetrics .pending strong')).toHaveText('2');
  await page.locator('#inboxSearch').fill('NVIDIA');
  await expect(page.locator('#inboxList .inbox-item')).toHaveCount(1);
  await page.locator('#inboxSearch').fill('');
  await page.locator('#inboxStatus').selectOption('filtered');
  await expect(page.locator('#inboxList')).toContainText('Phone launch outside channel coverage');
  await expect(page.locator('#inboxList [data-inbox-action]')).toHaveCount(0);
  await page.locator('#inboxStatus').selectOption('all');

  await page.locator('[data-view="system"]').click();
  await page.locator('#dryRun').check();
  await page.locator('#saveSystemBtn').click();
  await expect(page.locator('#toast')).toContainText('System settings saved');
  await page.locator('[data-view="inbox"]').click();
  await expect(page.locator('[data-inbox-id="aaaaaaaaaaaaaaaaaaaaaaaa"][data-inbox-action="publish"]')).toBeDisabled();

  await page.locator('[data-view="system"]').click();
  await page.locator('#dryRun').uncheck();
  await page.locator('#saveSystemBtn').click();
  await page.locator('[data-view="inbox"]').click();

  await page.locator('[data-inbox-id="aaaaaaaaaaaaaaaaaaaaaaaa"][data-inbox-action="publish"]').click();
  await expect(page.locator('#toast')).toContainText('Story published to Discord');
  await expect(page.locator('#inboxMetrics .published strong')).toHaveText('1');

  await page.locator('[data-inbox-id="bbbbbbbbbbbbbbbbbbbbbbbb"][data-inbox-action="reject"]').click();
  await expect(page.locator('#confirmOverlay')).toBeVisible();
  await page.locator('#confirmOk').click();
  await expect(page.locator('#toast')).toContainText('Story rejected');
  await expect(page.locator('#inboxMetrics .rejected strong')).toHaveText('1');

  await page.reload();
  await page.locator('[data-view="inbox"]').click();
  await expect(page.locator('#inboxMetrics .pending strong')).toHaveText('0');
  expect(errors).toEqual([]);
});
