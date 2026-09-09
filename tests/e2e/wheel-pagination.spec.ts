import { test, expect } from './fixtures';
import { openBrowserWheel, clickWheelLabel, exactLabel } from './utils';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
});

/**
 * Real user request: "More" only ever wrapped forward through a large
 * family's pages, so getting back to an earlier page of Archimedean (13
 * members, 2 pages at 10/page) or Johnson (92 members, many more pages)
 * meant clicking through the whole remaining cycle again. "Previous"
 * (face 0, mirroring "More" at face 11) steps back exactly one page,
 * only appearing once level.page > 0 -- see resolveSlots' own comment.
 */
test('a "Previous" face steps back a page without wrapping through the whole family', async ({ page }) => {
  await page.getByRole('button', { name: /^Start over with/ }).click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, exactLabel('Archimedean'));

  const realContent = (labels: string[]) => labels.filter((t) => t !== '' && t !== 'More' && t !== 'Previous');

  const page1Labels = await page.locator('.pw-label-text').allTextContents();
  expect(page1Labels).toContain('More');
  expect(page1Labels).not.toContain('Previous'); // page 0: nothing to go back to yet
  const page1Content = realContent(page1Labels).sort();
  expect(page1Content).toHaveLength(10); // CONTENT_FACES_PER_PAGE once overflowing

  await clickWheelLabel(page, 'More');
  const page2Labels = await page.locator('.pw-label-text').allTextContents();
  expect(page2Labels).toContain('Previous');
  const page2Content = realContent(page2Labels).sort();
  expect(page2Content).toHaveLength(3); // Archimedean's 13 - 10 already shown
  // No overlap -- page 2 shows the REMAINING shapes, not a repeat of page 1's.
  expect(page2Content.some((t) => page1Content.includes(t))).toBe(false);

  await clickWheelLabel(page, 'Previous');
  const page1AgainLabels = await page.locator('.pw-label-text').allTextContents();
  expect(page1AgainLabels).not.toContain('Previous'); // back to page 0
  expect(realContent(page1AgainLabels).sort()).toEqual(page1Content);
});
