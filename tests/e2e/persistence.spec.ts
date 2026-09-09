import { test, expect } from './fixtures';
import { getCanvasCenter, resetTo, findOnCanvas, readTooltipAt, openBrowserWheel, clickWheelLabel, exactLabel } from './utils';

test('saving and reloading restores the assembly exactly', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
  await resetTo(page, 'D8');

  const { cx, cy } = await getCanvasCenter(page);
  const vertexHit = await findOnCanvas(page, cx, cy, (t) => /^vertex \d+ — capacity/.test(t));
  expect(vertexHit).not.toBeNull();
  const { dx, dy } = vertexHit!;

  // Real leftover fixed live: this used to click a flat "D4" button
  // rendered directly in the nav -- vertex-attach now opens the same
  // family-grouped picker face-attach already uses, via "Attach via
  // vertex…" (see attach.spec.ts's own identical fix).
  await page.getByRole('button', { name: 'Attach via vertex…' }).click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, exactLabel('Deltahedra'));
  await clickWheelLabel(page, 'D4');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('text=/Click a highlighted/')).toBeVisible();

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('text=Saved')).toBeVisible();

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // The camera resets to the same default position on reload, so the exact
  // same screen offset that found the free vertex before should now read it
  // as occupied — proving the attached D4 child specifically survived the
  // reload, not just that the root shape type is D8.
  const textAfter = await readTooltipAt(page, cx + dx, cy + dy);
  expect(
    textAfter,
    `expected the same vertex to read occupied after reload (got "${textAfter}")`,
  ).toContain('occupied');
});
