import { test, expect } from './fixtures';
import { openBrowserWheel, clickWheelLabel, exactLabel } from './utils';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
});

/**
 * Stage 7's "Extend into 4D": the detail drawer offers exactly ONE "View
 * 4D" toggle everywhere (never two competing buttons, and never a
 * shape-specific label -- simplest possible UX, decided per-shape
 * automatically) that shows radial projection (the real, closed regular
 * 4-polytope: tesseract/16-cell/24-cell/120-cell) for the 4
 * FOURD_CAPABLE shapes, and falls back to the duoprism reference view
 * (tests/e2e/duoprism.spec.ts's own "View 4D" test) for every other
 * shape, since only the 4 FOURD_CAPABLE shapes have a verified theta for
 * radial projection's closure at all.
 */
test('a FOURD_CAPABLE shape (dodecahedron) shows the real 120-cell radial projection under "View 4D"', async ({ page }) => {
  await page.getByRole('button', { name: /^Start over with/ }).click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, exactLabel('Platonic'));

  const card = page.locator('text=/^dodecahedron$/i').first();
  await card.scrollIntoViewIfNeeded();
  await card.click();

  const drawer = page.getByRole('dialog', { name: 'dodecahedron' });
  // Exactly one 4D toggle, same label as every other shape gets.
  await expect(drawer.getByRole('button', { name: 'View 4D' })).toBeVisible();

  await drawer.getByRole('button', { name: 'View 4D' }).click();
  await expect(drawer.getByLabel('Draggable 4D radial cell projection preview')).toBeVisible();
  // The real 120-cell: 120 dodecahedral cells, not a 2-cap duoprism.
  await expect(drawer.locator('text=/120 cells/')).toBeVisible();

  await drawer.getByRole('button', { name: 'Hide 4D' }).click();
  await expect(drawer.getByLabel('Draggable 4D radial cell projection preview')).toHaveCount(0);
});

/**
 * The other 3 FOURD_CAPABLE shapes each get their own real cell count,
 * confirming the button isn't hardcoded to the dodecahedron/120-cell case.
 */
test('every FOURD_CAPABLE shape shows its own real cell count under "View 4D"', async ({ page }) => {
  const expected: [cardText: string, cellCountText: string][] = [
    ['tetrahedron', '16 cells'],
    ['cube', '8 cells'],
    ['octahedron', '24 cells'],
  ];
  for (const [cardText, cellCountText] of expected) {
    await page.getByRole('button', { name: /^Start over with/ }).click();
    await openBrowserWheel(page);
    await clickWheelLabel(page, exactLabel('Platonic'));

    const card = page.locator(`text=/^${cardText}$/i`).first();
    await card.scrollIntoViewIfNeeded();
    await card.click();

    const drawer = page.getByRole('dialog', { name: cardText });
    await drawer.getByRole('button', { name: 'View 4D' }).click();
    await expect(drawer.locator(`text=/${cellCountText}/`)).toBeVisible();
    await drawer.getByRole('button', { name: 'Close' }).click();
  }
});
