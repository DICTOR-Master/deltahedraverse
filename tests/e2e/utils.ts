import type { Page } from '@playwright/test';

export async function getCanvasCenter(page: Page): Promise<{ cx: number; cy: number }> {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas not found or not visible');
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
}

/** Clicks the "Start over with {specId}" button and waits for the reset to settle. */
export async function resetTo(page: Page, specId: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${specId}\\(`) }).click();
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
