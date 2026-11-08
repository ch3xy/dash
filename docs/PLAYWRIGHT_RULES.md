# Playwright-Regeln

- Suite und Anwendung gehören in dasselbe Repository; Feature und Regressionstest werden im selben PR geliefert.
- Jede sichtbare Änderung braucht Hauptablauf und relevante Validierungs-/Fehlerfälle. Bugfixes brauchen einen Fall, der den ursprünglichen Fehler zeigt. Die Abdeckungsmatrix in der Strategie aktualisieren.
- Echte UI-Flows prüfen sichtbare fachliche Ergebnisse und Persistenz nach Reload. API-Helfer dienen Setup, Cleanup und ergänzenden Verträgen; API-Tests sind keine Browser-E2E-Abdeckung.
- Nur dedizierte Testinstanzen und eindeutig benannte eigene Daten verwenden. Jede angelegte Entität für Cleanup registrieren; ausschließlich eigene Daten löschen. Niemals persönliche oder produktive Datenbanken verändern.
- Rollen-/Label-Locators, automatische Assertions und beobachtbare Bereitschaft verwenden. Unvermeidbare strukturelle Selektoren in Page-Helpern zentralisieren. Keine festen Sleeps, pauschalen Retries oder übersprungenen Fehler.
- Mocks nur für gezielt isolierte Integrations-, Fehler- und Leerzustände verwenden; keine vollständig gemockten Flows als Fullstack-E2E ausweisen. Test-Fixtures sind kein produktiver Mock-Fallback.
- Frischer Browserkontext je Fall, unabhängige Tests, explizite Zeitzone und reproduzierbare Testdaten. Globale Einstellungen und Timer bei Bedarf serialisieren und auf eigener Instanz zurücksetzen.
- Vor Fertigstellung passende Anwendungstests, E2E-Typecheck und komplette Chromium-Suite ausführen; bei relevanten Änderungen auch Mobilfälle. App-Commit, lokale Änderungen, Browserstand, Ergebnisse und Einschränkungen dokumentieren. Nicht ausgeführte Prüfungen niemals als bestanden melden.
- Traces, Screenshots, Videos, Reports, lokale Konfiguration und Zugangsdaten nicht committen. Nur Fehlerartefakte aufbewahren; in CI kurze Aufbewahrung vorsehen.
- Playwright bleibt derzeit ein expliziter separater Prüfschritt außerhalb des normalen Builds. Künftige CI soll denselben App-Commit bauen/testen, eine isolierte Instanz starten, Ergebnisse sichern und den Stack auch bei Fehlern entfernen. Automatische PR-/Build-Pflicht erst nach ausdrücklicher Aktivierung.
