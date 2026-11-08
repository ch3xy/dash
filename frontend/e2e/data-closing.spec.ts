import { test, expect, API, field } from './helpers';

test('Backup herunterladen und Wiederherstellen abbrechen', async ({ page }) => {
  await page.goto('/data');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Backup exportieren', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^dash-backup-.*\.json$/);
  expect(await download.failure()).toBeNull();
  const file = page.locator('input[type=file]').first();
  await file.setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await expect(page.getByRole('dialog')).toContainText('Alle vorhandenen Daten');
  await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Datenlöschung verlangt ein Kriterium und die genaue Bestätigung', async ({
  page,
  request,
  project,
}) => {
  const now = new Date();
  expect(
    (
      await request.post(`${API}/time-entries`, {
        data: {
          projectId: project.id,
          startTime: new Date(now.getTime() - 3600000).toISOString(),
          endTime: now.toISOString(),
          billable: true,
          tagIds: [],
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto('/data');
  const preview = page.getByRole('button', { name: 'Betroffene Einträge ermitteln' });
  await expect(preview).toBeDisabled();
  await field(page.locator('.danger-zone'), 'Projekt').selectOption({ label: project.name });
  await preview.click();
  const remove = page.getByRole('button', { name: '1 Einträge endgültig löschen' });
  await expect(remove).toBeDisabled();
  const confirmation = page.locator('.danger-zone input[autocomplete=off]');
  await confirmation.fill('falsch');
  await expect(remove).toBeDisabled();
  await confirmation.fill('1 Einträge löschen');
  await remove.click();
  await expect(preview).toBeVisible();
  const entries = await request.get(`${API}/time-entries`, { params: { projectId: project.id } });
  expect((await entries.json()).totalElements).toBe(0);
});

test('Monatsabschluss sperrt Einträge und Freigabe verlangt Bestätigung', async ({
  page,
  request,
  project,
}) => {
  // A dedicated historical month avoids affecting current entries and running timers.
  const month = '2001-02';
  expect(
    (
      await request.post(`${API}/time-entries`, {
        data: {
          projectId: project.id,
          startTime: `${month}-15T09:00:00Z`,
          endTime: `${month}-15T10:00:00Z`,
          billable: true,
          tagIds: [],
        },
      })
    ).ok(),
  ).toBeTruthy();
  try {
    await page.goto('/closing');
    const row = page.locator('tbody tr').filter({ hasText: 'Februar 2001' });
    await row.getByRole('button', { name: 'Abschließen', exact: true }).click();
    await page.getByRole('dialog').locator('input').fill('E2E Abschluss');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Abschließen', exact: true })
      .click();
    await expect(row).toContainText('Abgeschlossen');
    await page.goto(`/timer?date=${month}-15`);
    await expect(page.getByRole('button', { name: 'Eintrag', exact: true })).toBeDisabled();
    await page.goto('/data');
    await field(page.locator('.danger-zone'), 'Projekt').selectOption({ label: project.name });
    await page.getByRole('button', { name: 'Betroffene Einträge ermitteln' }).click();
    await expect(page.locator('.danger-summary')).toContainText('können nicht gelöscht werden');
    await page.goto('/closing');
    await row.getByRole('button', { name: 'Freigeben', exact: true }).click();
    const unlock = page.getByRole('button', { name: 'Monat freigeben', exact: true });
    await expect(unlock).toBeDisabled();
    await page.locator('input[autocomplete=off]').fill('Februar 2001 freigeben');
    await unlock.click();
    await expect(row).toContainText('Offen');
  } finally {
    const cleanup = await request.delete(`${API}/closing/months/${month}/lock`);
    expect([204, 200, 404]).toContain(cleanup.status());
  }
});

test('Monatsabschluss bietet nach Ladefehler einen erfolgreichen Retry', async ({ page }) => {
  await page.route(
    '**/api/v1/closing/months',
    (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
    { times: 1 },
  );
  await page.goto('/closing');
  await expect(page.locator('.page')).toContainText('Monate konnten nicht geladen werden.');
  await page.getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(page.locator('.page')).not.toContainText('Monate konnten nicht geladen werden.');
  await expect(page.locator('.page .spinner')).toHaveCount(0);
});

test('Einstellungen speichern und nach Reload laden', async ({ page, request }) => {
  const response = await request.get(`${API}/settings`);
  expect(response.ok()).toBeTruthy();
  const original = await response.json();
  try {
    await page.goto('/settings');
    await field(page.locator('.page'), 'Standard-Stundensatz').fill('137');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(
      page.locator('.toast').filter({ hasText: 'Einstellungen gespeichert' }),
    ).toContainText('Einstellungen gespeichert');
    await page.reload();
    await expect(field(page.locator('.page'), 'Standard-Stundensatz')).toHaveValue('137');
  } finally {
    expect((await request.put(`${API}/settings`, { data: original })).ok()).toBeTruthy();
  }
});

test('Clockify CSV importiert Einträge und überspringt Duplikate', async ({ page, project }) => {
  await page.goto('/data');
  const csv = `Project,Client,Description,Task,Tags,Billable,Start Date,Start Time,End Date,End Time\n${project.name},,CSV E2E,,,Yes,2002-03-15,08:00:00,2002-03-15,09:30:00\n`;
  const file = { name: 'clockify.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) };
  const upload = page.locator('input[type=file]').nth(1);
  await upload.setInputFiles(file);
  await expect(
    page.locator('.toast').filter({ hasText: 'Import: 1 importiert, 0 Duplikate' }),
  ).toBeVisible();
  await upload.setInputFiles(file);
  await expect(
    page.locator('.toast').filter({ hasText: 'Import: 0 importiert, 1 Duplikate' }),
  ).toBeVisible();
});
