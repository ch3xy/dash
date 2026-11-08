# Prüfbericht – 08.11.2026

- Basis-Commit: `1b98973b093a8f4da389bc64e7d8bd21672689ee`, mit lokalen E2E-/Konfigurations-/Dokumentationsänderungen.
- Backend: vorhandenes `target/dash.jar` (Build-Anzeige `4fc01bb`), separat auf Port 8090.
  Backend-Quellcode wurde in dieser Aufgabe nicht geändert oder neu gebaut.
- Frontend: aktueller lokaler Angular-Quellcode, Devserver Port 4300, Proxy auf 8090.
- Datenbank: eigens gestarteter PostgreSQL-17-Container `dash-playwright-db`, Port 5544.
- Browser: Google Chrome for Testing / Chromium headless shell `157.0.8103.15`.
- Playwright: `1.61.0`, ein Worker, Browser-Zeitzone Europe/Vienna, Standard-Desktopviewport;
  mobiler Navigationsfall mit 390 × 844 Pixeln.

## Ergebnisse

- `npm run e2e:typecheck`: erfolgreich.
- Vollständiger Abschlusslauf `npm run e2e`: **33 bestanden**, 53,3 Sekunden, keine Retries.
- `npm test -- --watch=false`: **80 Tests in 18 Dateien bestanden**.
- `git diff --check`: erfolgreich.

E2E-Umgebung des Abschlusslaufs:

```bash
E2E_BASE_URL=http://localhost:4300 \
E2E_API_URL=http://localhost:8090/api/v1 \
PW_CHROMIUM_EXECUTABLE=/home/agent/.cache/ms-playwright/chromium_headless_shell-1252/chrome-headless-shell-linux-arm64/chrome-headless-shell \
npm run e2e
```

Frühere Ausbauläufe enthielten korrigierte Testfehler (Selektoren, leere Timer-Antwort,
Bestätigungsdialog und Cleanup). Ein erster Testserver wurde vom System beendet.
Der vollständige Abschlusslauf oben bestand ohne diese Fehler.

## Grenzen und Befund

Die [Abdeckungsübersicht](README.md) benennt die verbleibenden Varianten. Es wurde
keine prozentuale Codeabdeckung ermittelt. Backend-Integrationstests wurden nicht
neu ausgeführt; das Backend wurde als bestehendes JAR getestet. Der Standardlauf
enthält keinen vollständigen Restore, der alle Daten ersetzt, und keine weiteren Browserengines.

Gefundenes, noch offenes UI-Problem: Ein extrem langer Projektname im laufenden
Timer kann bei Desktopbreite den Stop-Button unter die globale Suche schieben,
sodass diese den Klick abfängt. Die funktionalen Timerfälle verwenden kurze,
eindeutige Projektnamen. Dieser Befund ist nicht durch einen grünen Regressionstest
abgesichert und wurde in dieser Test-Erweiterung nicht behoben.
