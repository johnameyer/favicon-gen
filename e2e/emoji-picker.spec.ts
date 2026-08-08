import { expect, test } from '@playwright/test';

test('searching and selecting an emoji updates the canvas preview and download still works', async ({
  page,
}) => {
  await page.goto('/');

  // Wait for the initial placeholder emoji to finish loading.
  const loading = page.locator('[data-testid="canvas-preview-loading"]');
  await expect(loading).toBeHidden({ timeout: 15000 });

  const canvas = page.locator('app-canvas-preview canvas');
  await expect(canvas).toBeVisible();

  const readPixels = () =>
    canvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d')!;
      return Array.from(ctx.getImageData(0, 0, el.width, el.height).data);
    });

  const beforePixels = await readPixels();

  const search = page.locator('[data-testid="emoji-picker-search"]');
  await search.fill('heart');

  const grid = page.locator('[data-testid="emoji-picker-grid"]');
  await expect(grid).toBeVisible();

  const firstResult = page.locator('.emoji-picker-item').first();
  await firstResult.click();

  // Wait for the picker-driven fetch to resolve and the canvas to update.
  await expect(page.locator('[data-testid="selection-loading"]')).toBeHidden({ timeout: 15000 });

  await expect
    .poll(
      async () => {
        const afterPixels = await readPixels();
        return afterPixels.length === beforePixels.length &&
          afterPixels.every((value, index) => value === beforePixels[index])
          ? 'unchanged'
          : 'changed';
      },
      { timeout: 15000 },
    )
    .toBe('changed');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download favicon.ico' }).click(),
  ]);

  expect(download.suggestedFilename()).toBe('favicon.ico');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  const bytes = Buffer.concat(chunks);
  expect(bytes.length).toBeGreaterThan(0);
});

test('a search with no matches shows the empty state', async ({ page }) => {
  await page.goto('/');

  const search = page.locator('[data-testid="emoji-picker-search"]');
  await search.fill('zzzzzznotanemoji');

  await expect(page.locator('[data-testid="emoji-picker-no-results"]')).toBeVisible();
});
