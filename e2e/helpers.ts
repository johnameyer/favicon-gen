import { Page, expect } from '@playwright/test';

/**
 * Waits for the initial placeholder emoji and asserts it actually rendered.
 * The loading indicator also disappears when the fetch *fails*, so waiting
 * for it alone let a broken emoji CDN go unnoticed.
 */
export async function waitForPreviewLoaded(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="canvas-preview-loading"]')).toBeHidden({
    timeout: 15000,
  });
  await expect(page.locator('[data-testid="canvas-preview-error"]')).toBeHidden();
  await expect(page.locator('app-canvas-preview canvas')).toBeVisible();
}

/** Waits for a picker-driven emoji selection and asserts it loaded without error. */
export async function waitForSelectionLoaded(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="selection-loading"]')).toBeHidden({ timeout: 15000 });
  await expect(page.locator('[data-testid="selection-error"]')).toBeHidden();
}

/**
 * Searches for and selects the emoji with exactly `label`, then waits until
 * the preview has redrawn with it. Waiting for the redraw matters: until
 * then the recolor panel can still show the previous emoji's groups, and a
 * test interacting with those races the swap.
 */
export async function selectEmoji(page: Page, search: string, label: string): Promise<void> {
  const canvas = page.locator('app-canvas-preview canvas');
  const readPixels = () =>
    canvas.evaluate((el: HTMLCanvasElement) =>
      Array.from(el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data),
    );
  const before = await readPixels();

  await page.locator('[data-testid="emoji-picker-search"]').fill(search);
  await page.getByRole('button', { name: label, exact: true }).first().click();
  await waitForSelectionLoaded(page);
  await expect
    .poll(async () => (await readPixels()).some((value, index) => value !== before[index]))
    .toBe(true);
}
