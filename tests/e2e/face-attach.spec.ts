import { test, expect } from './fixtures';
import { getCanvasCenter, resetTo, readTooltipAt, clickWheelLabel, openBrowserWheel, exactLabel } from './utils';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
  await resetTo(page, 'CUBE');
});

test('selecting a CUBE face offers a matching face-attach, and confirming attaches it', async ({ page }) => {
  const { cx, cy } = await getCanvasCenter(page);

  // A freshly reset root is centered at the world origin, which projects to
  // the canvas center under the default camera -- click there to select the
  // whole node plus whichever face happens to be under the cursor.
  const text = await readTooltipAt(page, cx, cy);
  expect(text).toContain('CUBE');
  expect(text).toMatch(/attach via this 4-gon face/);
  await page.mouse.click(cx, cy);

  await expect(page.locator('text=/Selected CUBE node \\(face \\d+, 4-gon\\)/')).toBeVisible();

  const attachBtn = page.getByRole('button', { name: 'Attach via face…' });
  await expect(attachBtn).toBeVisible();
  await attachBtn.click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, 'Platonic');
  await clickWheelLabel(page, 'CUBE');

  await expect(page.locator('text=/Placing CUBE/')).toBeVisible();

  // Drag to cycle through the discrete face registrations. Unlike
  // vertex-attach's continuous twist, two glued faces have no free
  // rotation -- only n discrete states that keep them flush (see
  // scripts/verify-face-twist.ts) -- so this confirms the cycling
  // interaction is wired, not a continuous angle.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 200, cy, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('text=/registration \\d+\\/4/')).toBeVisible();

  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('text=/Placing CUBE/')).toHaveCount(0);

  // Re-hovering the same screen position is NOT a reliable check here: the
  // newly-attached cube sits between the camera and the root along the
  // glued face's normal, so it now correctly occludes the root at that
  // exact pixel (real 3D occlusion, not a bug) -- hovering there next finds
  // the *new* cube's own free far face, not the root's now-occupied one.
  // Verify the actual graph instead, via the real persistence API.
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('text=Saved')).toBeVisible();

  const assembly = await page.evaluate(() => fetch('/api/assemblies').then((r) => r.json()));
  expect(assembly.nodes, 'expected two CUBE nodes after the face-attach').toHaveLength(2);
  expect(assembly.nodes.every((n: { shape: string }) => n.shape === 'CUBE')).toBe(true);
  expect(assembly.connections, 'expected exactly one connection').toHaveLength(1);
  expect(assembly.connections[0].kind, 'expected a face-kind connection').toBe('face');
});

test('cancelling a face-attach frees the target face again', async ({ page }) => {
  const { cx, cy } = await getCanvasCenter(page);

  await page.mouse.click(cx, cy);
  await page.getByRole('button', { name: 'Attach via face…' }).click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, 'Platonic');
  await clickWheelLabel(page, 'CUBE');
  await expect(page.locator('text=/Placing CUBE/')).toBeVisible();

  await page.getByRole('button', { name: 'Cancel (Esc)' }).click();
  await expect(page.locator('text=/Placing CUBE/')).toHaveCount(0);

  const textAfter = await readTooltipAt(page, cx, cy);
  expect(textAfter).toContain('CUBE');
  expect(textAfter).toMatch(/attach via this 4-gon face/);
});

test('face-attaching a RHOMBIC_DODECAHEDRON face only offers Catalan, never a dead-end family', async ({ page }) => {
  // Real user report: repeatedly hitting "Platonic" as an offered family
  // when face-attaching onto an RD (rhombic dodecahedron) face, every
  // time a guaranteed dead end (Platonic has zero shapes with a face
  // congruent to RD's rhombus -- confirmed directly against the whole
  // registry, not assumed) that had to be manually backed out of. Root
  // cause: the wheel's family-selection screen never applied filterIds
  // itself, only the shape-level screen one level in did, so every
  // family stayed clickable regardless of whether it had any real match.
  await resetTo(page, 'RHOMBIC_DODECAHEDRON');
  const { cx, cy } = await getCanvasCenter(page);

  await page.mouse.click(cx, cy);
  await page.getByRole('button', { name: 'Attach via face…' }).click();
  await openBrowserWheel(page);

  // Platonic (and every other non-Catalan family) must not be offered at
  // all -- not merely "offered but empty once you click in", genuinely
  // absent as a clickable face.
  await expect(page.locator('.pw-label-text', { hasText: exactLabel('Platonic') })).toHaveCount(0);
  await expect(page.locator('.pw-label-text', { hasText: exactLabel('Archimedean') })).toHaveCount(0);
  await expect(page.locator('.pw-label-text', { hasText: exactLabel('Johnson') })).toHaveCount(0);
  await expect(page.locator('.pw-label-text', { hasText: exactLabel('Prisms') })).toHaveCount(0);
  await expect(page.locator('.pw-label-text', { hasText: exactLabel('Antiprisms') })).toHaveCount(0);
  await expect(page.locator('.pw-label-text', { hasText: exactLabel('Deltahedra') })).toHaveCount(0);

  // Catalan IS offered, and drilling into it shows its FULL 13-member
  // roster (a second real complaint: dropping incompatible shapes out
  // of view entirely made the family look incomplete) -- but only RD
  // itself (the one shape in the registry with a face congruent to RD's
  // own rhombus) is actually clickable; everything else in the family
  // is visible yet marked spare/non-selectable, not hidden.
  await clickWheelLabel(page, exactLabel('Catalan'));

  const rdEntry = page.locator('.pw-label', { has: page.locator('.pw-label-text', { hasText: /RHOMBIC DODECAHEDRON/ }) });
  await expect(rdEntry).toBeVisible();
  await expect(rdEntry).not.toHaveClass(/spare/);

  const triakisTetEntry = page.locator('.pw-label', {
    has: page.locator('.pw-label-text', { hasText: /TRIAKIS TETRAHEDRON/ }),
  });
  await expect(triakisTetEntry).toBeVisible();
  await expect(triakisTetEntry).toHaveClass(/spare/);
});
