# Clockify vs. Dash — Feature-Vergleich

Stand: 2026-10-01

---

## ✅ Vollständig implementiert

| Feature | Clockify | Dash |
|---|---|---|
| Timer Start/Stop/Discard | ✅ | ✅ |
| Timer aktualisieren (laufend) | ✅ | ✅ |
| Manuelle Zeiteinträge | ✅ | ✅ |
| Eintrag fortsetzen (Continue) | ✅ | ✅ |
| Eintrag duplizieren | ✅ | ✅ |
| Eintrag aufteilen (Split) | ✅ | ✅ |
| Bulk-Aktionen (löschen/taggen/billable) | ✅ | ✅ |
| Billable-Flag | ✅ | ✅ |
| Projekt + Task + Tags am Timer | ✅ | ✅ (Timer-Bar inkl. Tag-Auswahl) |
| Timer-Ansicht: Tages-Navigation | ✅ | ✅ |
| Timer-Ansicht: Gruppierung gleicher Einträge | ✅ | ✅ |
| Timesheet-Wochenansicht (Zeilen je Projekt + Task) | ✅ | ✅ |
| Timesheet: direkte Zelleingabe (1:30, 1,5, 90m) | ✅ | ✅ (Backend ergänzt/kürzt Einträge) |
| Timesheet: Vorwoche kopieren | ✅ | ✅ |
| Kalender-Wochenansicht | ✅ | ✅ |
| Kalender: Drag-to-Create | ✅ | ✅ (15-Min-Snap) |
| Kalender: Drag-to-Move / Drag-to-Resize | ✅ | ✅ |
| Kalender: Klick auf leere Fläche → 1h-Eintrag | ✅ | ✅ |
| Kalender: Zeit-Indikator, Heute-Highlight | ✅ | ✅ |
| Kalender: Überlappende Einträge nebeneinander | ✅ | ✅ |
| Kalender: Touch-Support | ✅ | ✅ |
| Kunden-Verwaltung (CRUD) | ✅ | ✅ |
| Projekt-Verwaltung (CRUD) | ✅ | ✅ |
| Projekt-Farben (alle Ansichten) | ✅ | ✅ |
| Projekt-Status (Aktiv/Archiviert…) | ✅ | ✅ |
| Task-Verwaltung inkl. Rate-Override, Billable-Default, Schätzung | ✅ | ✅ |
| Task-Schätzung vs. erfasste Zeit | ✅ | ✅ (Fortschrittsbalken im Projekt-Detail) |
| Tags | ✅ | ✅ |
| Stundensatz je Projekt / Task-Override | ✅ | ✅ |
| Stundensatz-Historie | ✅ | ✅ |
| Raten-Snapshot je Zeiteintrag | ✅ | ✅ |
| Stunden-/Geldbudget je Projekt | ✅ | ✅ |
| Budget-Reset (monatlich/jährlich) | ✅ | ✅ |
| Summary / Detailed / Weekly / Budget / Revenue Report | ✅ | ✅ |
| Trend Report (Tag/Woche/Monat) | ✅ | ✅ |
| Detailed Report mit Gruppierungs-Subtotals | ✅ | ✅ |
| Aktivitäts-Heatmap (GitHub-Stil) | ✅ | ✅ |
| Attendance-Report (erster/letzter Eintrag, Pausen) | ✅ | ✅ |
| Chart-Drill-Down (Balken klicken → Filter) | ✅ | ✅ |
| Gespeicherte Report-Views | ✅ | ✅ (localStorage) |
| Report-Filter (Zeitraum, Kunde, Projekt, Task, Tag, Billable, Beschreibung) | ✅ | ✅ |
| Report-Gruppierung (Kunde, Projekt, Task, Tag, Datum, Woche, Monat) | ✅ | ✅ (Totals ohne Doppelzählung bei Mehrfach-Tags) |
| Report-Filter in URL persistent | ✅ | ✅ |
| Gerundete Dauern umschaltbar | ✅ | ✅ |
| CSV-/XLSX-Export | ✅ | ✅ |
| Dashboard mit frei wählbarem Zeitraum | ✅ | ✅ |
| Datumsauswahl mit Presets + Kalender (Dashboard, Reports, Timesheet, Kalender) | ✅ | ✅ |
| Dashboard: Billable-Quote-Gauge | ✅ | ✅ |
| Dashboard: Letzte Einträge | ✅ | ✅ |
| Budget-Warnungen (Dashboard) | ✅ | ✅ |
| Top-Projekte / Top-Kunden | ✅ | ✅ |
| Globale Suche (/ Shortcut) | ✅ | ✅ |
| Dark/Light-Mode | ✅ | ✅ |
| Keyboard-Shortcuts (n, t, s, /) | ✅ | ✅ |
| Einstellungen (Timezone, Währung, Rundung) | ✅ | ✅ |
| Backup / Restore (JSON) | — | ✅ |
| Clockify CSV-Import | — | ✅ |
| Archivierung (soft-delete) | ✅ | ✅ |
| Mobile-Optimierung (iPhone) | ✅ | ✅ |

---

## ❌ Bewusst offen (geringer Nutzwert für Single-User)

| Feature | Beschreibung |
|---|---|
| Erinnerungen / Idle-Detection | Clockify erkennt Inaktivität. Erfordert Desktop-Agent — außerhalb des Web-App-Scopes. |
| Projekt-Template | Projekte aus einer Vorlage anlegen. Bei Einzelnutzung selten nötig. |
| Recent-Projects-Dropdown direkt in der Timer-Bar | In Dash über Quick-Start-Buttons auf der Timer-Seite gelöst. |
| PDF-Export von Reports | Aktuell nicht benötigt; CSV/XLSX decken den Bedarf. |

---

## 🚫 Explizit nicht im Scope (Single-User-MVP)

Folgende Clockify-Features sind bewusst ausgelassen und kämen frühestens in Phase 7:

- Invoicing / Rechnungsstellung
- Expenses / Ausgaben
- Forecasting / Kapazitätsplanung
- Team-Verwaltung / Rollen / Genehmigungen
- Browser-Extension
- Desktop-App (Tray-Icon)
- Mobile PWA
- Auto-Tracker (App-Erkennung)
- Pomodoro-Timer
- Cloud-Sync
