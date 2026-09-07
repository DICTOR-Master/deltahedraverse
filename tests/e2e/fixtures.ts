import { test as base, expect } from '@playwright/test';

/**
 * Every test in this suite automatically fails if the page logs a console
 * error or an uncaught exception during the test — the app should never do
 * either, no matter which interaction path a test drives it through.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

      await use(errors);

      expect(errors, `unexpected browser console errors:\n${errors.join('\n')}`).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
