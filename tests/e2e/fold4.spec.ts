import { test, expect } from './fixtures';
import { getCanvasCenter, resetTo, readTooltipAt, clickWheelLabel, openBrowserWheel } from './utils';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
});

/**
 * End-to-end coverage of the 4D extension's contextual UI (see
 * app/lib/polyhedra/fold4.ts and the project's own 4D-extension plan):
 * the "Attach via 4D fold…" button only ever appears for a free face on
 * one of the 4 gold-badge FOURD_CAPABLE shapes (trigger point 1), and the
 * fold slider only ever appears once the assembly actually has a real
 * fold4 connection (trigger point 2) -- never as permanent controls.
 * verify-fold4.ts already exhaustively checks the underlying math itself
 * (pivot invariance, real chained-edge closure, the sandboxing
 * guardrail); this file only checks that the UI wires up to it correctly.
 */
test('a DODECAHEDRON face offers 4D-fold self-attach, and confirming it reveals the fold slider', async ({ page }) => {
  await resetTo(page, 'DODECAHEDRON');
  const { cx, cy } = await getCanvasCenter(page);

  const text = await readTooltipAt(page, cx, cy);
  expect(text).toContain('DODECAHEDRON');
  await page.mouse.click(cx, cy);
  await expect(page.locator('text=/Selected DODECAHEDRON node/')).toBeVisible();

  // Both the ordinary face-attach and the new 4D-fold option must coexist
  // -- 4D fold is an additional choice at attach time, never a
  // replacement for the ordinary flush attach.
  await expect(page.getByRole('button', { name: 'Attach via face…' })).toBeVisible();
  const fold4Btn = page.getByRole('button', { name: 'Attach via 4D fold…' });
  await expect(fold4Btn).toBeVisible();

  // The slider must not exist yet -- no fold4 connection in the assembly.
  await expect(page.getByText('4D ⧉ Fold')).toHaveCount(0);

  await fold4Btn.click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, 'Platonic');
  await clickWheelLabel(page, 'DODECAHEDRON');

  await expect(page.locator('text=/Placing DODECAHEDRON via 4D fold/')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('text=/Placing DODECAHEDRON/')).toHaveCount(0);

  // Trigger point 2: the slider mounts now that a real fold4 connection
  // exists, defaulting to 0% (raw/ordinary-3D -- a freshly confirmed
  // fold4 attach looks exactly like a normal flush attach until the
  // player drags toward 4D themselves).
  await expect(page.getByText('4D ⧉ Fold')).toBeVisible();
  await expect(page.getByText('0%')).toBeVisible();

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('text=Saved')).toBeVisible();
  const assembly = await page.evaluate(() => fetch('/api/assemblies').then((r) => r.json()));
  expect(assembly.nodes).toHaveLength(2);
  expect(assembly.connections).toHaveLength(1);
  expect(assembly.connections[0].kind).toBe('face');
  expect(assembly.connections[0].fold4).toBe(true);

  // Scrubbing the slider updates the displayed percentage (the actual
  // geometric effect of `t` on the folded node's render matrix is
  // covered by scripts/verify-fold4.ts, not re-derived here).
  const slider = page.locator('input[type="range"]');
  await slider.fill('0');
  await expect(page.getByText('0%')).toBeVisible();
  await slider.fill('100');
  await expect(page.getByText('100%')).toBeVisible();

  // Undoing the fold4 attach removes the assembly's only fold4
  // connection -- the slider must disappear again (and its own internal
  // amount resets, matching ShapeViewer's own foldAmountRef comment) --
  // not linger as an orphaned, meaningless control.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('4D ⧉ Fold')).toHaveCount(0);
});

test('a non-4D-capable shape (RHOMBIC_DODECAHEDRON) never offers 4D-fold self-attach', async ({ page }) => {
  await resetTo(page, 'RHOMBIC_DODECAHEDRON');
  const { cx, cy } = await getCanvasCenter(page);

  await page.mouse.click(cx, cy);
  await expect(page.locator('text=/Selected RHOMBIC_DODECAHEDRON node/')).toBeVisible();

  // The ordinary face-attach option is still real (RD is congruent to
  // itself) -- only the 4D-fold option is correctly absent, since RD's
  // dihedral angle only lands at flat-tiles, never a real 4D closure
  // (see scripts/verify-4d-closure.ts).
  await expect(page.getByRole('button', { name: 'Attach via face…' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Attach via 4D fold…' })).toHaveCount(0);
});
