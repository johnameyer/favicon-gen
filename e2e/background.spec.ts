import { expect, test } from '@playwright/test';
import { waitForPreviewLoaded } from './helpers';

/** RGBA of the preview canvas's top-left-ish pixel: outside a circle, inside a rounded square's edge. */
const pixelAt = (page: import('@playwright/test').Page, x: number, y: number) =>
  page
    .locator('app-canvas-preview canvas')
    .evaluate(
      (el: HTMLCanvasElement, [px, py]) =>
        Array.from(el.getContext('2d')!.getImageData(px, py, 1, 1).data),
      [x, y],
    );

test('the background is drawn behind the content and carries across source modes', async ({
  page,
}) => {
  await page.goto('/');
  await waitForPreviewLoaded(page);

  // Transparent by default.
  expect((await pixelAt(page, 128, 4))[3]).toBe(0);

  await page.locator('[data-testid="background-shape"]').selectOption('rounded-square');
  await page.locator('[data-testid="background-color"]').fill('#ff0000');
  // Near the top edge, outside the shrunken emoji but inside the square.
  await expect.poll(() => pixelAt(page, 128, 4)).toEqual([255, 0, 0, 255]);

  await page.locator('[data-testid="tab-letter"]').click();
  await expect(page.locator('[data-testid="background-shape"]')).toHaveValue('rounded-square');
  await expect.poll(() => pixelAt(page, 128, 4)).toEqual([255, 0, 0, 255]);

  // Bigger content covers more of the shape: fewer pure-red pixels show.
  const redPixels = () =>
    page.locator('app-canvas-preview canvas').evaluate((el: HTMLCanvasElement) => {
      const { data } = el.getContext('2d')!.getImageData(0, 0, el.width, el.height);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 0) count++;
      }
      return count;
    });
  await page.waitForTimeout(300);
  const redAtDefaultSize = await redPixels();
  await page.locator('[data-testid="background-content-size"]').evaluate((el: HTMLInputElement) => {
    el.value = '95';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(redPixels).toBeLessThan(redAtDefaultSize);

  await page.locator('[data-testid="background-shape"]').selectOption('none');
  await expect.poll(async () => (await pixelAt(page, 128, 4))[3]).toBe(0);
});

test('corner radius and gradient fills change the background', async ({ page }) => {
  await page.goto('/');
  await waitForPreviewLoaded(page);
  const slider = (testId: string, value: number) =>
    page.locator(`[data-testid="${testId}"]`).evaluate((el: HTMLInputElement, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);

  await page.locator('[data-testid="background-shape"]').selectOption('rounded-square');
  await page.locator('[data-testid="background-color"]').fill('#ff0000');

  // The very corner is outside the default rounded corner, but inside a sharp one.
  expect((await pixelAt(page, 1, 1))[3]).toBe(0);
  await slider('background-corner-radius', 0);
  await expect.poll(() => pixelAt(page, 1, 1)).toEqual([255, 0, 0, 255]);

  // A left-to-right gradient: the left edge stays the start color, the right edge becomes the end color.
  await page.locator('[data-testid="background-fill"]').selectOption('linear');
  await page.locator('[data-testid="background-color2"]').fill('#0000ff');
  await slider('background-angle', 90); // CSS convention: left-to-right
  // (Pixels just inside the edges are already slightly blended, hence the tolerance.)
  const mostlyRed = async () => {
    const [r, , b] = await pixelAt(page, 1, 128);
    return r > 240 && b < 15;
  };
  const mostlyBlue = async () => {
    const [r, , b] = await pixelAt(page, 254, 128);
    return b > 240 && r < 15;
  };
  await expect.poll(mostlyRed).toBe(true);
  await expect.poll(mostlyBlue).toBe(true);
});
