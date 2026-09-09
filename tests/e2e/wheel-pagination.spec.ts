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
 * Full Catalog (all 137 shapes, grouped into real family sections):
 * re-added after being pulled once ("we've lost simplicity"), then
 * redesigned again per direct feedback -- browsing it one wheel face at
 * a time read as "just go round the wheel itself almost anonymously,"
 * not the "full page of all images in sections" that was actually
 * expected. Selecting the wheel's star-symbol face now exits the wheel
 * immediately (same as picking a real shape) and opens
 * FullCatalogScreen -- a single scrollable page, not more wheel
 * pagination. See app/components/browser/FullCatalogScreen.tsx.
 */
test('Full Catalog opens a real scrollable page, grouped into family sections, not more wheel pagination', async ({ page }) => {
  await page.getByRole('button', { name: /^Start over with/ }).click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, exactLabel('Full Catalog'));

  // The wheel itself is gone -- this is a real screen, not another wheel level.
  await expect(page.locator('[data-testid="polyhedral-wheel-scene"]')).toHaveCount(0);

  // Real family section headers, each followed by that family's own
  // full member count -- not a flat, ungrouped 137-item list.
  await expect(page.locator('text=Deltahedra').first()).toBeVisible();
  await expect(page.locator('text=Platonic').first()).toBeVisible();

  // A real shape card from deep in the catalog (Catalan) is reachable
  // by scrolling, not by paging through wheel faces.
  const rdCard = page.locator('text=/rhombic dodecahedron/i').first();
  await rdCard.scrollIntoViewIfNeeded();
  await expect(rdCard).toBeVisible();

  // Selecting it actually resets to that shape, same as any other pick
  // -- ShapeDetailDrawer's own real "Add to Scene" button, not a guess.
  await rdCard.click();
  await page.getByRole('button', { name: 'Add to Scene' }).click();
  await expect(page.locator('text=/Click a highlighted/')).toBeVisible();
});

test('Full Catalog is also reachable from the direct corner-HUD wheel, not just the browser', async ({ page }) => {
  // CornerHudWheel's medallion opens PolyhedralWheel directly (bypassing
  // ShapeBrowser entirely) -- Full Catalog from THAT wheel has to reach
  // FullCatalogScreen through a different path (page.tsx's own
  // fullCatalogRequestId prop into ShapeBrowser, not the embedded
  // wheel's local state), so this is real, separate coverage, not a
  // duplicate of the test above. Opens the direct wheel via the HUD's
  // own real __hudTriggerAction test hook (0=Wheel, same convention
  // corner-hud.spec.ts already establishes) rather than driving the
  // corner HUD's own continuously-repositioning labels directly.
  await page.evaluate(() => {
    (document.querySelector('[data-testid="corner-hud-wheel"]') as unknown as { __hudTriggerAction: (i: number) => void })
      .__hudTriggerAction(0);
  });
  await expect(page.locator('[role="dialog"][aria-label="Shape picker wheel"]')).toBeVisible();

  await clickWheelLabel(page, exactLabel('Full Catalog'));

  await expect(page.locator('[role="dialog"][aria-label="Shape picker wheel"]')).toHaveCount(0);
  await expect(page.locator('text=Deltahedra').first()).toBeVisible();
});
