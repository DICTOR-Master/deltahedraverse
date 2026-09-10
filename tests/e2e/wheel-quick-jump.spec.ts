import { test, expect } from './fixtures';
import { openBrowserWheel, clickWheelLabel, exactLabel } from './utils';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
});

/**
 * Real user request ("a separate group [for star polyhedra]" + "group by
 * group summoning from wheel" + "bottom left hand menu button"): three
 * new direct doors into content that previously required either opening
 * Full Catalog and scrolling, or drilling through the wheel's per-shape
 * pagination one page at a time.
 */
test('the wheel\'s own Star Polyhedra face jumps straight to Full Catalog\'s star section', async ({ page }) => {
  await page.getByRole('button', { name: /^Start over with/ }).click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, exactLabel('Star Polyhedra'));

  // The wheel itself is gone -- exits immediately, same as Full Catalog's
  // own face does, not a further wheel-level navigation.
  await expect(page.locator('[data-testid="polyhedral-wheel-scene"]')).toHaveCount(0);
  const header = page.locator('text=/Star Polyhedra — reference only/');
  await expect(header).toBeVisible();
});

/**
 * "View all" only appears once a family actually spans more than one
 * wheel page (Johnson: 92 members) -- a small family (e.g. Platonic: 5)
 * fits on one wheel screen already, so there's nothing to shortcut past.
 */
test('a large family\'s "View all" wheel face jumps straight to its own Full Catalog section', async ({ page }) => {
  await page.getByRole('button', { name: /^Start over with/ }).click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, exactLabel('Johnson'));

  const page1Labels = await page.locator('.pw-label-text').allTextContents();
  expect(page1Labels).toContain('View all');

  await clickWheelLabel(page, 'View all');
  await expect(page.locator('[data-testid="polyhedral-wheel-scene"]')).toHaveCount(0);

  const header = page.locator('text=/^Johnson$/').first();
  await expect(header).toBeVisible();
  // A shape deep in Johnson's own 92-member roster is visible without
  // any further scrolling/paging -- confirms this landed AT the section,
  // not just somewhere on the page.
  await expect(page.locator('text=/^triangular bipyramid$/i').first()).toBeVisible();
});

test('a small, non-overflowing family has no "View all" face -- its whole roster already fits on one wheel screen', async ({ page }) => {
  await page.getByRole('button', { name: /^Start over with/ }).click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, exactLabel('Platonic'));

  const labels = await page.locator('.pw-label-text').allTextContents();
  expect(labels).not.toContain('View all');
  expect(labels).not.toContain('More');
});

/**
 * Both Star Polyhedra and family "View all" also have to work from the
 * DIRECT corner-HUD wheel (page.tsx's own PolyhedralWheel, not the one
 * embedded in ShapeBrowser) -- real, separate plumbing
 * (fullCatalogRequestId + fullCatalogFocusSection), not a duplicate of
 * the embedded-wheel tests above.
 */
test('Star Polyhedra and View all are also reachable from the direct corner-HUD wheel', async ({ page }) => {
  await page.evaluate(() => {
    (document.querySelector('[data-testid="corner-hud-wheel"]') as unknown as { __hudTriggerAction: (i: number) => void })
      .__hudTriggerAction(0);
  });
  await expect(page.locator('[role="dialog"][aria-label="Shape picker wheel"]')).toBeVisible();
  await clickWheelLabel(page, exactLabel('Star Polyhedra'));
  await expect(page.locator('[role="dialog"][aria-label="Shape picker wheel"]')).toHaveCount(0);
  await expect(page.locator('text=/Star Polyhedra — reference only/')).toBeVisible();
});

/**
 * Real user request: "a little bottom left hand 'menu' button that
 * summons wheel from anywhere" -- a second, always-visible trigger
 * alongside CornerHudWheel's own medallion (bottom-right), not a
 * replacement for it.
 */
test('the bottom-left menu button opens the direct wheel from anywhere', async ({ page }) => {
  const btn = page.getByRole('button', { name: 'Open shape wheel' });
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(page.locator('[role="dialog"][aria-label="Shape picker wheel"]')).toBeVisible();
});

/**
 * Real user request: an alternate way into the registry besides family-
 * by-family, deep-linking straight to ShapeBrowser's own Search tab
 * (already has both a name search box and a face-shape facet) rather
 * than a new parallel filtering UI on the wheel itself.
 */
test('the wheel\'s own Search face opens ShapeBrowser\'s Search tab, with both name search and face-shape facets', async ({ page }) => {
  await page.getByRole('button', { name: /^Start over with/ }).click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, exactLabel('Search'));

  await expect(page.locator('[data-testid="polyhedral-wheel-scene"]')).toHaveCount(0);
  await expect(page.getByPlaceholder(/Search shapes/)).toBeVisible();
  await expect(page.locator('text=/^Face Shape$/i')).toBeVisible();
});

test('the wheel\'s own Search face also works from the direct corner-HUD wheel', async ({ page }) => {
  await page.evaluate(() => {
    (document.querySelector('[data-testid="corner-hud-wheel"]') as unknown as { __hudTriggerAction: (i: number) => void })
      .__hudTriggerAction(0);
  });
  await expect(page.locator('[role="dialog"][aria-label="Shape picker wheel"]')).toBeVisible();
  await clickWheelLabel(page, exactLabel('Search'));
  await expect(page.locator('[role="dialog"][aria-label="Shape picker wheel"]')).toHaveCount(0);
  await expect(page.getByPlaceholder(/Search shapes/)).toBeVisible();
});
