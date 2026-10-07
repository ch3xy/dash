# Modul: closing (Monatsabschluss)

Package: `com.ch3xy.dash.closing` — `MonthLockService`, `MonthClosingController`.

## Zweck

Ein abgeschlossener Monat macht alle Zeiteinträge, deren `entryDate` in diesem Monat liegt,
schreibgeschützt – bis der Monat wieder freigegeben wird. Typischer Ablauf: Monat prüfen
(Reports), abrechnen, abschließen (optional mit Notiz, z. B. Rechnungsnummer).

## Regeln

- Nur vollständig vergangene Monate (in App-Zeitzone) können abgeschlossen werden → sonst 422.
  Dadurch kann ein laufender Timer nie in einem gesperrten Monat landen.
- Erneutes Abschließen → 409; Freigeben eines offenen Monats → 404.
- `MonthLockService.requireOpen(date)` wirft `IllegalStateException` (→ 409, deutsche Meldung).
  Aufgerufen in `TimeEntryService`: `create` (alle Quellen), `update` (alter **und** neuer Monat),
  `delete`, `deleteAll`, `bulkUpdate`, `split`.
- `delete-preview` liefert `lockedCount`; `delete-by-criteria` lehnt ab, solange `lockedCount > 0`.
- Clockify-Import: Zeilen in gesperrten Monaten werden als Warnung übersprungen (per-Row-Transaktion).
- Backup enthält `monthLocks`; Restore ersetzt die Sperren (alte Backups ohne Feld → keine Sperren).
- Freigabe im UI nur mit Bestätigungseingabe `<Monat Jahr> freigeben` (z. B. `September 2026 freigeben`).

## Frontend

- Seite `/closing` (Sidebar „Monatsabschluss" unter Reports): Monatsliste mit Kennzahlen, Abschließen/Freigeben.
- `MonthLockStateService` (root): Signal mit gesperrten Monaten, `isLocked(isoDate)`.
- `<app-month-locked-banner [dates]>`: Hinweis in Timer, Timesheet, Kalender.
- Timesheet: Zellen gesperrter Tage `readonly`, „Vorwoche kopieren" deaktiviert.
- Timer: keine Auswahl/Bearbeiten/Löschen/Split/Duplizieren; „Fortsetzen" bleibt (erzeugt Eintrag heute).
- Kalender: kein Erstellen/Verschieben/Resize; Klick öffnet Dialog nur lesend.
- Reports: bei genau einem vergangenen Monat als Zeitraum Button „Monat abschließen" bzw. Badge „Abgeschlossen".
