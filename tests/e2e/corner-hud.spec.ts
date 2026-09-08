import { test, expect } from './fixtures';

test('the corner HUD medallion is visible and clicking it opens the shape picker wheel', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  const hud = page.locator('[data-testid="corner-hud-wheel"]');
  await expect(hud).toBeVisible();

  const box = await hud.boundingBox();
  if (!box) throw new Error('corner HUD not found or not visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.locator('[role="dialog"][aria-label="Shape picker wheel"]')).toBeVisible();
  // The HUD medallion hides itself while the full wheel is open (see
  // page.tsx: `{!wheelOpen && <CornerHudWheel ... />}`), same principle
  // as the fully opaque backdrop -- nothing else should compete for
  // attention once the wheel is up.
  await expect(hud).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(hud).toBeVisible();
});
