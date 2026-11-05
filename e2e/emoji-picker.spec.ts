import { expect, test } from '@playwright/test';
import { waitForPreviewLoaded, waitForSelectionLoaded } from './helpers';

test('searching and selecting an emoji updates the canvas preview and download still works', async ({
  page,
}) => {
  await page.goto('/');

  // Wait for the initial placeholder emoji to finish loading.
  await waitForPreviewLoaded(page);

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
  await waitForSelectionLoaded(page);

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
    page.getByRole('button', { name: 'Download bundle (.zip)' }).click(),
  ]);

  expect(download.suggestedFilename()).toBe('favicon-package.zip');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  const bytes = Buffer.concat(chunks);
  expect(bytes.length).toBeGreaterThan(0);
});

test('searching "car" surfaces car emoji via keyword search', async ({ page }) => {
  await page.goto('/');

  const search = page.locator('[data-testid="emoji-picker-search"]');
  await search.fill('car');

  const grid = page.locator('[data-testid="emoji-picker-grid"]');
  await expect(grid).toBeVisible();

  const items = page.locator('.emoji-picker-item');
  await expect(items).not.toHaveCount(0);

  const emojiTexts = await items.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label')));
  expect(emojiTexts.some((label) => label?.toLowerCase().includes('automobile'))).toBe(true);
});

test('a search with no matches shows the empty state', async ({ page }) => {
  await page.goto('/');

  const search = page.locator('[data-testid="emoji-picker-search"]');
  await search.fill('zzzzzznotanemoji');

  await expect(page.locator('[data-testid="emoji-picker-no-results"]')).toBeVisible();
});

// One emoji per CDN path scheme, including the cases that have broken before:
// zero-padded keycaps, flag ZWJ sequences, and regional-indicator flags.
for (const [search, label] of [
  ['keycap_1', 'keycap 1'],
  ['rainbow_flag', 'rainbow flag'],
  ['flag_japan', 'flag japan'],
]) {
  test(`selecting "${label}" loads it into the preview`, async ({ page }) => {
    await page.goto('/');
    await waitForPreviewLoaded(page);

    const canvas = page.locator('app-canvas-preview canvas');
    const readPixels = () =>
      canvas.evaluate((el: HTMLCanvasElement) =>
        Array.from(el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data),
      );
    const beforePixels = await readPixels();

    await page.locator('[data-testid="emoji-picker-search"]').fill(search);
    await page.getByRole('button', { name: label, exact: true }).first().click();
    await waitForSelectionLoaded(page);

    await expect
      .poll(async () => {
        const afterPixels = await readPixels();
        return afterPixels.some((value, index) => value !== beforePixels[index]);
      })
      .toBe(true);
  });
}
