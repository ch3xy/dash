import { test, expect, API, field } from './helpers';

for (const [path, title] of Object.entries({
  dashboard: 'Dashboard',
  timer: 'Timer',
  timesheet: 'Timesheet',
  calendar: 'Kalender',
  clients: 'Kunden',
  projects: 'Projekte',
  tags: 'Tags',
  closing: 'Monatsabschluss',
  data: 'Daten',
  settings: 'Einstellungen',
})) {
  test(`Navigation: ${title}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/dashboard');
    await page
      .getByLabel('Hauptnavigation')
      .getByRole('link', { name: title, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${path}$`));
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('.page .spinner')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('Unbekannte Route führt zum Dashboard', async ({ page }) => {
  await page.goto('/does-not-exist');
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('Timer übersteht Reload, speichert geänderte Beschreibung und stoppt', async ({
  page,
  project,
  request,
}) => {
  await page.goto('/timer');
  const bar = page.locator('app-timer-bar');
  await expect(bar.getByRole('button', { name: 'Start', exact: true })).toBeDisabled();
  await bar.locator('.proj-select').selectOption({ label: project.name });
  await bar.getByPlaceholder('Woran arbeitest du?').fill('Timer-Test');
  await bar.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(bar.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
  try {
    await page.reload();
    await expect(bar.getByPlaceholder('Woran arbeitest du?')).toHaveValue('Timer-Test');
    await bar.getByPlaceholder('Woran arbeitest du?').fill('Geänderte Beschreibung');
    await bar.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(bar.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator('tbody')).toContainText('Geänderte Beschreibung');
    const entries = await request.get(`${API}/time-entries`, { params: { projectId: project.id } });
    expect((await entries.json()).content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ description: 'Geänderte Beschreibung', projectId: project.id }),
      ]),
    );
  } finally {
    const timer = await request.get(`${API}/timer/current`);
    const timerBody = await timer.text();
    const running = timerBody ? JSON.parse(timerBody) : null;
    if (running?.projectId === project.id)
      expect((await request.post(`${API}/timer/discard`, { data: {} })).ok()).toBeTruthy();
  }
});

test('Timer verwerfen erzeugt keinen Eintrag', async ({ page, project, request }) => {
  await page.goto('/timer');
  await page.locator('.proj-select').selectOption({ label: project.name });
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Timer verwerfen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
  const entries = await request.get(`${API}/time-entries`, { params: { projectId: project.id } });
  expect((await entries.json()).totalElements).toBe(0);
});

