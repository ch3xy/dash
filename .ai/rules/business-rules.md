# Business Rules

---

## 1. Rate Resolution

Beim Erstellen oder Stoppen eines TimeEntry wird der anwendbare Stundensatz in dieser Priorität bestimmt:

```
1. Task.hourlyRateOverride (wenn Task gesetzt und Rate nicht null)
2. Aktive ProjectRate zum Zeitpunkt von startTime
   → SELECT * FROM project_rates
     WHERE project_id = ? AND valid_from <= :startTime
     AND (valid_to IS NULL OR valid_to > :startTime)
     ORDER BY valid_from DESC LIMIT 1
3. Project.defaultHourlyRate (wenn nicht null)
4. AppSettings['default_rate'] (immer gesetzt, Default 0.00)
```

Das Ergebnis wird als **Snapshot** auf `TimeEntry.hourlyRateSnapshot` und `TimeEntry.currencyCodeSnapshot` gespeichert und danach **nie wieder geändert**, auch wenn sich Projekt- oder Task-Rate ändert.

---

## 2. Umsatzberechnung

```
amountSnapshot = (durationSeconds / 3600.0) * hourlyRateSnapshot
```

- Berechnet beim Stoppen des Timers oder beim manuellen Erstellen eines Eintrags.
- `BigDecimal`-Arithmetik, `RoundingMode.HALF_UP` auf 2 Nachkommastellen.
- Nicht abrechenbare Einträge (`billable = false`) bekommen `amountSnapshot = 0.00` (oder `null`).

---

## 3. Budgetverbrauch

```
usedMinutes     = SUM(duration_seconds) / 60   (ganzzahlig abgerundet)
remainingMinutes = project.hourBudgetMinutes - usedMinutes
usedPercent     = usedMinutes / project.hourBudgetMinutes * 100.0
```

### Budget-Reset-Perioden

| `budgetReset` | Zeitraum für SUM |
|---|---|
| `NONE` | Alle Zeiteinträge des Projekts |
| `MONTHLY` | Laufender Kalendermonat (`entry_date >= first_day_of_month`) |
| `YEARLY` | Laufendes Kalenderjahr (`entry_date >= first_day_of_year`) |

### Status-Schwellen

| `usedPercent` | Status |
|---|---|
| < 80 | `ON_TRACK` |
| ≥ 80 und ≤ 100 | `WARNING` |
| > 100 | `EXCEEDED` |

---

## 4. Rundungsregeln

Die Rohdauer (`durationSeconds`) wird **immer unverändert gespeichert**.  
Rundung wird nur für Reports und Berechnungen auf Anfrage angewendet (`?rounded=true`).

| `roundingRule` | `roundingMinutes` | Beschreibung |
|---|---|---|
| `NONE` | — | Keine Rundung |
| `UP` | 5/10/15/30 | Immer auf nächste N Minuten aufrunden |
| `NEAREST` | 5/10/15 | Auf nächste N Minuten runden (kaufmännisch) |
| `DOWN` | 5/10/15/30 | Immer auf letzte N Minuten abrunden |

Formel für `UP` mit N Minuten:
```
roundedSeconds = ceil(durationSeconds / (N * 60.0)) * N * 60
```

---

## 5. Timer Lifecycle

```
KEIN Timer → [POST /timer/start] → RUNNING
RUNNING    → [POST /timer/stop]  → GESTOPPT → TimeEntry erstellt, KEIN Timer
RUNNING    → [POST /timer/discard] → KEIN Timer (kein TimeEntry)
KEIN Timer → [POST /timer/start] wenn bereits einer läuft → 409 Conflict
```

- Maximal **ein** laufender Timer gleichzeitig (erzwungen durch Tabelle `running_timers` + Application-Check).
- `entryDate` des resultierenden TimeEntry wird aus `endTime` in der App-Zeitzone berechnet: `endTime.atZone(appZone).toLocalDate()`.
- Timer über Mitternacht: **Kein automatisches Splitten**. `entryDate` = Datum des Endzeitpunkts. Reports können optional nach Tagen splitten.

---

## 6. Zeiteinträge über Mitternacht

- Manuelle Einträge dürfen Mitternacht überspannen.
- `entryDate` = Datum der `endTime` in App-Zeitzone.
- Reports nach `entryDate` zeigen den Eintrag an dem Tag, an dem er endete.
- Optionale Auswertung: Reports können den Eintrag anteilig auf beide Tage splitten (erst in Phase 5+).

---

## 7. Archivierungsregeln

| Entity | Archivierbar | Hard-Delete erlaubt |
|---|---|---|
| Client | Ja (soft) | Nur wenn keine Projekte existieren |
| Project | Ja (Status=ARCHIVED) | Nein |
| Task | Ja (archived=true) | Nein |
| Tag | Ja (archived=true) | Nein |
| TimeEntry | Nein | Ja (DELETE Endpoint) |
| RunningTimer | — | Ja (via discard) |

Archivierte Projekte/Tasks/Clients bleiben in **alten TimeEntries und Reports** sichtbar, werden aber aus **Auswahlfeldern** (Autocomplete, Dropdowns) ausgeblendet.

---

## 8. Validierungsregeln (Backend, erzwungen)

| Feld | Regel |
|---|---|
| `TimeEntry.endTime` | > `startTime` |
| `TimeEntry.durationSeconds` | > 0 |
| `Client.name` | nicht leer, unique unter aktiven Clients (case-insensitive) |
| `Project.name` | nicht leer, unique je Client (case-insensitive) |
| `Task.name` | nicht leer, unique je Projekt (case-insensitive) |
| `Tag.name` | nicht leer, unique unter aktiven Tags (case-insensitive) |
| `ProjectRate.hourlyRate` | ≥ 0 |
| `ProjectRate.validFrom` | nicht null |
| Geldbeträge | `BigDecimal`, nie `double/float` |
| Zeitpunkte | `Instant` intern, `timestamptz` in DB |

---

## 9. Historische Stundensätze

Wenn eine neue `ProjectRate` angelegt wird:

```sql
UPDATE project_rates
SET valid_to = :newRate.validFrom
WHERE project_id = :projectId
  AND valid_to IS NULL
  AND id != :newRateId
```

Alle bestehenden `TimeEntry.hourlyRateSnapshot` bleiben **unverändert**. Reports auf vergangene Zeiträume sind damit reproduzierbar.
