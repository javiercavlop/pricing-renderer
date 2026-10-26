import { defineConfig, devices, type ReporterDescription } from '@playwright/test';

const visualSnapshotSuffix = process.platform === 'linux' ? '-linux' : '';

// Shard jobs set PW_BLOB=1 so their reports can be merged later.
const isBlobRun = Boolean(process.env.CI) && process.env.PW_BLOB === '1';
// Shard jobs have a 25 minute job timeout, so the run must end before it.
const globalTimeoutMs = process.env.CI ? (isBlobRun ? 15 : 30) * 60_000 : 0;
const ciReporter: ReporterDescription[] = isBlobRun
  ? [['blob'], ['github']]
  : [['html', { open: 'never' }], ['github']];
const reporter = process.env.CI ? ciReporter : 'list';
// The two heavy specs (ux-stress and the SPECTRA review) are on demand on CI: one flag,
// PW_UX_STRESS=1, set only by the manual on-demand-specs job of ci.yml, runs both.
const testIgnore =
  process.env.CI && process.env.PW_UX_STRESS !== '1'
    ? ['**/ux-stress.spec.ts', '**/spectra-review.spec.ts']
    : undefined;

export default defineConfig({
  testDir: './tests/browser',
  testIgnore,
  snapshotPathTemplate: `{testDir}/{testFilePath}-snapshots/{arg}${visualSnapshotSuffix}{ext}`,
  timeout: 30_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixelRatio: 0.015,
    },
  },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // On CI a run that goes wrong stops early instead of using the whole job budget.
  globalTimeout: globalTimeoutMs,
  maxFailures: process.env.CI ? 20 : 0,
  reporter,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm demo',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
