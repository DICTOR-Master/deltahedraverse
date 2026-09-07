import { test, expect } from './fixtures';
import { getCanvasCenter, resetTo, readTooltipAt } from './utils';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
  await resetTo(page, 'D10');
});

test('a D10 body offers a transform to D12, and applying it swaps the shape', async ({ page }) => {
  const { cx, cy } = await getCanvasCenter(page);

  // A freshly reset root is centered at the world origin, which projects to
  // the canvas center under the default camera — no sweep needed to find it.
  const text = await readTooltipAt(page, cx, cy);
  expect(text).toContain('D10');
  expect(text).toContain('transform');
  await page.mouse.click(cx, cy);

  const transformBtn = page.getByRole('button', { name: 'Transform to D12' });
  await expect(transformBtn).toBeVisible();
  await transformBtn.click();

  await expect(page.locator('text=/D10 → D12/')).toBeVisible();

  // The node should now offer the *reverse* transform, confirming the shape
  // actually swapped rather than just the label changing.
  const textAfter = await readTooltipAt(page, cx, cy);
  expect(textAfter, 'expected the node to now be a D12 (offering transform back to D10)').toContain('D12');
  expect(textAfter).toContain('transform');
});
