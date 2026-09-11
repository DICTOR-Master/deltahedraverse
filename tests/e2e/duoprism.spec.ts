import { test, expect } from './fixtures';
import { getCanvasCenter, resetTo, readTooltipAt, openBrowserWheel, clickWheelLabel, exactLabel } from './utils';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
});

/**
 * End-to-end coverage of the 4D Prism (duoprism) construction's
 * contextual UI: "Attach via Duoprism…" only ever appears for a free
 * face on one of the 4 gold-badge FOURD_CAPABLE shapes (same gating as
 * 4D fold), coexists with both other attach options, and — unlike
 * ordinary/4D-fold attach — never opens a shape/registration picker,
 * since a duoprism's incoming shape and orientation are entirely
 * determined by the target (see duoprism.ts's own header comment).
 * scripts/verify-duoprism.ts already exhaustively checks the underlying
 * geometry (combinatorics, winding, non-degeneracy, and the "chaining a
 * second duoprism onto a different face leaves the parent untouched"
 * claim, computed directly on real geometry); this file only checks
 * that the UI wires up to it correctly.
 */
test('a DODECAHEDRON face offers Duoprism self-attach with no picker step, and persists correctly', async ({ page }) => {
  await resetTo(page, 'DODECAHEDRON');
  const { cx, cy } = await getCanvasCenter(page);

  const text = await readTooltipAt(page, cx, cy);
  expect(text).toContain('DODECAHEDRON');
  await page.mouse.click(cx, cy);
  await expect(page.locator('text=/Selected DODECAHEDRON node/')).toBeVisible();

  // Duoprism coexists with the ordinary flush attach -- an additional
  // choice, not a replacement (4D fold's own "Attach via 4D fold…" entry
  // point was removed separately; see fold4.spec.ts).
  await expect(page.getByRole('button', { name: 'Attach via face…' })).toBeVisible();
  const duoprismBtn = page.getByRole('button', { name: 'Attach via Duoprism…' });
  await expect(duoprismBtn).toBeVisible();

  // No wheel/browser picker: clicking it goes straight to the pending
  // Confirm/Cancel state (there's no shape or registration choice to make).
  await duoprismBtn.click();
  await expect(page.locator('text=/Placing DODECAHEDRON via Duoprism/')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('text=/Placing DODECAHEDRON/')).toHaveCount(0);

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('text=Saved')).toBeVisible();
  const assembly = await page.evaluate(() => fetch('/api/assemblies').then((r) => r.json()));
  expect(assembly.nodes).toHaveLength(2);
  expect(assembly.nodes.every((n: { shape: string }) => n.shape === 'DODECAHEDRON')).toBe(true);
  expect(assembly.connections).toHaveLength(1);
  expect(assembly.connections[0].kind).toBe('duoprism');
  expect(assembly.connections[0].vertexA).toBe(assembly.connections[0].vertexB);

  // Undo removes it cleanly (no leftover wall-prism mesh/orphaned state) --
  // re-save to check the in-memory graph via the real persistence API,
  // since undo itself doesn't auto-save.
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('text=Saved')).toBeVisible();
  const savedAfterUndo = await page.evaluate(() => fetch('/api/assemblies').then((r) => r.json()));
  expect(savedAfterUndo.nodes).toHaveLength(1);
  expect(savedAfterUndo.connections).toHaveLength(0);
});

/**
 * The real user-reported bug this app shipped and then fixed: attaching
 * a duoprism to a SECOND (and third) face of the same parent must NOT
 * create a separate, independent far copy per face -- a real duoprism
 * has exactly ONE far copy total (like a tesseract has 2 cubes, not one
 * per face). scripts/verify-duoprism.ts already proves the underlying
 * geometry directly (one shared offset produces zero gap by
 * construction); this checks the persisted GRAPH shape survives a full
 * save/load round trip: still exactly 2 nodes (not 4) after 3 faces of
 * the same parent are connected, all recorded on ONE connection via
 * duoprismExtraFaces, and the page renders it (multiple wall-prisms
 * sharing one far copy) with no console error.
 */
