import { Page, expect, test } from '@playwright/test';
import { waitForPreviewLoaded } from './helpers';

// These load real fonts from Google Fonts, so they also cover the WOFF2 +
// Brotli axis-reading path against real font files.

const readPixels = (page: Page) =>
  page
    .locator('app-canvas-preview canvas')
    .evaluate((el: HTMLCanvasElement) =>
      Array.from(el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data),
    );

/**
 * Waits until the preview differs from `before`. The canvas draws each SVG
 * once, so a change also proves an embedded font was ready at draw time
 * (otherwise it'd stay on the fallback's pixels).
 */
const waitForChangeFrom = (page: Page, before: number[]) =>
  expect
    .poll(
      async () => {
        const after = await readPixels(page);
        return after.every((value, index) => value === before[index]) ? 'unchanged' : 'changed';
      },
      { timeout: 15000 },
    )
    .toBe('changed');

/** Opens the letter tab, which starts on sans-serif. */
async function openLetterTab(page: Page): Promise<void> {
  await page.goto('/');
  await waitForPreviewLoaded(page);
  await page.locator('[data-testid="tab-letter"]').click();
  await expect(page.locator('[data-testid="letter-font"]')).toHaveValue('sans-serif');
  // Let the first draw land before tests take "before" snapshots.
  await page.waitForTimeout(300);
}

/** Chooses "Custom URL…" and waits for the prefilled Roboto Flex to load and draw. */
async function chooseCustomFont(page: Page): Promise<void> {
  await page.locator('[data-testid="letter-font"]').selectOption('custom');
  await expect(page.locator('[data-testid="letter-axis-wght"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-testid="letter-font-error"]')).toBeHidden();
  await page.waitForTimeout(300);
}

/** Sets a range input's value the way a user drag would (fires `input`). */
async function setSlider(page: Page, testId: string, value: number): Promise<void> {
  await page.locator(`[data-testid="${testId}"]`).evaluate((el: HTMLInputElement, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function loadFontUrl(page: Page, url: string): Promise<void> {
  await page.locator('[data-testid="letter-font-url"]').fill(url);
  await page.locator('[data-testid="letter-font-load"]').click();
  await expect(page.locator('[data-testid="letter-font-loading"]')).toBeHidden({ timeout: 15000 });
  await expect(page.locator('[data-testid="letter-font-error"]')).toBeHidden();
}

test('typing a letter generates a favicon and download still works', async ({ page }) => {
  await page.goto('/');
  await waitForPreviewLoaded(page);
  const emojiPixels = await readPixels(page);

  await page.locator('[data-testid="tab-letter"]').click();
  await waitForChangeFrom(page, emojiPixels);

  // The letter tab has its own color picker, so the recolor panel is hidden.
  await expect(page.locator('app-recolor-panel')).toHaveCount(0);

  await page.waitForTimeout(300);
  const letterAPixels = await readPixels(page);
  await page.locator('[data-testid="letter-input"]').fill('W');
  await waitForChangeFrom(page, letterAPixels);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download bundle (.zip)' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('favicon-package.zip');
});

test('choosing Custom URL loads Roboto Flex with a slider for every axis', async ({ page }) => {
  await openLetterTab(page);
  const sansSerif = await readPixels(page);
  await chooseCustomFont(page);
  await waitForChangeFrom(page, sansSerif);

  await expect(page.locator('[data-testid="letter-font-url"]')).toHaveValue(
    /family=Roboto\+Flex:opsz,slnt,wdth,wght,GRAD,XOPQ,XTRA,YOPQ,YTAS,YTDE,YTFI,YTLC,YTUC@/,
  );
  for (const tag of ['opsz', 'slnt', 'wdth', 'wght', 'GRAD', 'XOPQ', 'YTUC', 'YTFI']) {
    await expect(page.locator(`[data-testid="letter-axis-${tag}"]`)).toBeVisible();
  }
  // YTUC is flagged hidden (parametric) in Roboto Flex's fvar; it's still offered, by name.
  const ytuc = page.locator('[data-testid="letter-axis-YTUC"]');
  await expect(page.locator('label', { has: ytuc })).toContainText('Uppercase height');
  // The wght axis replaces the generic weight slider, starting at the default bold.
  await expect(page.locator('[data-testid="letter-weight"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="letter-axis-wght"]')).toHaveValue('700');

  for (const [axis, value] of [
    ['wght', 100],
    ['wdth', 25],
    ['YTUC', 528],
  ] as const) {
    await page.waitForTimeout(300);
    const before = await readPixels(page);
    await setSlider(page, `letter-axis-${axis}`, value);
    await waitForChangeFrom(page, before);
  }
});

test('italic changes the letter, for generic and custom fonts', async ({ page }) => {
  await openLetterTab(page);
  let before = await readPixels(page);
  await page.locator('[data-testid="letter-italic"]').check();
  await waitForChangeFrom(page, before);

  await chooseCustomFont(page);
  await page.locator('[data-testid="letter-italic"]').uncheck();
  await page.waitForTimeout(300);
  before = await readPixels(page);
  await page.locator('[data-testid="letter-italic"]').check();
  await waitForChangeFrom(page, before);
});

test('a static custom font is embedded and drawn, with the generic weight slider', async ({
  page,
}) => {
  await openLetterTab(page);
  await chooseCustomFont(page);
  const before = await readPixels(page);
  await loadFontUrl(page, 'https://fonts.googleapis.com/css2?family=Pacifico');
  await waitForChangeFrom(page, before);
  await expect(page.locator('[data-testid="letter-weight"]')).toBeVisible();
  await expect(page.locator('[data-testid="letter-axis-wght"]')).toHaveCount(0);
});

test('generic fonts have a weight slider that changes the letter', async ({ page }) => {
  await openLetterTab(page);

  const before = await readPixels(page);
  await setSlider(page, 'letter-weight', 100);
  await waitForChangeFrom(page, before);
});

test('an unreachable font URL shows an error', async ({ page }) => {
  await page.route('https://fonts.example.invalid/**', (route) => route.abort());
  await openLetterTab(page);
  await chooseCustomFont(page);
  await page
    .locator('[data-testid="letter-font-url"]')
    .fill('https://fonts.example.invalid/a.woff2');
  await page.locator('[data-testid="letter-font-load"]').click();
  await expect(page.locator('[data-testid="letter-font-error"]')).toContainText('cross-origin');
});
