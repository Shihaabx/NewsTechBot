import { expect, test } from '@playwright/test';

const unlock = async (page: any) => {
  await page.goto('/');
  await expect(page.locator('#loginOverlay')).toBeVisible();
  await page.locator('#tokenInput').fill('test-dashboard-token-1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#loginOverlay')).toBeHidden();
};

test('user can operate overview, sources and filters', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await unlock(page);
  await expect(page.locator('#pageTitle')).toHaveText('Overview');
  await expect(page.locator('#metricSources')).toHaveText('1');

  await page.locator('#refreshStatus').click();
  await page.locator('#pollNowTop').click();
  await expect(page.locator('#toast')).toContainText('Poll completed: 2 published');
  await expect(page.locator('#metricPublished')).toHaveText('2');

  await page.locator('#pauseTop').click();
  await expect(page.locator('#sidebarStatus')).toHaveText('Paused');
  await page.locator('#overviewPause').click();
  await expect(page.locator('#sidebarStatus')).toHaveText('Online');

  await page.locator('#overviewPoll').click();
  await expect(page.locator('#toast')).toContainText('Poll completed: 2 published');
  await page.locator('#overviewTest').click();
  await expect(page.locator('#toast')).toContainText('Test card sent to Discord');

  await page.locator('button[data-go="sources"]').click();
  await expect(page.locator('#pageTitle')).toHaveText('Sources');

  await page.locator('#addSourceBtn').click();
  await page.locator('#closeSourceModal').click();
  await expect(page.locator('#sourceModal')).toBeHidden();

  await page.locator('#addSourceBtn').click();
  await page.locator('#sourceName').fill('Tom Hardware');
  await page.locator('#sourceUrl').fill('https://example.com/feed.xml');
  await page.locator('#sourceCategory').selectOption('pc-hardware');
  await page.locator('#sourceTrust').fill('84');
  await page.locator('#sourceOfficial').check();
  await page.locator('#testSourceBtn').click();
  await expect(page.locator('#sourceTestResult')).toContainText('Feed works');
  await page.locator('#sourceForm button[type="submit"]').click();
  await expect(page.locator('#sourcesBody')).toContainText('Tom Hardware');

  await page.locator('#sourceSearch').fill('Tom');
  await expect(page.locator('#sourcesBody tr')).toHaveCount(1);
  await page.locator('#sourceSearch').fill('');

  const toggle = page.locator('[data-source-toggle="tom-hardware"]');
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();

  await page.locator('[data-source-edit="tom-hardware"]').click();
  await page.locator('#sourceTrust').fill('91');
  await page.locator('#sourceForm button[type="submit"]').click();
  await expect(page.locator('#sourcesBody')).toContainText('91');

  await page.locator('[data-source-delete="tom-hardware"]').click();
  await page.locator('#confirmCancel').click();
  await expect(page.locator('#sourcesBody')).toContainText('Tom Hardware');
  await page.locator('[data-source-delete="tom-hardware"]').click();
  await page.locator('#confirmOk').click();
  await expect(page.locator('#sourcesBody')).not.toContainText('Tom Hardware');

  await page.locator('[data-view="filters"]').click();
  await page.locator('#blockedTopics').fill('iphone\nphone\nmobile');
  await page.locator('#highValueTerms').fill('release\nbenchmark\nrtx');
  await page.locator('[data-category-rules="ai"]').fill('openai\nai model\nagent');
  await page.locator('#saveFiltersBtn').click();
  await expect(page.locator('#toast')).toContainText('News filters saved');

  expect(errors).toEqual([]);
});
