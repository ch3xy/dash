import { test, expect, APIRequestContext } from '@playwright/test';

const API = 'http://localhost:8080/api/v1';
const RUN = Date.now();
const PROJECT_NAME = `E2E Projekt ${RUN}`;

let projectId: string;

async function createProject(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API}/projects`, {
    data: {
      name: PROJECT_NAME,
      defaultHourlyRate: '100.00',
      currencyCode: 'EUR',
      billableByDefault: true,
      budgetReset: 'NONE',
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).id;
}

test.beforeAll(async ({ request }) => {
  projectId = await createProject(request);
  // Seed one completed entry for today so the report flow is independent of the timer flow.
  const now = new Date();
  const start = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const res = await request.post(`${API}/time-entries`, {
    data: {
      projectId,
      description: `seed ${RUN}`,
      startTime: start,
      endTime: now.toISOString(),
      billable: true,
      tagIds: [],
    },
  });
  expect(res.ok()).toBeTruthy();
});

test('App-Shell lädt mit Navigation', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('.sidebar')).toContainText('Dashboard');
  await expect(page.locator('.sidebar')).toContainText('Reports');
});

test('Timer per UI starten und stoppen erzeugt einen Eintrag', async ({ page }) => {
  await page.goto('/timer');

  await page.locator('select.proj-select').selectOption({ label: PROJECT_NAME });
  await page.getByRole('button', { name: /Start/ }).click();

  // Running state: Stop button appears and the live elapsed counter is shown.
  await expect(page.getByRole('button', { name: /Stop/ })).toBeVisible();
  await page.getByRole('button', { name: /Stop/ }).click();

  // Back to idle: Start is available again.
  await expect(page.getByRole('button', { name: /Start/ })).toBeVisible();

  // The stopped entry shows up in today's list after a reload.
  await page.goto('/timer');
  await expect(page.locator('table.table tbody')).toContainText(PROJECT_NAME);
});

test('Gebuchte Zeit erscheint im Report', async ({ page }) => {
  await page.goto('/reports');
  // The seeded entry's project appears in the detailed table.
  await expect(page.locator('.card table.table').last()).toContainText(PROJECT_NAME);
});
