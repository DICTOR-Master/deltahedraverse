import { test, expect } from './fixtures';
import { getCanvasCenter, resetTo, findOnCanvas } from './utils';

const SHAPE_IDS = [
  'D4', 'D6', 'D8', 'D10', 'D12', 'D14', 'D16', 'D20',
  'CUBE', 'DODECAHEDRON',
  'CUBOCTAHEDRON', 'TRUNCATED_TETRAHEDRON', 'TRUNCATED_OCTAHEDRON',
];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
});

test('renders the canvas and all 13 shape buttons (8 deltahedra + 2 Platonic + 3 Archimedean additions)', async ({ page }) => {
  await expect(page.locator('canvas')).toBeVisible();
  for (const id of SHAPE_IDS) {
    await expect(page.getByRole('button', { name: new RegExp(`^${id}\\(`) })).toBeVisible();
  }
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