test('three faces of one parent sharing a single duoprism far copy survive a save/load round trip', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  const assembly = {
    nodes: [
      { id: 'a', shape: 'DODECAHEDRON', transform: { position: [0, 0, 0], quaternion: [0, 0, 0, 1] } },
      { id: 'b', shape: 'DODECAHEDRON', transform: { position: [0, 0, 3], quaternion: [0, 0, 0, 1] } },
    ],
    connections: [{ nodeA: 'a', vertexA: 0, nodeB: 'b', vertexB: 0, kind: 'duoprism', duoprismExtraFaces: [1, 2] }],
  };
  await page.evaluate(
    (a) => fetch('/api/assemblies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) }),
    assembly,
  );
  await page.reload();
  await page.waitForTimeout(500);

  // Renders without throwing: the corrected loadAssembly loop builds 3
  // wall-prism meshes (one per face in [vertexA, ...duoprismExtraFaces])
  // off a single shared offset, none of it crashing the scene.
  expect(pageErrors).toEqual([]);
  await expect(page.getByRole('main').locator('canvas')).toBeVisible();

  // Re-save and re-fetch: the graph is still exactly 2 nodes and 1
  // connection carrying all 3 face indices -- proves the shared-far-copy
  // shape is what's actually persisted, not silently expanded into one
  // node per face on the way through load/save.
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('text=Saved')).toBeVisible();
  const roundTripped = await page.evaluate(() => fetch('/api/assemblies').then((r) => r.json()));
  expect(roundTripped.nodes).toHaveLength(2);
  expect(roundTripped.connections).toHaveLength(1);
  expect(roundTripped.connections[0].kind).toBe('duoprism');
  expect(roundTripped.connections[0].vertexA).toBe(0);
  expect(new Set(roundTripped.connections[0].duoprismExtraFaces)).toEqual(new Set([1, 2]));
});

test('a non-4D-capable shape (RHOMBIC_DODECAHEDRON) never offers Duoprism self-attach', async ({ page }) => {
  await resetTo(page, 'RHOMBIC_DODECAHEDRON');
  const { cx, cy } = await getCanvasCenter(page);

  await page.mouse.click(cx, cy);
  await expect(page.locator('text=/Selected RHOMBIC_DODECAHEDRON node/')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Attach via face…' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Attach via Duoprism…' })).toHaveCount(0);
});

/**
 * VIEW is available for ALL 137 shapes (not just the 4 FOURD_CAPABLE
 * ones that get real BUILD support) -- checked here on a Johnson solid,
 * deliberately NOT one of the 4, to confirm the reference-only preview
 * genuinely doesn't depend on FOURD_CAPABLE_IDS eligibility the way
 * BUILD's own button does.
 */
test('View 4D Duoprism is available on a non-FOURD-capable shape\'s detail drawer, reference-only', async ({ page }) => {
  await page.getByRole('button', { name: /^Start over with/ }).click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, exactLabel('Full Catalog'));

  const card = page.locator('text=/^cuboctahedron$/i').first();
  await card.scrollIntoViewIfNeeded();
  await card.click();

  const drawer = page.getByRole('dialog', { name: 'cuboctahedron' });
  await expect(drawer.getByRole('button', { name: 'View 4D Duoprism' })).toBeVisible();
  await drawer.getByRole('button', { name: 'View 4D Duoprism' }).click();

  await expect(drawer.locator('text=/Reference only.*3D shadow of the 4D duoprism/i')).toBeVisible();
  await expect(drawer.getByLabel('Draggable 4D duoprism preview')).toBeVisible();

  await drawer.getByRole('button', { name: 'Hide 4D Duoprism' }).click();
  await expect(drawer.locator('text=/Reference only.*3D shadow of the 4D duoprism/i')).toHaveCount(0);
});
