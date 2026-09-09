import { test, expect } from './fixtures';
import { resetTo, getCanvasCenter, findOnCanvas, openBrowserWheel, clickWheelLabel, exactLabel } from './utils';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(500);
  await resetTo(page, 'CUBE');
});

async function downloadedJson(page: import('@playwright/test').Page, trigger: () => Promise<void>) {
  const [download] = await Promise.all([page.waitForEvent('download'), trigger()]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return { filename: download.suggestedFilename(), assembly: JSON.parse(Buffer.concat(chunks).toString('utf-8')) };
}

test('Export JSON downloads the current assembly as a real, valid JSON file', async ({ page }) => {
  const { filename, assembly } = await downloadedJson(page, () =>
    page.getByRole('button', { name: 'Export JSON' }).click(),
  );

  expect(filename).toMatch(/^polyhedraverse-.*\.json$/);
  expect(assembly.nodes).toHaveLength(1);
  expect(assembly.nodes[0].shape).toBe('CUBE');
  expect(assembly.connections).toHaveLength(0);
});

test('Export JSON reflects a confirmed attach, not just the root shape', async ({ page }) => {
  const { cx, cy } = await getCanvasCenter(page);
  const vertexHit = await findOnCanvas(page, cx, cy, (t) => /^vertex \d+ — capacity/.test(t));
  expect(vertexHit).not.toBeNull();

  await page.getByRole('button', { name: 'Attach via vertex…' }).click();
  await openBrowserWheel(page);
  await clickWheelLabel(page, exactLabel('Platonic'));
  await clickWheelLabel(page, 'CUBE');
  await expect(page.locator('text=/Placing CUBE/')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('text=/Placing CUBE/')).toHaveCount(0);

  const { assembly } = await downloadedJson(page, () =>
    page.getByRole('button', { name: 'Export JSON' }).click(),
  );
  expect(assembly.nodes).toHaveLength(2);
  expect(assembly.nodes.every((n: { shape: string }) => n.shape === 'CUBE')).toBe(true);
  expect(assembly.connections).toHaveLength(1);
});
