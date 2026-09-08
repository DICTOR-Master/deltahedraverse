import { test, expect } from './fixtures';
import { getCanvasCenter, resetTo, findOnCanvas } from './utils';

const SHAPE_IDS = [
  'D4', 'D6', 'D8', 'D10', 'D12', 'D14', 'D16', 'D20',
  'CUBE', 'DODECAHEDRON',
  'CUBOCTAHEDRON', 'TRUNCATED_TETRAHEDRON', 'TRUNCATED_OCTAHEDRON',
  'TRUNCATED_CUBE', 'TRUNCATED_DODECAHEDRON', 'TRUNCATED_ICOSAHEDRON',
  'TRUNCATED_CUBOCTAHEDRON', 'TRUNCATED_ICOSIDODECAHEDRON', 'ICOSIDODECAHEDRON',
  'RHOMBICUBOCTAHEDRON', 'RHOMBICOSIDODECAHEDRON', 'SNUB_CUBE', 'SNUB_DODECAHEDRON',
  'J1_SQUARE_PYRAMID', 'J2_PENTAGONAL_PYRAMID', 'J3_TRIANGULAR_CUPOLA',
  'J4_SQUARE_CUPOLA', 'J5_PENTAGONAL_CUPOLA', 'J6_PENTAGONAL_ROTUNDA',
];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
});

test('renders the canvas and all 29 shape buttons (8 deltahedra + 2 Platonic + 13 Archimedean + 6 Johnson)', async ({ page }) => {
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
