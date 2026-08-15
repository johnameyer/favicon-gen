import { expect, test } from '@playwright/test';

test('recoloring a color group updates the canvas preview and download still works', async ({ page }) => {
  await page.goto('/');

  // Wait for the initial placeholder emoji to finish loading.
  const loading = page.locator('[data-testid="canvas-preview-loading"]');
  await expect(loading).toBeHidden({ timeout: 15000 });

  // Search for/select the car emoji so we're recoloring a real multi-color SVG.
  const search = page.locator('[data-testid="emoji-picker-search"]');
  await search.fill('car');

  const grid = page.locator('[data-testid="emoji-picker-grid"]');
  await expect(grid).toBeVisible();

  const firstResult = page.locator('.emoji-picker-item').first();
  await firstResult.click();

  await expect(page.locator('[data-testid="selection-loading"]')).toBeHidden({ timeout: 15000 });

  const canvas = page.locator('app-canvas-preview canvas');
  await expect(canvas).toBeVisible();

  const readPixels = () =>
    canvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d')!;
      return Array.from(ctx.getImageData(0, 0, el.width, el.height).data);
    });

  // Recolor panel should show at least one suggested color group.
  const groups = page.locator('[data-testid="recolor-group"]');
  await expect(groups.first()).toBeVisible({ timeout: 15000 });

  const beforePixels = await readPixels();

  const firstPicker = groups.first().locator('[data-testid="recolor-group-picker"]');
  await firstPicker.evaluate((el: HTMLInputElement) => {
    el.value = '#00FF00';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

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

  // Reset should be available and restore the swatch to its original color.
  await page.locator('[data-testid="recolor-reset"]').click();

  // Download should still work after recoloring.
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

test('splitting a color group breaks it into individual single-color groups', async ({ page }) => {
  await page.goto('/');

  const loading = page.locator('[data-testid="canvas-preview-loading"]');
  await expect(loading).toBeHidden({ timeout: 15000 });

  const search = page.locator('[data-testid="emoji-picker-search"]');
  await search.fill('car');
  await expect(page.locator('[data-testid="emoji-picker-grid"]')).toBeVisible();
  await page.locator('.emoji-picker-item').first().click();
  await expect(page.locator('[data-testid="selection-loading"]')).toBeHidden({ timeout: 15000 });

  const groups = page.locator('[data-testid="recolor-group"]');
  await expect(groups.first()).toBeVisible({ timeout: 15000 });

  const countBefore = await groups.count();

  const splitButton = page.locator('[data-testid="recolor-group-split"]').first();
  await expect(splitButton).toBeVisible();
  await splitButton.click();

  await expect(async () => {
    const countAfter = await groups.count();
    expect(countAfter).toBeGreaterThan(countBefore);
  }).toPass({ timeout: 5000 });
});

test('a gradient-based emoji (grinning face) shows its gradient colors as recolorable swatches', async ({ page }) => {
  await page.goto('/');

  const loading = page.locator('[data-testid="canvas-preview-loading"]');
  await expect(loading).toBeHidden({ timeout: 15000 });

  // The grinning face's yellow skin is defined via a <radialGradient>/<stop
  // style="stop-color:...">, not a flat fill - this exercises the gradient
  // stop-color extraction path, not just plain fill/stroke.
  const search = page.locator('[data-testid="emoji-picker-search"]');
  await search.fill('grinning');
  await expect(page.locator('[data-testid="emoji-picker-grid"]')).toBeVisible();
  await page.locator('.emoji-picker-item').first().click();
  await expect(page.locator('[data-testid="selection-loading"]')).toBeHidden({ timeout: 15000 });

  const groups = page.locator('[data-testid="recolor-group"]');
  await expect(groups.first()).toBeVisible({ timeout: 15000 });
  expect(await groups.count()).toBeGreaterThan(0);

  // The gradient yellows (#FDE030/#F7C02B/#F4A223, close in hue to the
  // face's dark-brown outline shades) should show up as member colors
  // somewhere in the panel - expand every multi-color group and collect
  // member labels.
  const expandButtons = page.locator('[data-testid="recolor-group-expand"]');
  const expandCount = await expandButtons.count();
  for (let i = 0; i < expandCount; i++) {
    await expandButtons.nth(i).click();
  }

  const memberLabels = await page.locator('[data-testid="recolor-member"]').allTextContents();
  const gradientYellows = ['#FDE030', '#F7C02B', '#F4A223'];
  expect(gradientYellows.some((hex) => memberLabels.some((label) => label.includes(hex)))).toBe(true);
});

test('expanding a group and setting an individual member override recolors that shade independently on the canvas', async ({
  page,
}) => {
  await page.goto('/');

  const loading = page.locator('[data-testid="canvas-preview-loading"]');
  await expect(loading).toBeHidden({ timeout: 15000 });

  const search = page.locator('[data-testid="emoji-picker-search"]');
  await search.fill('car');
  await expect(page.locator('[data-testid="emoji-picker-grid"]')).toBeVisible();
  await page.locator('.emoji-picker-item').first().click();
  await expect(page.locator('[data-testid="selection-loading"]')).toBeHidden({ timeout: 15000 });

  const canvas = page.locator('app-canvas-preview canvas');
  await expect(canvas).toBeVisible();

  const readPixels = () =>
    canvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d')!;
      return Array.from(ctx.getImageData(0, 0, el.width, el.height).data);
    });

  const groups = page.locator('[data-testid="recolor-group"]');
  await expect(groups.first()).toBeVisible({ timeout: 15000 });

  // Find a multi-color group (has a Split/expand button) to exercise the
  // per-member override path.
  const multiColorGroup = groups.filter({ has: page.locator('[data-testid="recolor-group-expand"]') }).first();
  await expect(multiColorGroup).toBeVisible();

  await multiColorGroup.locator('[data-testid="recolor-group-expand"]').click();
  const members = multiColorGroup.locator('xpath=following-sibling::ul[1]//*[@data-testid="recolor-member"]');
  await expect(members.first()).toBeVisible();

  const beforePixels = await readPixels();

  // Set the group-level picker to one color, then override just the second
  // member with a distinctly different color.
  const groupPicker = multiColorGroup.locator('[data-testid="recolor-group-picker"]');
  await groupPicker.evaluate((el: HTMLInputElement) => {
    el.value = '#00FF00';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

  const memberPicker = members.nth(1).locator('[data-testid="recolor-member-picker"]');
  await memberPicker.evaluate((el: HTMLInputElement) => {
    el.value = '#FF00FF';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

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

  // The member's own picker should reflect its override, independent of the
  // group-level picker's value.
  await expect(memberPicker).toHaveJSProperty('value', '#ff00ff');
  const clearButton = members.nth(1).locator('[data-testid="recolor-member-clear"]');
  await expect(clearButton).toBeVisible();
});
