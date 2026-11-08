import { defineConfig } from '@playwright/test';

// Start the full stack first; see e2e/README.md. Never target a production database.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1, // The application has a single global timer and settings record.
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
    ...(process.env['PW_CHROMIUM_EXECUTABLE']
      ? { launchOptions: { executablePath: process.env['PW_CHROMIUM_EXECUTABLE'] } }
      : { channel: 'chrome' }),
    timezoneId: 'Europe/Vienna',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
