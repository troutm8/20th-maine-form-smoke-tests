import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests for the 20th Maine Co. G enlistment form (Wix).
 *
 * BASE_URL can be overridden, e.g. to point at a copy of the page.
 * Tests tagged @known-gap document behaviour we'd like to change; they are
 * excluded from the nightly run (see package.json "test:nightly").
 * The real-submission test only runs when SUBMIT_TEST=1.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // be polite to the live site: one page at a time
  workers: 1,
  retries: process.env.CI ? 2 : 0, // Wix pages occasionally load slowly; retry before alerting
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://www.20thmainecompanyg.com',
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
