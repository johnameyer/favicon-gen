import { expect, test } from '@playwright/test';

test('app shell loads', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Favicon/);
  await expect(page.locator('app-root')).toBeVisible();
});
