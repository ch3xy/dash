# Tech Stack

## Backend

| Komponente | Version / Wahl | Begründung |
|---|---|---|
| Java | 25 | LTS, Virtual Threads stabil |
| Spring Boot | 4.x | Aktuell, Jakarta EE 11 |
| Spring Framework | 7.x | Mit Boot 4 gebündelt |
| Spring Web | MVC (nicht WebFlux) | Einfacher für MVP, ausreichend für Single-User |
| Spring Data JPA | Mit Boot 4 | ORM für CRUD-Ops |
| Hibernate | 7.x (über Spring) | JPA-Provider |
| Flyway | Aktuell | DB-Migrationen versioniert |
| PostgreSQL | 17 | Zeitstempel mit Timezone, UUID nativ |
| Jackson | 3 (mit Boot 4 Standard) | JSON-Serialisierung |
| Bean Validation | Jakarta Validation | Input-Validierung an DTOs |
| JUnit 5 | Mit Boot 4 Standard | Tests |
| AssertJ | Mit Boot 4 Standard | Fluent Assertions |
| Mockito | Mit Boot 4 Standard | Unit-Test-Mocks |
| Testcontainers | Aktuell | PostgreSQL in Integrationstests |
| MapStruct | Optional | DTO-Mapping; alternativ manuell |
| springdoc-openapi | Wenn Boot-4-kompatibel verfügbar | OpenAPI-Docs; sonst YAML manuell |

### Backend-Projektstruktur

```
backend/
  src/main/java/com/ch3xy/dash/
    app/
      DashApplication.java
    common/
      error/          -- RFC 7807 ProblemDetail Handler
      time/           -- ZoneId-Helper, Clock-Wrapper
      money/          -- BigDecimal-Helpers
      pagination/     -- PageRequest-DTO
    client/
    project/
    task/
    tag/
    timeentry/
    report/
    dashboard/
    export/
    settings/
  src/main/resources/
    db/migration/     -- Flyway V1__..., V2__...
    application.yml
```

### application.yml (Basis)

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/timetracker
    username: timetracker
    password: timetracker
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
  flyway:
    enabled: true
    locations: classpath:db/migration

server:
  port: 8080

app:
  timezone: Europe/Vienna
  currency: EUR
  cors:
    allowed-origins:
      - http://localhost:4200
```

---

## Frontend

| Komponente | Version | Begründung |
|---|---|---|
| Angular | 22 | Aktuell, Standalone Components stabil |
| Node.js | 24 LTS | Stabile Entwicklung |
| TypeScript | 6.x (gem. Angular) | |
| UI-Bibliothek | Angular Material oder PrimeNG | Entscheidung vor Phase 0 |
| Charts | Apache ECharts (ngx-echarts) | Flexibel, performant |
| Table | Angular CDK Table oder TanStack | Reports |

### Frontend-Projektstruktur

```
frontend/
  src/
    app/
      core/
        api/          -- HttpClient-Services pro Modul
        layout/       -- AppShell, Sidebar, Topbar
        error/        -- GlobalErrorHandler
      shared/
        components/   -- Wiederverwendbare UI-Komponenten
        pipes/        -- DurationPipe, CurrencyPipe
        utils/        -- date-helpers, etc.
      features/
        dashboard/
        timer/
        timesheet/
        calendar/
        clients/
        projects/
        tasks/
        tags/
        reports/
        settings/
    environments/
      environment.ts
      environment.prod.ts
```

---

## Infrastruktur

### docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_DB: timetracker
      POSTGRES_USER: timetracker
      POSTGRES_PASSWORD: timetracker
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
```

### Entwickler-Befehle

```bash
# DB starten
docker compose up -d

# Backend
cd backend && ./mvnw spring-boot:run

# Frontend
cd frontend && npm install && npm start
```

### CORS

Backend muss `http://localhost:4200` erlauben. Konfiguriert als `WebMvcConfigurer`-Bean oder via `application.yml` (s.o.).
