# Dash: Entwicklungs- und Regressionstestregeln

Vor Implementierung `CLAUDE.md` und die einschlägigen `.ai/`-Referenzen lesen. Aktueller Quellcode hat Vorrang vor historischen Architekturangaben.

Für jede sichtbare Änderung gelten [Playwright-Regeln](docs/PLAYWRIGHT_RULES.md) und [Strategie mit Abdeckungsmatrix](docs/PLAYWRIGHT_STRATEGY.md). Anwendung und Regressionstest gehören in denselben PR. Dedizierte Testinstanzen und eigene Daten verwenden; die vorhandene Konfiguration startet keinen isolierten Stack. Playwright bleibt vorerst außerhalb des regulären Builds.
