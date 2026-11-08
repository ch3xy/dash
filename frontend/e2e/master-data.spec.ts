import { test, expect, API, field } from './helpers';

test('Kunde: Pflichtfeld, anlegen, bearbeiten, archivieren und löschen', async ({
  page,
  request,
}) => {
  const name = `E2E Kunde ${Date.now()}`;
  let id: string | undefined;
  try {
    await page.goto('/clients');
    await page.getByRole('button', { name: 'Kunde', exact: true }).click();
    const dialog = page.locator('.dialog');
    await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    await field(dialog, 'Name \\*').fill(name);
    await field(dialog, 'E-Mail').fill('e2e@example.org');
    const created = page.waitForResponse(
      (r) => r.url().endsWith('/clients') && r.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    id = (await (await created).json()).id;
    await page.goto(`/clients/${id}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
    await expect(page.locator('.page')).toContainText('e2e@example.org');
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
    await field(dialog, 'Name \\*').fill(`${name} geändert`);
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('geändert');
    await page.getByRole('button', { name: 'Archivieren', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Archiviert');
    await page.getByRole('main').getByRole('button', { name: 'Löschen', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
    await page.getByRole('main').getByRole('button', { name: 'Löschen', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Löschen', exact: true }).click();
    await expect(page).toHaveURL(/\/clients$/);
    id = undefined;
  } finally {
    if (id) expect((await request.delete(`${API}/clients/${id}`)).ok()).toBeTruthy();
  }
});

test('Projektformular validiert Budget und speichert Änderungen', async ({ page, project }) => {
  await page.goto(`/projects/${project.id}`);
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  const dialog = page.locator('.dialog');
  await field(dialog, 'Stundenbudget \\(h\\)').fill('-1');
  await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  await field(dialog, 'Stundenbudget \\(h\\)').fill('20');
  await field(dialog, 'Beschreibung').fill('Projektbeschreibung E2E');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await expect(field(dialog, 'Stundenbudget \\(h\\)')).toHaveValue('20');
  await expect(field(dialog, 'Beschreibung')).toHaveValue('Projektbeschreibung E2E');
});

test('Tasks anlegen, bearbeiten und archivieren; Ratenhistorie ergänzen', async ({
  page,
  project,
}) => {
  await page.goto(`/projects/${project.id}`);
  await page.getByPlaceholder('Task-Name').fill('E2E Task');
  await page.getByRole('button', { name: 'Task', exact: true }).click();
  const row = page.locator('.task-row').filter({ hasText: 'E2E Task' });
  await row.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  const dialog = page.locator('.dialog');
  await field(dialog, 'Name \\*').fill('E2E Task geändert');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(row).toContainText('geändert');
  await row.getByRole('button', { name: 'Archivieren' }).click();
  await expect(row).toContainText('archiviert');
  await page.getByRole('button', { name: 'Ratenhistorie', exact: true }).click();
  await field(page.locator('.page'), 'Neuer Stundensatz').fill('125');
  await field(page.locator('.page'), 'Gültig ab').fill('2020-01-01');
  await field(page.locator('.page'), 'Notiz').fill('E2E Rate');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Ratenhistorie', exact: true }).click();
  await expect(page.locator('tbody')).toContainText('E2E Rate');
});

test('Tag anlegen, umbenennen und archivierte Tags einblenden', async ({ page }) => {
  const name = `E2E Tag ${Date.now()}`;
  await page.goto('/tags');
  await page.getByPlaceholder('Tag-Name').fill(name);
  await page.getByRole('button', { name: 'Tag', exact: true }).click();
  const row = page.locator('.row-between').filter({ hasText: name });
  await row.getByRole('button', { name: 'Umbenennen' }).click();
  await page.getByRole('dialog').locator('input').fill(`${name} geändert`);
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(row).toContainText('geändert');
  await row.getByRole('button', { name: 'Archivieren', exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.getByLabel('Archivierte', { exact: true }).check();
  await expect(row).toContainText('Archiviert');
  await page.reload();
  await expect(row).toContainText('Archiviert');
});

test('Nicht vorhandener Kunde zeigt einen verständlichen Fehler', async ({ page }) => {
  await page.goto('/clients/00000000-0000-0000-0000-000000000000');
  await expect(page.locator('.page')).toContainText('Kunde nicht gefunden.');
});

test('Projekt über UI anlegen und Status ändern', async ({ page, request }) => {
  const name = `E2E Neues Projekt ${Date.now()}`;
  let id: string | undefined;
  try {
    await page.goto('/projects');
    await page.getByRole('button', { name: 'Projekt', exact: true }).click();
    const dialog = page.locator('.dialog');
    await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    await field(dialog, 'Name \\*').fill(name);
    const response = page.waitForResponse(
      (r) => r.url().endsWith('/projects') && r.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    id = (await (await response).json()).id;
    await page.goto(`/projects/${id}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
    const statusSaved = page.waitForResponse(
      (r) => r.url().endsWith(`/projects/${id}/status`) && r.request().method() === 'PATCH',
    );
    await page.locator('.page-header select').selectOption({ label: 'Archiviert' });
    expect((await statusSaved).ok()).toBeTruthy();
    await page.reload();
    await expect(page.locator('.page-header select')).toHaveValue(/ARCHIVED/);
  } finally {
    if (id)
      expect(
        (
          await request.patch(`${API}/projects/${id}/status`, { data: { status: 'ARCHIVED' } })
        ).ok(),
      ).toBeTruthy();
  }
});

test('Globale Suche öffnet ein gefundenes Projekt', async ({ page, project }) => {
  await page.goto('/dashboard');
  await page.getByPlaceholder('Suche… (Einträge, Projekte, Kunden)').fill(project.name);
  await page
    .locator('.search-panel')
    .getByRole('button', { name: project.name, exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
  await expect(page.getByRole('heading', { level: 1 })).toContainText(project.name);
});
