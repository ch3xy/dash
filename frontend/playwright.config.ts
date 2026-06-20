import { defineConfig } from '@playwright/test';

/**
 * E2E config. Assumes the full stack is already running:
 *   - backend on :8080 (./mvnw spring-boot:run, Postgres via docker compose)
 *   - frontend dev server on :4200 (npm start)
 * Uses the locally installed Google Chrome (channel) to avoid downloading browsers.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4200',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
  },
});
