import { test, expect } from './fixtures';
import { getCanvasCenter, resetTo, findOnCanvas, findNodeBody } from './utils';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
  await resetTo(page, 'D4');
});

test('deleting the root cascades to its attached child, leaving nothing behind', async ({ page }) => {
  const { cx, cy } = await getCanvasCenter(page);

  const vertexHit = await findOnCanvas(page, cx, cy, (t) => /^vertex \d+ — capacity/.test(t));
  expect(vertexHit).not.toBeNull();
  await page.getByRole('button', { name: 'D6', exact: true }).click();
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
