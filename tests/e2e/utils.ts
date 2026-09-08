import type { Page } from '@playwright/test';
import { DELTAHEDRON_IDS, PLATONIC_ADDITION_IDS, ARCHIMEDEAN_ADDITION_IDS, JOHNSON_ADDITION_IDS } from '../../app/lib/polyhedra';

export async function getCanvasCenter(page: Page): Promise<{ cx: number; cy: number }> {
  // Scoped to <main> specifically -- CornerHudWheel mounts its own small
  // canvas too, so a bare `page.locator('canvas')` now matches 2
  // elements and throws a strict-mode violation.
  const canvas = page.getByRole('main').locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas not found or not visible');
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
}

export const WHEEL_FAMILIES: { label: string; ids: string[] }[] = [
  { label: 'Deltahedra', ids: DELTAHEDRON_IDS },
  { label: 'Platonic', ids: PLATONIC_ADDITION_IDS },
  { label: 'Archimedean', ids: ARCHIMEDEAN_ADDITION_IDS },
  { label: 'Johnson', ids: JOHNSON_ADDITION_IDS },
];

/**
 * Clicks a PolyhedralWheel face label by its visible text, searching for it
 * if it isn't currently front-facing. A dodecahedron has 12 faces spread
 * all around a sphere, so whatever's populated when the wheel opens (or
 * after navigating into a family) may not include the target face without
 * rotating first -- same fundamental problem findOnCanvas() solves for
 * WebGL vertex-picking, just for a second, independent 3D scene. A face's
 * label div gets `pointer-events: none` while not front-facing (see
 * PolyhedralWheel.tsx's per-frame label update), so a bounded click-and-
 * catch search across camera orientations is both correct (a facing-but-
 * off-target face never gets a false-positive click) and fast (no pixel
 * sweep needed, just camera repositioning via the wheel's own exposed
 * `__pwGoTo`, then a single try/catch click at each orientation).
 */
export async function clickWheelLabel(page: Page, text: string): Promise<void> {
  const locator = page.locator('.pw-label', { hasText: text }).first();
  const snapshot = async (): Promise<string> => (await page.locator('.pw-label-text').allTextContents()).join(' ');

  // A click that lands right as onSelect's setTimeout(0)-deferred state
  // update re-renders the wheel (navigating a level, closing it) can have
  // Playwright's own click() report a timeout/failure even though the
  // click itself already fired and had its real effect -- its internal
  // post-click verification can race against that DOM change. So a
  // reported "failure" is ambiguous: it might mean nothing happened, or
  // it might mean the click worked. Comparing the *whole* label-text
  // snapshot before vs. after a failed-looking click (not just whether
  // this one locator's own text is gone) is what correctly resolves that
  // ambiguity: unlike a one-off shape label, "More" reappears identically
  // labeled on the very next page, so "is this locator gone" never fires
  // for it. That false negative used to make this code conclude a
  // click that had actually already succeeded had failed, and issue a
  // real second click -- silently double-advancing past a page. Caught
  // via render.spec.ts's full-registry test: the Johnson family (31 ids,
  // 3 pages) would skip page 1 entirely, landing on page 2 after a
  // single "More" click, and only a stability-polling read of the
  // resulting labels (rather than an immediate one) surfaced it
  // reliably -- the immediate read sometimes got lucky and caught the
  // brief page-1 state between the two real clicks.
  const tryClick = async (): Promise<boolean> => {
    const before = await snapshot();
    try {
      await locator.click({ timeout: 900 });
      return true;
    } catch {
      // Poll briefly -- the deferred state update may land just after
      // Playwright's own click() call gave up waiting to confirm it.
      const deadline = Date.now() + 500;
      while (Date.now() < deadline) {
        if ((await snapshot()) !== before) return true;
        await page.waitForTimeout(60);
      }
      return false;
    }
  };

  if (await tryClick()) return;

  // 8 azimuth steps (45 deg apart -- a full revolution) x 3 polar bands
  // (level, tilted up, tilted down) covers every face of the wheel from
  // any starting orientation.
  for (const polarIndex of [0, -1, 1]) {
    for (let azimuthIndex = 0; azimuthIndex < 8; azimuthIndex++) {
      await page.evaluate(
        ([ai, pi]) => {
          const el = document.querySelector('[data-testid="polyhedral-wheel-scene"]') as unknown as {
            __pwGoTo?: (azimuthIndex: number, polarIndex: number) => void;
          } | null;
          el?.__pwGoTo?.(ai, pi);
        },
        [azimuthIndex, polarIndex] as const,
      );
      // Give the wheel's own requestAnimationFrame loop a beat to actually
      // apply the new label positions/pointer-events to the DOM before
      // Playwright starts polling for actionability.
      await page.waitForTimeout(120);
      if (await tryClick()) return;
    }
  }

  throw new Error(`clickWheelLabel: could not find/click a face labelled "${text}" at any orientation`);
}

export const CONTENT_FACES_PER_PAGE = 11; // must match PolyhedralWheel.tsx's own constant

/**
 * Like clickWheelLabel, but also pages forward (clicking "More") when a
 * family's shape list overflows a single 12-face wheel -- only Archimedean
 * does today (13 shapes), but Johnson will too as later batches grow it
 * past 11.
 */
