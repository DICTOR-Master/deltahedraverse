import { test, expect } from './fixtures';
import { resetTo } from './utils';

const SHAPE_IDS = ['D4', 'D6', 'D8', 'D10', 'D12', 'D14', 'D16', 'D20'];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
});

test('renders the canvas and all 8 shape buttons', async ({ page }) => {
  await expect(page.locator('canvas')).toBeVisible();
  for (const id of SHAPE_IDS) {
    await expect(page.getByRole('button', { name: new RegExp(`^${id}\\(`) })).toBeVisible();
  }
});

test('"Start over" resets to a single fresh shape with no selection', async ({ page }) => {
  await resetTo(page, 'D8');
  await expect(page.locator('text=/Click a highlighted/')).toBeVisible();
});
