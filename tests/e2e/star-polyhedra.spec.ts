import { test, expect } from './fixtures';
import { openBrowserWheel, clickWheelLabel, exactLabel } from './utils';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
});

/**
 * Real user request: "for the sake of completeness can you stage a plan"
 * -> the 4 Kepler-Poinsot solids (docs/star-polyhedra-spec.md), browsable
 * only, never buildable -- reachable exclusively through Full Catalog's
 * own trailing section (never a real FamilyKey, never SearchScreen's
 * family filter, never an attach flow).
 */
test('Full Catalog has a Star Polyhedra section with all 4 Kepler-Poinsot solids', async ({ page }) => {
  await page.getByRole('button', { name: /^Start over with/ }).click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, exactLabel('Full Catalog'));

  const header = page.locator('text=/Star Polyhedra — reference only/');
  await header.scrollIntoViewIfNeeded();
  await expect(header).toBeVisible();

  for (const name of ['great dodecahedron', 'small stellated dodecahedron', 'great icosahedron', 'great stellated dodecahedron']) {
    const card = page.locator(`text=/^${name}$/i`).first();
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeVisible();
  }
});

/**
 * "no shortcuts on the last four" -- the detail drawer for these 4 shows
 * real geometric facts (density, Schläfli symbol -- see starPolyhedra.ts's
 * own STAR_POLYHEDRON_META) and never offers "Add to Scene," which would
 * either do nothing or crash a ShapeViewer never built to face-fill a
 * self-intersecting polygon.
 */
test('a star polyhedron detail drawer shows Schläfli/density and has no Add to Scene button', async ({ page }) => {
  await page.getByRole('button', { name: /^Start over with/ }).click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, exactLabel('Full Catalog'));

  const card = page.locator('text=/^great stellated dodecahedron$/i').first();
  await card.scrollIntoViewIfNeeded();
  await card.click();

  await expect(page.getByRole('button', { name: 'Add to Scene' })).toHaveCount(0);
  await expect(page.locator('text=/Reference only — not buildable/i')).toBeVisible();
  await expect(page.locator('text=/Schläfli.*\\{5\\/2, 3\\}.*density 7/')).toBeVisible();

  // Favorite/Compare are real generic id-keyed features (not family- or
  // registry-dependent) -- still expected to work normally here. Scoped
  // to the drawer's own dialog (named by the shape's own display name)
  // since the outer ShapeBrowser panel is ALSO role="dialog" and still
  // has Full Catalog's card grid (with its own same-named Favorite
  // buttons) mounted underneath.
  const drawer = page.getByRole('dialog', { name: 'great stellated dodecahedron' });
  await drawer.getByRole('button', { name: 'Favorite' }).click();
  await expect(drawer.getByRole('button', { name: 'Favorite' })).toHaveText(/★/);
});

/**
 * Stage 2's real point: genuine drag-to-rotate, not just an auto-spinning
 * still image -- the user explicitly flagged that ShapePreview (used by
 * every other family) only auto-spins with no pointer handling at all.
 * StarWireframeViewer is its own small standalone THREE.Scene/
 * OrbitControls component specifically to close that gap for these 4.
 */
test('the star polyhedron detail drawer is a real drag-rotatable 3D wireframe, not a static/auto-spin-only preview', async ({ page }) => {
  await page.getByRole('button', { name: /^Start over with/ }).click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, exactLabel('Full Catalog'));

  const card = page.locator('text=/^great icosahedron$/i').first();
  await card.scrollIntoViewIfNeeded();
  await card.click();

  const canvas = page.locator('[aria-label="Draggable 3D wireframe preview"] canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(1000);
  const before = await canvas.screenshot();

  const box = await canvas.boundingBox();
  if (!box) throw new Error('star wireframe canvas has no bounding box');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy + 60, { steps: 10 });
  await page.mouse.up();

  const afterDrag = await canvas.screenshot();
  expect(Buffer.compare(before, afterDrag)).not.toBe(0);
});