export async function clickWheelLabelPaged(page: Page, text: string, familyIds: string[]): Promise<void> {
  const pages = familyIds.length > CONTENT_FACES_PER_PAGE ? Math.ceil(familyIds.length / CONTENT_FACES_PER_PAGE) : 1;
  for (let p = 0; p < pages; p++) {
    // Cheap presence check before the expensive path: clickWheelLabel's
    // exhaustive 24-orientation search (worst case tens of seconds) is
    // only worth running once we already know the target is somewhere
    // on THIS page -- calling it unconditionally on every wrong page,
    // just to have it fail and conclude "not here", scales terribly as
    // a family grows past a handful of pages (Johnson alone is 6 pages
    // as of this batch, worse every batch after). A DOM-only count()
    // check for the label text (present regardless of which way the
    // wheel currently faces, same as clickWheelLabel's own locator)
    // settles that in one query instead of a multi-second sweep -- but
    // it has to POLL, not check once: a single instant count() removes
    // the implicit wait Playwright's own locator.click() used to give
    // (up to 900ms of actionability auto-retry) before this fix existed.
    // Caught for real: this passed standalone but failed as test #6 in
    // the full suite, right after a heavier persisted 2-node assembly
    // had just loaded -- the DOM genuinely hadn't caught up to the new
    // page's labels yet at the exact instant a one-shot check would run.
    const labelLocator = page.locator('.pw-label', { hasText: text });
    let present = (await labelLocator.count()) > 0;
    const deadline = Date.now() + 2000;
    while (!present && Date.now() < deadline) {
      await page.waitForTimeout(100);
      present = (await labelLocator.count()) > 0;
    }
    if (present) {
      await clickWheelLabel(page, text);
      return;
    }
    if (p < pages - 1) await clickWheelLabel(page, 'More');
  }
  throw new Error(`clickWheelLabelPaged: could not find "${text}" across ${pages} page(s)`);
}

/** Opens the PolyhedralWheel, navigates to specId's family, picks it, and waits for the reset to settle. */
export async function resetTo(page: Page, specId: string): Promise<void> {
  const family = WHEEL_FAMILIES.find((f) => f.ids.includes(specId));
  if (!family) throw new Error(`resetTo: "${specId}" isn't in any known wheel family`);
  await page.getByRole('button', { name: /^Start over with/ }).click();
  await clickWheelLabel(page, family.label);
  await clickWheelLabelPaged(page, specId.replaceAll('_', ' '), family.ids);
  await page.waitForTimeout(300);
}

/** Reads the floating hover-tooltip's text after moving the mouse to (x, y), or '' if none is shown. */
export async function readTooltipAt(page: Page, x: number, y: number, settleMs = 50): Promise<string> {
  await page.mouse.move(x, y);
  await page.waitForTimeout(settleMs);
  const label = page.locator('.pointer-events-none.absolute.z-10');
  const visible = await label.isVisible().catch(() => false);
  return visible ? ((await label.textContent()) ?? '') : '';
}

export interface FindResult {
  dx: number;
  dy: number;
  text: string;
}

/**
 * Sweeps the mouse over a square region around (cx, cy) until the floating
 * tooltip's text satisfies `predicate`, then (by default) clicks there.
 *
 * Vertices and node bodies aren't separate DOM elements — they're raycast
 * hits against a WebGL canvas — so from outside the app a pixel sweep
 * reading the tooltip text is the only way to find one. This is
 * comparatively slow (each step is a real round-trip through the browser),
 * so callers should prefer a direct readTooltipAt() wherever the target's
 * screen position is already known or derivable (e.g. a root node's body
 * always projects to the canvas center) and reserve sweeping for genuinely
 * unknown positions like "some free vertex."
 */
export async function findOnCanvas(
  page: Page,
  cx: number,
  cy: number,
  predicate: (text: string) => boolean,
  opts: { click?: boolean; radius?: number; step?: number } = {},
): Promise<FindResult | null> {
  const { click = true, radius = 160, step = 16 } = opts;

  for (let dx = -radius; dx <= radius; dx += step) {
    for (let dy = -radius; dy <= radius; dy += step) {
      const text = await readTooltipAt(page, cx + dx, cy + dy, 10);
      if (text && predicate(text)) {
        if (click) await page.mouse.click(cx + dx, cy + dy);
        return { dx, dy, text };
      }
    }
  }
  return null;
}

/**
 * Finds a node's body by trying the canvas center first (a root node's
 * centroid is always the world origin, which projects there under the
 * default camera — no sweep needed for the common case) and only falls back
 * to a full sweep if that miss(es) — e.g. another node visually occludes it.
 */
export async function findNodeBody(
  page: Page,
  cx: number,
  cy: number,
  predicate: (text: string) => boolean,
): Promise<FindResult | null> {
  const direct = await readTooltipAt(page, cx, cy);
  if (direct && predicate(direct)) {
    await page.mouse.click(cx, cy);
    return { dx: 0, dy: 0, text: direct };
  }
  return findOnCanvas(page, cx, cy, predicate);
}
