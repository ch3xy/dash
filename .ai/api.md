# REST API Spezifikation

Base path: `/api/v1`  
Content-Type: `application/json`  
Fehlerformat: RFC 7807 `ProblemDetail`

---

## Fehlerstruktur

```json
{
  "type": "about:blank",
  "title": "Validation Failed",
  "status": 422,
  "detail": "Client name must not be blank",
  "instance": "/api/v1/clients"
}
```

---

## Clients

### `GET /clients`

Query-Params: `?archived=false` (Default false)

Response `200`:
```json
[
  {
    "id": "uuid",
    "name": "string",
    "description": "string|null",
    "email": "string|null",
    "website": "string|null",
    "currencyCode": "EUR",
    "archived": false,
    "createdAt": "2026-01-01T10:00:00Z",
    "updatedAt": "2026-01-01T10:00:00Z"
  }
]
```

### `POST /clients`

Body:
```json
{
  "name": "string (required, unique among active)",
  "description": "string|null",
  "email": "string|null",
  "website": "string|null",
  "currencyCode": "EUR"
}
```
Response `201` mit Location-Header.

### `GET /clients/{id}` → `200` Client-Objekt

### `PUT /clients/{id}` → `200` aktualisiertes Objekt

### `PATCH /clients/{id}/archive` → `200` `{ "archived": true }`

Schlägt fehl mit `409 Conflict`, wenn Projekte existieren und alle nicht archiviert sind.

### `DELETE /clients/{id}` → `204`

Nur möglich, wenn keine Projekte existieren. Sonst `409 Conflict`.

---

## Projects

### `GET /projects`

Query-Params: `?status=ACTIVE&clientId=uuid&archived=false`

