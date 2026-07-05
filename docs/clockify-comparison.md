# Clockify vs. Dash — Feature-Vergleich

Stand: 2026-07-05

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
| Timesheet-Wochenansicht | ✅ | ✅ |
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
| Task-Verwaltung | ✅ | ✅ |
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
| Report-Filter (Zeitraum, Projekt, Kunde, Tag, Billable) | ✅ | ✅ |
| Report-Filter in URL persistent | ✅ | ✅ |
| Gerundete Dauern umschaltbar | ✅ | ✅ |
| CSV-/XLSX-Export | ✅ | ✅ |
| Dashboard (Heute/Woche/Monat) | ✅ | ✅ |
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
