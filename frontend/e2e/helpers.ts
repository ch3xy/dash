import { test as base, expect, type Locator } from '@playwright/test';

export const API = process.env['E2E_API_URL'] ?? 'http://localhost:8080/api/v1';
export const field = (scope: Locator, label: string) =>
  scope
    .locator('.field')
    .filter({ has: scope.page().locator('label', { hasText: new RegExp(`^${label}$`) }) })
    .locator('input, textarea, select')
    .first();

// Each test owns its project and entries; no test depends on another test's output.
export const test = base.extend<{ project: { id: string; name: string } }>({
  project: async ({ request }, use, testInfo) => {
    const name = `E2E ${Date.now().toString(36)} ${testInfo.testId.slice(-6)}`;
    const response = await request.post(`${API}/projects`, {
      data: {
        name,
        defaultHourlyRate: '100.00',
        currencyCode: 'EUR',
        billableByDefault: true,
        budgetReset: 'NONE',
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    const project = await response.json();
    try {
      await use(project);
    } finally {
      const timer = await request.get(`${API}/timer/current`);
      const timerBody = await timer.text();
      const running = timerBody ? JSON.parse(timerBody) : null;
      if (running?.projectId === project.id)
        expect((await request.post(`${API}/timer/discard`, { data: {} })).ok()).toBeTruthy();
      const entries = await request.get(`${API}/time-entries`, {
        params: { projectId: project.id, size: 1000 },
      });
      expect(entries.ok()).toBeTruthy();
      for (const entry of (await entries.json()).content) {
        expect((await request.delete(`${API}/time-entries/${entry.id}`)).ok()).toBeTruthy();
      }
      expect(
        (
          await request.patch(`${API}/projects/${project.id}/status`, {
            data: { status: 'ARCHIVED' },
          })
        ).ok(),
      ).toBeTruthy();
    }
  },
});
export { expect };
