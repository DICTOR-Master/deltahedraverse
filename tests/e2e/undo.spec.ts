import { test, expect } from './fixtures';
import { getCanvasCenter, resetTo, findOnCanvas, openBrowserWheel, clickWheelLabel, exactLabel } from './utils';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
  await resetTo(page, 'D4');
});

test('Undo removes the single most recently confirmed attach and frees its target vertex again', async ({ page }) => {
  const undoBtn = page.getByRole('button', { name: 'Undo', exact: true });
  await expect(undoBtn).toBeDisabled();

  const { cx, cy } = await getCanvasCenter(page);
  const vertexHit = await findOnCanvas(page, cx, cy, (t) => /^vertex \d+ — capacity/.test(t));
  expect(vertexHit).not.toBeNull();

  await page.getByRole('button', { name: 'Attach via vertex…' }).click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, exactLabel('Deltahedra'));
  await clickWheelLabel(page, 'D6');
  await expect(page.locator('text=/Placing D6/')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('text=/Placing D6/')).toHaveCount(0);

  await expect(undoBtn).toBeEnabled();
  let assembly = await page.evaluate(() => fetch('/api/assemblies').then((r) => r.json()));
  expect(assembly.nodes, 'expected two nodes after the confirmed attach').toHaveLength(2);

  await undoBtn.click();
  await expect(page.locator('text=/Undid last attach/')).toBeVisible();
  await expect(undoBtn).toBeDisabled(); // single-level -- nothing left to undo

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('text=Saved')).toBeVisible();
  assembly = await page.evaluate(() => fetch('/api/assemblies').then((r) => r.json()));
  expect(assembly.nodes, 'expected the attach to be fully undone, back to the single root').toHaveLength(1);
  expect(assembly.connections).toHaveLength(0);

  // The vertex should be findable again as free (no "(occupied)" suffix).
  const reselect = await findOnCanvas(page, cx, cy, (t) => /^vertex \d+ — capacity \d+$/.test(t), {
    click: false,
  });
  expect(reselect, 'expected the undone vertex to be free again').not.toBeNull();
});

test('Undo is disabled again after Start Over resets the scene', async ({ page }) => {
  const undoBtn = page.getByRole('button', { name: 'Undo', exact: true });
  const { cx, cy } = await getCanvasCenter(page);
  const vertexHit = await findOnCanvas(page, cx, cy, (t) => /^vertex \d+ — capacity/.test(t));
  expect(vertexHit).not.toBeNull();

  await page.getByRole('button', { name: 'Attach via vertex…' }).click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, exactLabel('Deltahedra'));
  await clickWheelLabel(page, 'D6');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(undoBtn).toBeEnabled();

  await resetTo(page, 'D8');
  await expect(undoBtn).toBeDisabled();
});