Response `200`: Liste von:
```json
{
  "id": "uuid",
  "clientId": "uuid|null",
  "clientName": "string|null",
  "name": "string",
  "description": "string|null",
  "color": "#hex|null",
  "status": "ACTIVE|PAUSED|COMPLETED|ARCHIVED",
  "billableByDefault": true,
  "defaultHourlyRate": "0.00",
  "currencyCode": "EUR",
  "hourBudgetMinutes": 6000,
  "moneyBudgetAmount": "5000.00|null",
  "budgetReset": "NONE|MONTHLY|YEARLY",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### `POST /projects` → `201`

Body:
```json
{
  "clientId": "uuid|null",
  "name": "string",
  "description": "string|null",
  "color": "#hex|null",
  "billableByDefault": true,
  "defaultHourlyRate": "0.00",
  "currencyCode": "EUR",
  "hourBudgetMinutes": null,
  "moneyBudgetAmount": null,
  "budgetReset": "NONE"
}
```

### `GET /projects/{id}` → `200`

### `PUT /projects/{id}` → `200`

### `PATCH /projects/{id}/status` → `200`

Body: `{ "status": "PAUSED" }`

### `GET /projects/{id}/budget-status` → `200`

```json
{
  "projectId": "uuid",
  "hourBudgetMinutes": 6000,
  "usedMinutes": 2400,
  "remainingMinutes": 3600,
  "usedPercent": 40.0,
  "moneyBudgetAmount": "5000.00",
  "revenueAmount": "2000.00",
  "budgetPeriod": "ALL_TIME|CURRENT_MONTH|CURRENT_YEAR"
}
```

### `GET /projects/{id}/rates` → `200` Liste von ProjectRate

```json
[
  {
    "id": "uuid",
    "projectId": "uuid",
    "hourlyRate": "85.00",
    "currencyCode": "EUR",
    "validFrom": "2026-01-01T00:00:00Z",
    "validTo": null,
    "note": "string|null"
  }
]
```

### `POST /projects/{id}/rates` → `201`

Body:
```json
{
  "hourlyRate": "95.00",
  "currencyCode": "EUR",
  "validFrom": "2026-06-01T00:00:00Z",
  "note": "Preiserhöhung"
}
```

Schließt automatisch die aktuelle Rate ab (`validTo = validFrom des neuen`).

---

## Tasks

### `GET /projects/{projectId}/tasks`

Query-Params: `?archived=false`

Response `200`:
```json
[
  {
    "id": "uuid",
    "projectId": "uuid",
    "name": "string",
    "description": "string|null",
    "billableByDefault": true,
    "hourlyRateOverride": null,
    "estimatedMinutes": null,
    "archived": false,
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

### `POST /projects/{projectId}/tasks` → `201`

### `PUT /tasks/{id}` → `200`

### `PATCH /tasks/{id}/archive` → `200`

---

## Tags

### `GET /tags` → `200` (Query: `?archived=false`)

### `POST /tags` → `201`

```json
{ "name": "string", "color": "#hex|null" }
```

### `PUT /tags/{id}` → `200`

### `PATCH /tags/{id}/archive` → `200`

---

## Time Entries

### `GET /time-entries`

Query-Params (alle optional):
- `from` — ISO Date (`2026-06-01`)
- `to` — ISO Date (`2026-06-30`)
- `clientId` — UUID
- `projectId` — UUID
- `taskId` — UUID
- `tagId` — UUID
- `billable` — boolean
- `q` — Volltextsuche in description
- `page`, `size`, `sort` — Pagination

Response `200`:
```json
{
  "content": [
    {
      "id": "uuid",
      "projectId": "uuid",
      "projectName": "string",
      "clientId": "uuid|null",
      "clientName": "string|null",
      "taskId": "uuid|null",
      "taskName": "string|null",
      "description": "string|null",
      "startTime": "2026-06-19T08:00:00Z",
      "endTime": "2026-06-19T10:00:00Z",
      "durationSeconds": 7200,
      "entryDate": "2026-06-19",
      "billable": true,
      "hourlyRateSnapshot": "85.00",
      "currencyCodeSnapshot": "EUR",
      "amountSnapshot": "170.00",
      "source": "TIMER",
      "tags": [{ "id": "uuid", "name": "string", "color": "#hex" }],
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "totalElements": 42,
  "totalPages": 3,
  "page": 0,
  "size": 20
}
```

### `POST /time-entries` → `201`

```json
{
  "projectId": "uuid",
  "taskId": "uuid|null",
  "description": "string|null",
  "startTime": "2026-06-19T08:00:00Z",
  "endTime": "2026-06-19T10:00:00Z",
  "billable": true,
  "tagIds": ["uuid"]
}
```

Backend berechnet `durationSeconds`, `entryDate`, Rate-Snapshot, Amount-Snapshot.

### `GET /time-entries/{id}` → `200`

### `PUT /time-entries/{id}` → `200`

Identisches Body-Format wie POST. Rate-Snapshot wird neu berechnet.

### `DELETE /time-entries/{id}` → `204`

### `POST /time-entries/{id}/continue` → `201`

Startet einen neuen `RunningTimer` mit Daten des referenzierten TimeEntry.  
Schlägt fehl mit `409 Conflict`, wenn bereits ein Timer läuft.

---

## Timer

### `GET /timer/current` → `200` oder `404`

```json
{
  "id": "uuid",
  "projectId": "uuid",
  "projectName": "string",
  "taskId": "uuid|null",
  "taskName": "string|null",
  "description": "string|null",
  "startTime": "2026-06-19T09:00:00Z",
  "elapsedSeconds": 1234,
  "billable": true
}
```

### `POST /timer/start` → `201`

```json
{
  "projectId": "uuid",
  "taskId": "uuid|null",
  "description": "string|null",
  "billable": true,
  "tagIds": []
}
```

Schlägt fehl mit `409 Conflict`, wenn bereits ein Timer läuft. Frontend muss erst `/timer/stop` aufrufen.

### `POST /timer/stop` → `201` TimeEntry

Stoppt laufenden Timer, berechnet `endTime = now()`, erstellt `TimeEntry` mit `source=TIMER`.  
Body leer oder:
```json
{ "description": "optional Überschreibung" }
```

### `POST /timer/discard` → `204`

Löscht laufenden Timer ohne TimeEntry zu erstellen.

### `PATCH /timer/current` → `200`

Live-Update laufender Timer (Beschreibung, Projekt, Task, Tags, Billable):
```json
{
  "projectId": "uuid|null",
  "taskId": "uuid|null",
  "description": "string|null",
  "billable": true,
  "tagIds": []
}
```

---

## Reports

Alle Reports: Query-Params als Filter.

### Gemeinsame Filter-Parameter

| Param | Typ | Beschreibung |
|---|---|---|
| `from` | date | Von-Datum |
| `to` | date | Bis-Datum |
| `clientId` | uuid[] | Kunde(n) |
| `projectId` | uuid[] | Projekt(e) |
| `taskId` | uuid[] | Task(s) |
| `tagId` | uuid[] | Tag(s) |
| `billable` | boolean | Nur abrechenbar/nicht |
| `groupBy` | string | Gruppierungsfeld |
| `rounded` | boolean | Gerundete Dauer verwenden |

### `GET /reports/summary`

```json
{
  "totalDurationSeconds": 72000,
  "billableDurationSeconds": 54000,
  "nonBillableDurationSeconds": 18000,
  "billableRatio": 0.75,
  "revenueAmount": "4590.00",
  "currencyCode": "EUR",
  "groupedBy": "PROJECT",
  "groups": [
    {
      "key": "uuid",
      "label": "Projektname",
      "durationSeconds": 36000,
      "billableDurationSeconds": 36000,
      "revenueAmount": "3060.00"
    }
  ],
  "period": { "from": "2026-06-01", "to": "2026-06-30" }
}
```

### `GET /reports/detailed`

Paginierte Liste aller TimeEntries mit Filter (s. `/time-entries` Response).

### `GET /reports/weekly`

```json
{
  "weekStart": "2026-06-16",
  "weekEnd": "2026-06-22",
  "days": [
    {
      "date": "2026-06-16",
      "totalSeconds": 28800,
      "entries": [...]
    }
  ],
  "weekTotalSeconds": 144000
}
```

### `GET /reports/budget`

```json
[
  {
    "projectId": "uuid",
    "projectName": "string",
    "clientName": "string|null",
    "hourBudgetMinutes": 6000,
    "usedMinutes": 2400,
    "usedPercent": 40.0,
    "status": "ON_TRACK|WARNING|EXCEEDED"
  }
]
```

`WARNING` wenn `usedPercent >= 80`.

### `GET /reports/revenue`

Umsatz nach Kunde/Projekt/Monat.

### `GET /reports/trends`

```json
{
  "granularity": "DAY|WEEK|MONTH",
  "data": [
    { "period": "2026-06-01", "durationSeconds": 28800, "revenueAmount": "2040.00" }
  ]
}
```

### `GET /reports/heatmap`

```json
{
  "year": 2026,
  "data": [
    { "date": "2026-06-19", "durationSeconds": 28800, "intensity": 0.9 }
  ]
}
```

`intensity` = `durationSeconds / (8 * 3600)`, max 1.0.

### `GET /reports/export.csv`

Header: `Content-Disposition: attachment; filename="report-2026-06.csv"`  
Spalten: Date, Client, Project, Task, Description, Start, End, Duration, Billable, Rate, Amount, Tags

### `GET /reports/export.xlsx`

Identisches Format als XLSX.

---

## Settings

### `GET /settings` → `200`

```json
{
  "timezone": "Europe/Vienna",
  "currency": "EUR",
  "defaultRate": "0.00",
  "roundingRule": "NONE",
  "roundingMinutes": 15
}
```

### `PUT /settings` → `200`

Body: Identisches Objekt.

---

## Dashboard

### `GET /dashboard` → `200`

```json
{
  "today": {
    "durationSeconds": 14400,
    "revenueAmount": "1020.00"
  },
  "thisWeek": {
    "durationSeconds": 72000,
    "revenueAmount": "5100.00"
  },
  "thisMonth": {
    "durationSeconds": 288000,
    "revenueAmount": "20400.00"
  },
  "runningTimer": { /* TimerResponse oder null */ },
  "budgetAlerts": [
    { "projectId": "uuid", "projectName": "string", "usedPercent": 85.0, "status": "WARNING" }
  ],
  "topProjects": [
    { "projectId": "uuid", "projectName": "string", "durationSeconds": 36000 }
  ],
  "topClients": [
    { "clientId": "uuid", "clientName": "string", "revenueAmount": "2040.00" }
  ]
}
```
