# Playwright E2E

Die Suite prüft die echte Angular-App mit Spring-Boot-Backend und PostgreSQL.
Nur der gezielte Ladefehler-Test simuliert eine HTTP-Antwort. Ein Worker ist
absichtlich festgelegt: Timer, Einstellungen und Monatsabschlüsse sind global.

## Ausführen

**Eine separate, ausschließlich für Tests bestimmte Datenbank verwenden.**
Die Tests erstellen und löschen Zeiteinträge, ändern Einstellungen und schließen
einen historischen Monat. Einstellungen werden im `finally` wiederhergestellt,
der Monat wieder freigegeben und Fixture-Einträge gelöscht. Projekte und Tags
werden archiviert, da es dafür keine öffentliche Lösch-API gibt. Für dauerhaft
saubere Wiederholungen die Testdatenbank neu erstellen.

Stack entsprechend der Haupt-README starten, dabei das Backend mit einer eigenen
Testdatenbank verbinden. Anschließend:

```bash
cd frontend
npm run e2e
```

Abweichende Adressen und ein vorhandener Chromium sind konfigurierbar:

```bash
E2E_BASE_URL=http://localhost:4300 \
E2E_API_URL=http://localhost:8090/api/v1 \
PW_CHROMIUM_EXECUTABLE=/path/to/chromium \
npm run e2e
```

Ohne `PW_CHROMIUM_EXECUTABLE` wird installiertes Google Chrome verwendet.
Der Frontend-Proxy muss auf dasselbe Backend wie `E2E_API_URL` zeigen.
HTML-Bericht: `npx playwright show-report`. Fehler erzeugen Screenshot und Trace.

## Abdeckung

- Navigation aller Hauptseiten, unbekannte Route, mobile Navigation
- Timer: fehlendes Projekt, Start, Reload, Beschreibung ändern, Stop, Verwerfen
- Manuelle Einträge: Anlegen, Bearbeiten, Löschen, Aufteilen mit Erhalt der Dauer
- Timesheet: Zeile anlegen, Dauerformat, Speichern, Reload, Leeren
- Kalender: vorhandenen Eintrag öffnen und bearbeiten
- Kunden: Pflichtfelder, Anlegen, Bearbeiten, Archivieren, Löschabbruch, Löschen, 404
- Projekte: Anlegen, Budgetvalidierung, Bearbeiten, Statuswechsel
- Tasks: Anlegen, Bearbeiten, Archivieren; Ratenhistorie: Hinzufügen und Reload
- Tags: Anlegen, Umbenennen, Archivieren, Filterpersistenz
- Globale Suche: Projekttreffer und Navigation
- Reports: Projektfilter, Detailansicht, Filterpersistenz, CSV-/XLSX-Downloads
- Einstellungen: Speichern/Reload, Theme-Persistenz und Systemfarbschema
- Daten: Backup-Download, Restore-Abbruch, CSV-Import und Duplikaterkennung,
  Löschkriterien, Bestätigung und tatsächliches Löschen
- Monatsabschluss: Abschließen, gesperrte Bearbeitung und Datenlöschung,
  Freigabebestätigung sowie Ladefehler mit Retry

Das ist breite Funktionsabdeckung, keine vollständige Code- oder Variantenabdeckung.
Offen bleiben insbesondere Kalender-Drag/Resize/Touch, alle Reportkombinationen,
Pagination mit großen Datenmengen, Bulk-Bearbeitung, Vorwoche kopieren,
Tastaturkürzel und ein vollständiger Restore mit Ersetzen aller Daten.
Downloads werden auf erfolgreichen Abschluss geprüft; ihre fachlichen Inhalte
werden zusätzlich durch Backend-Integrationstests abgedeckt.

TypeScript-Prüfung der Tests separat ausführen: `npm run e2e:typecheck`.

Beobachtung beim Ausbau: Extrem lange Projektnamen können den Stop-Button des
laufenden Timers unter die globale Suche schieben (Desktop-Standardviewport).
Dieser Layoutfehler ist noch offen; die funktionalen Timerfälle verwenden kurze,
eindeutige Projektnamen.
