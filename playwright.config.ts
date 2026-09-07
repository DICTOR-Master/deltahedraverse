import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  // Tests share one persisted assembly file (.data/assembly.json) via the
  // real /api/assemblies route — run serially so parallel workers can't
  // race on writing/reading it.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  // findOnCanvas (tests/e2e/utils.ts) sweeps the mouse pixel-by-pixel over a
  // WebGL canvas looking for a tooltip — there's no DOM element to wait on,
  // so this is legitimately slower than typical UI interactions. The default
  // 30s test timeout was cutting these off mid-sweep.
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
