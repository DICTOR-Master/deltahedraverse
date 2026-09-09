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
  // Unlike the original decorative-only version, the HUD now stays
  // visible while the wheel is open -- it's an always-on shortcut
  // surface (matching Rhombiverse's own "always-visible" HUD), and its
  // own Wheel face needs to stay reachable to close the wheel again.
  await expect(hud).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(hud).toBeVisible();
});

test('the HUD Wheel and Browser faces toggle their own overlay open and closed', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  const hud = page.locator('[data-testid="corner-hud-wheel"]');
  await expect(hud).toBeVisible();

  // buildSlots() order: 0=Wheel, 1=Browser -- see CornerHudWheel.tsx's
  // own __hudTriggerAction test hook.
  await page.evaluate(() => {
    (document.querySelector('[data-testid="corner-hud-wheel"]') as unknown as { __hudTriggerAction: (i: number) => void })
      .__hudTriggerAction(0);
  });
  await expect(page.locator('[role="dialog"][aria-label="Shape picker wheel"]')).toBeVisible();

  await page.evaluate(() => {
    (document.querySelector('[data-testid="corner-hud-wheel"]') as unknown as { __hudTriggerAction: (i: number) => void })
      .__hudTriggerAction(0);
  });
  await expect(page.locator('[role="dialog"][aria-label="Shape picker wheel"]')).toBeHidden();

  await page.evaluate(() => {
    (document.querySelector('[data-testid="corner-hud-wheel"]') as unknown as { __hudTriggerAction: (i: number) => void })
      .__hudTriggerAction(1);
  });
  await expect(page.locator('[role="dialog"][aria-label="Shape browser"]')).toBeVisible();

  await page.evaluate(() => {
    (document.querySelector('[data-testid="corner-hud-wheel"]') as unknown as { __hudTriggerAction: (i: number) => void })
      .__hudTriggerAction(1);
  });
  await expect(page.locator('[role="dialog"][aria-label="Shape browser"]')).toBeHidden();
});

test('the HUD View face cycles view mode and the About face reopens the welcome overlay', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  const trigger = (index: number) =>
    page.evaluate(
      (i) =>
        (document.querySelector('[data-testid="corner-hud-wheel"]') as unknown as { __hudTriggerAction: (i: number) => void })
          .__hudTriggerAction(i),
      index,
    );

  // 2=View: same underlying cycleViewMode() the header's own "View:"
  // button calls -- checking its visible label is enough to confirm the
  // HUD face reaches the real app state, not a separate copy of it.
  await expect(page.getByRole('button', { name: /^View:/ })).toHaveText('View: Solid');
  await trigger(2);
  await expect(page.getByRole('button', { name: /^View:/ })).toHaveText('View: Translucent');

  // 4=About
  await trigger(4);
  await expect(page.getByRole('dialog', { name: 'Welcome to Polyhedraverse' })).toBeVisible();
});
