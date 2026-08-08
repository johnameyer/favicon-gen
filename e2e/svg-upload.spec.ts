import path from 'node:path';
import { expect, test } from '@playwright/test';

test('uploading a valid SVG updates the canvas preview and download still works', async ({ page }) => {
  await page.goto('/');

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

  await page.locator('[data-testid="tab-upload"]').click();

  const fileInput = page.locator('[data-testid="svg-upload-input"]');
  await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'sample.svg'));

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

test('uploading an invalid file shows an error instead of breaking the canvas', async ({ page }) => {
  await page.goto('/');

  const loading = page.locator('[data-testid="canvas-preview-loading"]');
  await expect(loading).toBeHidden({ timeout: 15000 });

  await page.locator('[data-testid="tab-upload"]').click();

  const fileInput = page.locator('[data-testid="svg-upload-input"]');
  await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'invalid.txt'));

  await expect(page.locator('[data-testid="svg-upload-error"]')).toBeVisible();

  // Canvas should still be present and unbroken (still showing the previous/placeholder content).
  const canvas = page.locator('app-canvas-preview canvas');
  await expect(canvas).toBeVisible();
});
