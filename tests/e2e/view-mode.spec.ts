import { test, expect } from './fixtures';

test('the view-mode button cycles through Solid, Translucent, and Inside view', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);

  const viewButton = page.getByRole('button', { name: /^View:/ });

  await expect(viewButton).toHaveText('View: Solid');
  await viewButton.click();
  await expect(viewButton).toHaveText('View: Translucent');
  await viewButton.click();
  await expect(viewButton).toHaveText('View: Inside view');
  await viewButton.click();
  await expect(viewButton).toHaveText('View: Solid');
});
