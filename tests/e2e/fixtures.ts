import { test as base, expect } from '@playwright/test';

// Matches app/lib/prefs.ts's STORAGE_KEY and Prefs shape exactly -- seeded
// before any page script runs so WelcomeOverlay (app/components/
// WelcomeOverlay.tsx) never appears during this suite. Every existing spec
// does a bare page.goto('/') with no other setup and immediately interacts
// with things underneath (the "Start over…" button, etc.) -- a fresh
// visitor's real first-visit welcomeSeen:false would otherwise block all
// of that behind a modal none of these tests are actually testing. A
// dedicated welcome-overlay spec (if one gets added) should clear this
// seeded storage itself rather than relying on this fixture's default.
const SEEDED_PREFS = JSON.stringify({
  favorites: [],
  recents: [],
  language: 'en',
  theme: { presetId: 'classicGreen', colors: { bg: '#000000', text: '#5ee233', accent: '#47cc24' } },
  welcomeSeen: true,
});

/**
 * Every test in this suite automatically fails if the page logs a console
 * error or an uncaught exception during the test — the app should never do
 * either, no matter which interaction path a test drives it through.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      await page.addInitScript((serializedPrefs) => {
        window.localStorage.setItem('polyhedraverse:prefs:v1', serializedPrefs);
      }, SEEDED_PREFS);

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
