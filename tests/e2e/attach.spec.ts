import { test, expect } from './fixtures';
import { getCanvasCenter, resetTo, findOnCanvas } from './utils';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
  await resetTo(page, 'D4');
});

test('select a free vertex, attach a shape, twist it, and confirm', async ({ page }) => {
  const { cx, cy } = await getCanvasCenter(page);

  const vertexHit = await findOnCanvas(page, cx, cy, (t) => /^vertex \d+ — capacity/.test(t));
  expect(vertexHit, 'expected to find a free vertex on the fresh D4').not.toBeNull();

  await expect(page.locator('text=/Attach to D4 vertex/')).toBeVisible();

  await page.getByRole('button', { name: 'D6', exact: true }).click();
  await expect(page.locator('text=/Placing D6/')).toBeVisible();

  // Drag to twist. The exact geometry (the connection point staying fixed
  // regardless of twist angle) is proven in scripts/verify-twist.ts; this
  // just confirms the interaction is wired end-to-end in the real UI.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 150, cy, { steps: 15 });
  await page.mouse.up();
  await expect(page.locator('text=/twist -?\\d+°/')).toBeVisible();

  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('text=/Placing D6/')).toHaveCount(0);
  await expect(page.locator('text=/Click a highlighted/')).toBeVisible();
});

test('cancel removes the pending piece and frees the target vertex again', async ({ page }) => {
  const { cx, cy } = await getCanvasCenter(page);

  const vertexHit = await findOnCanvas(page, cx, cy, (t) => /^vertex \d+ — capacity/.test(t));
  expect(vertexHit).not.toBeNull();

  await page.getByRole('button', { name: 'D6', exact: true }).click();
  await expect(page.locator('text=/Placing D6/')).toBeVisible();

  await page.getByRole('button', { name: 'Cancel (Esc)' }).click();
  await expect(page.locator('text=/Placing D6/')).toHaveCount(0);

  // The vertex should be findable again as free (no "(occupied)" suffix).
  const reselect = await findOnCanvas(page, cx, cy, (t) => /^vertex \d+ — capacity \d+$/.test(t), {
    click: false,
  });
  expect(reselect, 'expected the cancelled vertex to be free again').not.toBeNull();
});