test('Manuellen Eintrag anlegen, bearbeiten und löschen', async ({ page, project }) => {
  await page.goto('/timer');
  await page.getByRole('button', { name: 'Eintrag', exact: true }).click();
  const dialog = page.locator('.dialog');
  await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  await field(dialog, 'Beschreibung').fill(project.name);
  await field(dialog, 'Projekt \\*').selectOption({ label: project.name });
  await field(dialog, 'Start').fill('09:00');
  await field(dialog, 'Ende').fill('10:30');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  const row = page.locator('tbody tr').filter({ hasText: project.name });
  await expect(row).toContainText('1:30');
  await row.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await field(dialog, 'Beschreibung').fill(`${project.name} geändert`);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await page.reload();
  await expect(row).toContainText('geändert');
  await row.getByRole('button', { name: 'Löschen', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen', exact: true }).click();
  await expect(row).toHaveCount(0);
});

test('Timesheet speichert Dauer und löscht eine geleerte Zelle', async ({ page, project }) => {
  await page.goto('/timesheet');
  await page.getByLabel('Projekt für neue Zeile').selectOption({ label: project.name });
  await page.getByRole('button', { name: 'Zeile', exact: true }).click();
  const cell = page.locator('tbody tr').filter({ hasText: project.name }).locator('input').first();
  await cell.fill('1,5');
  await cell.press('Enter');
  await expect(cell).toHaveValue('1:30');
  await page.reload();
  await expect(cell).toHaveValue('1:30');
  await cell.fill('');
  const cleared = page.waitForResponse(
    (r) => r.url().endsWith('/timesheet/cell') && r.request().method() === 'PUT',
  );
  await cell.press('Enter');
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen', exact: true }).click();
  expect((await cleared).ok()).toBeTruthy();
  await expect(cell).toBeEnabled();
  await page.reload();
  await expect(page.locator('tbody')).not.toContainText(project.name);
});

test('Kalender öffnet und bearbeitet einen vorhandenen Eintrag', async ({
  page,
  request,
  project,
}) => {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date());
  const response = await request.post(`${API}/time-entries`, {
    data: {
      projectId: project.id,
      description: 'Kalender-Test',
      startTime: `${day}T09:00:00+01:00`,
      endTime: `${day}T10:00:00+01:00`,
      billable: true,
      tagIds: [],
    },
  });
  expect(response.ok()).toBeTruthy();
  await page.goto('/calendar');
  const block = page.locator('.block').filter({ hasText: project.name });
  await block.focus();
  await block.press('Enter');
  const dialog = page.locator('.dialog');
  await field(dialog, 'Beschreibung').fill('Kalender geändert');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await page.reload();
  await expect(block).toContainText('Kalender geändert');
});

test('Report filtert Projekt und exportiert CSV und XLSX', async ({ page, request, project }) => {
  const now = new Date();
  expect(
    (
      await request.post(`${API}/time-entries`, {
        data: {
          projectId: project.id,
          description: 'Report-Test',
          startTime: new Date(now.getTime() - 3600000).toISOString(),
          endTime: now.toISOString(),
          billable: true,
          tagIds: [],
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto('/reports');
  await field(page.locator('.filter-bar'), 'Projekt').selectOption({ label: project.name });
  await page.getByRole('button', { name: 'Detailliert', exact: true }).click();
  await expect(page.locator('tbody').last()).toContainText('Report-Test');
  await page.reload();
  await expect(field(page.locator('.filter-bar'), 'Projekt')).toHaveValue(new RegExp(project.id));
  for (const format of ['CSV', 'XLSX']) {
    await page.getByRole('button', { name: 'Export ▾' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: `${format} herunterladen` }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(new RegExp(`\\.${format.toLowerCase()}$`));
    expect(await file.failure()).toBeNull();
  }
});

test('Farbschema bleibt nach Reload erhalten und folgt dem System', async ({ page }) => {
  await page.goto('/settings');
  const theme = field(page.locator('.page'), 'Farbschema');
  await theme.selectOption({ label: 'Dunkel' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(theme).toHaveValue(/dark/);
  await theme.selectOption({ label: 'System' });
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('Eintrag aufteilen erhält die Gesamtdauer', async ({ page, project, request }) => {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date());
  expect(
    (
      await request.post(`${API}/time-entries`, {
        data: {
          projectId: project.id,
          description: 'Aufteilen E2E',
          startTime: `${day}T09:00:00+01:00`,
          endTime: `${day}T11:00:00+01:00`,
          billable: true,
          tagIds: [],
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto('/timer');
  await page
    .locator('tbody tr')
    .filter({ hasText: project.name })
    .getByRole('button', { name: 'Aufteilen', exact: true })
    .click();
  await page.locator('.dialog input[type=time]').fill('10:00');
  await page.locator('.dialog').getByRole('button', { name: 'Aufteilen', exact: true }).click();
  await expect(page.locator('.dialog')).toHaveCount(0);
  const entries = await request.get(`${API}/time-entries`, { params: { projectId: project.id } });
  const content = (await entries.json()).content;
  expect(content).toHaveLength(2);
  expect(
    content.reduce(
      (sum: number, entry: { durationSeconds: number }) => sum + entry.durationSeconds,
      0,
    ),
  ).toBe(7200);
});

test('Mobile Navigation öffnet und schließt beim Seitenwechsel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Menü öffnen', exact: true }).click();
  await page
    .getByLabel('Hauptnavigation')
    .getByRole('link', { name: 'Projekte', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Projekte', exact: true })).toBeVisible();
  await expect(page.locator('.drawer-backdrop')).toHaveCount(0);
});
