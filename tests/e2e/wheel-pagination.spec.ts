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

/**
 * Full Catalog (all 137 shapes, one browsable list): re-added after
 * being pulled once ("we've lost simplicity") -- the real complaint
 * behind that pull turned out to be a different, genuinely amorphous
 * flat 137-button list (vertex-attach's old pre-wheel UI), not this
 * wheel entry, so it's back on the wheel's last spare pair {8,11},
 * using the star symbol retired from every real family.
 */
test('Full Catalog lists all 137 shapes, paginated the same way an overflowing family is', async ({ page }) => {
  await page.getByRole('button', { name: /^Start over with/ }).click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, exactLabel('Full Catalog'));

  const realContent = (labels: string[]) => labels.filter((t) => t !== '' && t !== 'More' && t !== 'Previous');

  const page1Labels = await page.locator('.pw-label-text').allTextContents();
  expect(page1Labels).toContain('More');
  expect(page1Labels).not.toContain('Previous');
  expect(realContent(page1Labels)).toHaveLength(10);

  // A shape from a totally different family (RHOMBIC_DODECAHEDRON,
  // Catalan) should eventually turn up somewhere in the full catalog --
  // page forward until it does, or fail after a sane number of pages
  // (137 shapes / 10 per page = 14 pages max).
  let found = false;
  for (let i = 0; i < 14 && !found; i++) {
    const labels = await page.locator('.pw-label-text').allTextContents();
    if (labels.some((t) => t.includes('RHOMBIC DODECAHEDRON'))) { found = true; break; }
    if (!labels.includes('More')) break;
    await clickWheelLabel(page, 'More');
  }
  expect(found, 'expected RHOMBIC_DODECAHEDRON to appear somewhere in Full Catalog').toBe(true);

  // Selecting it should actually reset to that shape, same as picking
  // any shape from a real family would. Full Catalog's own catalog
  // NUMBER for RD differs from its Catalan-only position (a separate,
  // global face-type-sorted order over all 137) -- match by name only.
  await clickWheelLabel(page, /RHOMBIC DODECAHEDRON/);
  await expect(page.locator('text=/Click a highlighted/')).toBeVisible();
});
