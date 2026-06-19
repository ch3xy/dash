# dash — lokale Zeiterfassung (Clockify-Ersatz)

Einzelbenutzer-Time-Tracking mit Kunden-/Projektverwaltung, Budgets, Stundensätzen,
Reports und Visualisierungen. Backend: Spring Boot 4 / Java 25 / PostgreSQL.
Frontend: Angular 22 (standalone, signals, zoneless).

Details siehe [CLAUDE.md](CLAUDE.md) und [.ai/](.ai/README.md).

## Voraussetzungen

- Java 25, Docker (für PostgreSQL)
- Node **26.x** für das Frontend (in `frontend/.nvmrc` gepinnt; Angular 22 unterstützt
  `^22.22.3 || ^24.15.0 || >=26.0.0` — ungerade Majors wie 23/25 sind ausgeschlossen).
  Mit nvm: `cd frontend && nvm use`.

## Start

### 1. PostgreSQL

```bash
docker compose up -d
```

### 2. Backend (Port 8080)

```bash
./mvnw spring-boot:run
```

Health-Check: <http://localhost:8080/api/v1/health>

### 3. Frontend (Port 4200)

```bash
cd frontend
nvm use              # liest .nvmrc → Node 26.3.1
npm install          # einmalig
npm start            # ng serve, proxyt /api → http://localhost:8080
```

App: <http://localhost:4200>

## Frontend-Struktur

```
frontend/src/app/
├── core/              API-Services, Layout (Shell/Sidebar/Topbar/Timer-Bar),
│                      Interceptors, Timer-/Theme-/Toast-State, Modelle
├── shared/            Pipes (duration, money), Charts (bar/line), Date-Utils
└── features/          dashboard, timer, timesheet, calendar, clients,
                       projects (+detail), tags, reports, settings
```

- API-Aufrufe relativ (`/clients`); Interceptor stellt `/api/v1` voran, Dev-Proxy
  leitet `/api` an den Backend-Port weiter (`frontend/proxy.conf.json`).
- Kein UI-Framework (Material/PrimeNG): eigenes Design-System in `src/styles.scss`
  mit Light/Dark-Theme; Charts als leichtgewichtiges HTML/SVG ohne Chart-Library.
