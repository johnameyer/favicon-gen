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

