import { test, expect } from './fixtures';
import { getCanvasCenter, resetTo, findOnCanvas } from './utils';

const SHAPE_IDS = ['D4', 'D6', 'D8', 'D10', 'D12', 'D14', 'D16', 'D20', 'CUBE', 'DODECAHEDRON'];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
});

test('renders the canvas and all 10 shape buttons (8 deltahedra + 2 Platonic additions)', async ({ page }) => {
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
