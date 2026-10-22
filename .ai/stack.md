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
| UI-Bibliothek | keine – eigenes Design-System (`styles.scss`) | Schlank, volle Kontrolle über die CI |
| Charts | eigene SVG/HTML-Komponenten (`shared/components`) | Keine Chart-Library nötig |
| Icons | Lucide (`@lucide/angular` 1.x) | Standalone/Signal-basiert, zoneless, tree-shakable |
| Schrift | Inter (`@fontsource-variable/inter` 5.x) | Selbst gehostet (DSGVO, offline), Arrow-Corporate-Design |
| Table | native HTML-Tabellen (`.table`) | Reports, paginiert über das Backend |

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

## Versionierung

- SemVer in der `<version>` der `pom.xml` ist die einzige Quelle der Version; zwischen zwei Releases steht
  dort die nächste `-SNAPSHOT`-Version.
- Die Sidebar zeigt `v<version> (Build <commit>)`, `-dirty` bei uncommitteten Änderungen; der Tooltip zeigt
  die Build-Zeit. Version und Build-Zeit kommen aus `build-info.properties`, Commit und Dirty-Flag aus
  `git.properties` (`git-commit-id-maven-plugin`), beides über `GET /health`.
- Keine Buildnummer: Gebaut und deployt wird lokal ohne CI, der Commit identifiziert einen Build eindeutig.
- Jeder Deploy ist ein Release (`scripts/deploy.sh`): Snapshot freigeben (`0.1.1-SNAPSHOT` → `0.1.1`),
  `Release <version>` committen und `v<version>` taggen, die JAR aus diesem Commit bauen, dann die pom auf die
  nächste Snapshot-Version (`0.1.2-SNAPSHOT`) setzen und über `../pi-ops` deployen. Es wird nie ein Stand mit
  `-dirty` deployt.
- minor und major werden nur auf ausdrücklichen Wunsch erhöht.

```bash
git commit ...           # alle Änderungen committen, Tests grün (./mvnw verify)
scripts/deploy.sh        # Patch-Release; scripts/deploy.sh 0.2.0 für minor/major
git push --follow-tags   # erst nach Rückfrage
```

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
