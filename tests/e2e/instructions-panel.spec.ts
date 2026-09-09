import { test, expect } from './fixtures';
import { resetTo, getCanvasCenter } from './utils';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
});

/**
 * Real user request: "make instruction panel with little x in the
 * corner so you can clear the space." Session-lived only (not
 * persisted) -- a page reload brings it back, same as every other
 * transient UI state in this app.
 */
test('the default-state instruction pill can be dismissed via its own × button', async ({ page }) => {
  const pillText = page.locator('text=/Click a highlighted, free vertex/');
  await expect(pillText).toBeVisible();

  await page.getByRole('button', { name: 'Dismiss instructions' }).click();
  await expect(pillText).toHaveCount(0);

  // A page reload (not persisted) brings it back.
  await page.reload();
  await page.waitForTimeout(500);
  await expect(pillText).toBeVisible();
});

test('the instruction pill is hidden while a node/vertex is selected, unaffected by the dismiss button', async ({ page }) => {
  await resetTo(page, 'CUBE');
  const pillText = page.locator('text=/Click a highlighted, free vertex/');
  await expect(pillText).toBeVisible();

  const { cx, cy } = await getCanvasCenter(page);
  await page.mouse.click(cx, cy);

  // Selecting a node replaces the pill with the top-nav action buttons
  // (Delete, "Attach via face…", etc.) -- the dismiss button goes with it,
  // since the whole pill is conditionally rendered only in the true
  // default state.
  await expect(pillText).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Dismiss instructions' })).toHaveCount(0);
});
