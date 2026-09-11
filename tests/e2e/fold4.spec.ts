import { test, expect } from './fixtures';
import { getCanvasCenter, resetTo } from './utils';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
});

/**
 * The 4D fold's "Attach via 4D fold…" entry point was removed (direct
 * user decision, 2026-09-11): the underlying math is exact for a single
 * attached pair, but has a real, unsolved limitation once 3+ copies
 * share an edge, and duoprism.ts's own construction now offers an
 * always-exact way to build groups instead. This file checks the entry
 * point is genuinely gone, and that the underlying load/scrub machinery
 * (kept intentionally, so an already-saved assembly with a real fold4
 * connection isn't silently broken) still works when reached directly
 * through the persistence API rather than the removed button.
 */
test('the removed "Attach via 4D fold…" button never appears, even where it used to', async ({ page }) => {
  await resetTo(page, 'DODECAHEDRON');
  const { cx, cy } = await getCanvasCenter(page);

  await page.mouse.click(cx, cy);
  await expect(page.locator('text=/Selected DODECAHEDRON node/')).toBeVisible();

  // The other two attach options are unaffected -- only 4D fold's own
  // entry point is gone.
  await expect(page.getByRole('button', { name: 'Attach via face…' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Attach via Duoprism…' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Attach via 4D fold…' })).toHaveCount(0);
});

test('an already-saved fold4 connection still loads and its slider still scrubs (backward compatibility)', async ({ page }) => {
  // Build a real, valid 2-node fold4 assembly directly through the same
  // persistence API "Save" uses, exactly the shape a pre-existing save
  // from before the button's removal would have -- isValidAssembly is
  // the actual, only gate, unaffected by this UI change.
  const assembly = {
    nodes: [
      { id: 'a', shape: 'DODECAHEDRON', transform: { position: [0, 0, 0], quaternion: [0, 0, 0, 1] } },
      { id: 'b', shape: 'DODECAHEDRON', transform: { position: [0, 0, 2.5], quaternion: [0, 0, 0, 1] } },
    ],
    connections: [{ nodeA: 'a', vertexA: 0, nodeB: 'b', vertexB: 0, kind: 'face', fold4: true }],
  };
  await page.evaluate(
    (a) => fetch('/api/assemblies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) }),
    assembly,
  );
  await page.reload();
  await page.waitForTimeout(500);

  // Trigger point 2 is untouched: the slider mounts because a real
  // fold4 connection exists in the loaded graph, defaulting to 0%.
  await expect(page.getByText('4D ⧉ Fold')).toBeVisible();
  await expect(page.getByText('0%')).toBeVisible();

  const slider = page.locator('input[type="range"]');
  await slider.fill('100');
  await expect(page.getByText('100%')).toBeVisible();
});
