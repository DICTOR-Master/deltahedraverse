import { test, expect } from './fixtures';
import { getCanvasCenter, resetTo, findOnCanvas, findNodeBody, openBrowserWheel, clickWheelLabel, exactLabel } from './utils';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
  await resetTo(page, 'D4');
});

test('deleting the root cascades to its attached child, leaving nothing behind', async ({ page }) => {
  const { cx, cy } = await getCanvasCenter(page);

  const vertexHit = await findOnCanvas(page, cx, cy, (t) => /^vertex \d+ — capacity/.test(t));
  expect(vertexHit).not.toBeNull();
  // Real leftover fixed live: this used to click a flat "D6" button
  // rendered directly in the nav -- vertex-attach now opens the same
  // family-grouped picker face-attach already uses, via "Attach via
  // vertex…" (see attach.spec.ts's own identical fix).
  await page.getByRole('button', { name: 'Attach via vertex…' }).click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, exactLabel('Deltahedra'));
  await clickWheelLabel(page, 'D6');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('text=/Click a highlighted/')).toBeVisible();

  // The root's centroid is still the world origin (attaching a child never
  // moves it), so it's very likely still dead-center on screen — try that
  // first (fast) and only sweep if the child happens to occlude it.
  const rootHit = await findNodeBody(page, cx, cy, (t) => t.includes('D4') && t.includes('select'));
  expect(rootHit, 'expected to find the D4 root node body').not.toBeNull();

  const deleteBtn = page.getByRole('button', { name: 'Delete' });
  await expect(deleteBtn).toBeVisible();
  await deleteBtn.click();

  await expect(page.locator('text=/Deleted node and 1 attached descendant/')).toBeVisible();

  const anythingLeft = await findOnCanvas(page, cx, cy, () => true, { click: false, radius: 80 });
  expect(anythingLeft, 'expected the canvas to be empty after deleting the root').toBeNull();
});
