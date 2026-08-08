import { expect, test } from '@playwright/test';

test('app shell loads', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Favicon/);
  await expect(page.locator('app-root')).toBeVisible();
});

test('canvas preview renders', async ({ page }) => {
  await page.goto('/');

  const canvas = page.locator('app-canvas-preview canvas');
  await expect(canvas).toBeVisible();

  const size = await canvas.evaluate((el: HTMLCanvasElement) => ({
    width: el.width,
    height: el.height,
  }));
  expect(size.width).toBeGreaterThan(0);
  expect(size.height).toBeGreaterThan(0);

  // The canvas should have non-transparent pixels once the emoji layer has
  // finished drawing (jsdom can't do this — this is a real browser check).
  const hasDrawnPixels = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')!;
    const { data } = ctx.getImageData(0, 0, el.width, el.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) {
        return true;
      }
    }
    return false;
  });
  expect(hasDrawnPixels).toBe(true);
});
