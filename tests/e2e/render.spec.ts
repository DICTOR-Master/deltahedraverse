import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { getCanvasCenter, resetTo, findOnCanvas, WHEEL_FAMILIES, clickWheelLabel, CONTENT_FACES_PER_PAGE } from './utils';

/**
 * A navigating click's onSelect fires after a setTimeout(0), so reading
 * .pw-label-text in the same tick can catch the wheel mid-transition.
 * Polls until two reads 80ms apart agree, rather than trusting a single
 * immediate snapshot or a fixed sleep -- defense in depth alongside the
 * real fix for the flake this originally caught (clickWheelLabel double-
 * clicking "More" -- see utils.ts).
 */
async function stableLabelTexts(page: Page): Promise<string[]> {
  let prev = await page.locator('.pw-label-text').allTextContents();
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(80);
    const next = await page.locator('.pw-label-text').allTextContents();
    if (next.length === prev.length && next.every((t, i) => t === prev[i])) return next;
    prev = next;
  }
  return prev;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
});

test('renders the canvas and every shape across all 4 wheel families (8 deltahedra + 2 Platonic + 13 Archimedean + 60 Johnson)', async ({ page }) => {
  // Scoped to <main> -- CornerHudWheel mounts its own small canvas too.
  await expect(page.getByRole('main').locator('canvas')).toBeVisible();

  await page.getByRole('button', { name: /^Start over with/ }).click();
  for (const family of WHEEL_FAMILIES) {
    await expect(page.locator('.pw-label-text', { hasText: family.label })).toHaveCount(1);

    await clickWheelLabel(page, family.label);
    // Existence in the DOM (not visibility -- that depends on which way
    // the wheel currently faces) is what this test cares about: every
    // registered shape actually reached the picker as a real face, paging
    // through "More" for families that overflow a single 12-face wheel.
    const pages = family.ids.length > CONTENT_FACES_PER_PAGE ? Math.ceil(family.ids.length / CONTENT_FACES_PER_PAGE) : 1;
    const seen = new Set<string>();
    for (let p = 0; p < pages; p++) {
      const texts = await stableLabelTexts(page);
      texts.forEach((t) => seen.add(t));
      if (p < pages - 1) await clickWheelLabel(page, 'More');
    }
    for (const id of family.ids) {
      // Label text is "[catalog number] NAME" (e.g. "[1] D4"), not the
      // bare name -- checking "some label ends with this id's text"
      // rather than an exact match keeps this test agnostic to that
      // catalog-number prefix's exact formatting.
      const wantSuffix = id.replaceAll('_', ' ');
      const found = [...seen].some((t) => t.endsWith(wantSuffix));
      expect(found, `${family.label} family should list ${id}`).toBe(true);
    }

    await page.keyboard.press('Escape'); // back to the family list
  }
  await page.keyboard.press('Escape'); // close the wheel
});

test('"Start over" resets to a single fresh shape with no selection', async ({ page }) => {
  await resetTo(page, 'D8');
  await expect(page.locator('text=/Click a highlighted/')).toBeVisible();
});

test('a non-triangulated shape (cube) renders and its vertices are hoverable', async ({ page }) => {
  // buildFaceGeometry fan-triangulates each face for rendering (deltahedra
  // faces are already triangles, so this path was never exercised before
  // CUBE/DODECAHEDRON existed) -- this is the part the pure-math verify
  // scripts (which only check vertex positions, never face rendering) can't
  // catch, so it needs an actual browser render to confirm.
  await resetTo(page, 'CUBE');
  const { cx, cy } = await getCanvasCenter(page);
  const vertexHit = await findOnCanvas(page, cx, cy, (t) => /^vertex \d+ — capacity 3$/.test(t), {
    click: false,
  });
  expect(vertexHit, 'expected to find a degree-3 cube vertex (every cube vertex has degree 3)').not.toBeNull();
});

test('a hexagon-faced shape (truncated tetrahedron) renders and its vertices are hoverable', async ({ page }) => {
  // Exercises the n>4 fan-triangulation path (hexagons) for the first time
  // in a real browser -- CUBE only exercised n=4, DODECAHEDRON n=5.
  await resetTo(page, 'TRUNCATED_TETRAHEDRON');
  const { cx, cy } = await getCanvasCenter(page);
  const vertexHit = await findOnCanvas(page, cx, cy, (t) => /^vertex \d+ — capacity 3$/.test(t), {
    click: false,
  });
  expect(
    vertexHit,
    'expected to find a degree-3 truncated-tetrahedron vertex (every vertex has degree 3)',
  ).not.toBeNull();
});

test('a decagon-faced shape (truncated dodecahedron) renders and its vertices are hoverable', async ({ page }) => {
  // Exercises the n=10 fan-triangulation path for the first time in a real
  // browser -- the largest n among any shape in the registry (batch 1 only
  // reached n=6). Every vertex here has degree 3 (one triangle + two
  // decagons meet at each), same invariant as the other spot-checks above.
  await resetTo(page, 'TRUNCATED_DODECAHEDRON');
  const { cx, cy } = await getCanvasCenter(page);
  const vertexHit = await findOnCanvas(page, cx, cy, (t) => /^vertex \d+ — capacity 3$/.test(t), {
    click: false,
  });
  expect(
    vertexHit,
    'expected to find a degree-3 truncated-dodecahedron vertex (every vertex has degree 3)',
  ).not.toBeNull();
});

test('a mixed-vertex-degree shape (square pyramid) renders and its apex is hoverable', async ({ page }) => {
  // Every shape before the Johnson family is vertex-transitive (every
  // vertex has the same degree) -- J1's 4 base vertices are degree 3 but
  // its apex is degree 4 (it meets all 4 triangular faces), the first
  // shape in this registry with more than one vertex-capacity value.
  // Exercises that a real browser render/hover shows the correct
  // per-vertex capacity rather than a uniform one.
  await resetTo(page, 'J1_SQUARE_PYRAMID');
  const { cx, cy } = await getCanvasCenter(page);
  const apexHit = await findOnCanvas(page, cx, cy, (t) => /^vertex \d+ — capacity 4$/.test(t), {
    click: false,
  });
  expect(apexHit, 'expected to find the degree-4 apex vertex of the square pyramid').not.toBeNull();
});

test('a no-degree-3-vertex shape (gyroelongated square pyramid) renders both its vertex degrees', async ({ page }) => {
  // Every prior shape in the registry has at least some degree-3
  // vertices; J10's own connectors are only degree 4 (the antiprism
  // ring) and degree 5 (the apex-adjacent square-pyramid ring) --
  // confirms nothing in the render/hover path silently assumes a
  // degree-3 vertex exists somewhere.
  await resetTo(page, 'J10_GYROELONGATED_SQUARE_PYRAMID');
  const { cx, cy } = await getCanvasCenter(page);
  const degree4Hit = await findOnCanvas(page, cx, cy, (t) => /^vertex \d+ — capacity 4$/.test(t), {
    click: false,
  });
  expect(degree4Hit, 'expected to find a degree-4 vertex').not.toBeNull();
  const degree5Hit = await findOnCanvas(page, cx, cy, (t) => /^vertex \d+ — capacity 5$/.test(t), {
    click: false,
  });
  expect(degree5Hit, 'expected to find a degree-5 vertex').not.toBeNull();
});
