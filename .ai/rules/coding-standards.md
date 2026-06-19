# Coding Standards

---

## Backend

### Allgemein

- Java 25, Spring Boot 4, Jakarta EE 11 APIs.
- Kein `var` bei komplexen Typen, wenn es die Lesbarkeit reduziert.
- Records für DTOs bevorzugen (immutable, kompakt).
- Keine Logik in Controllern — nur Mapping zwischen DTO und Service.
- Services enthalten Business-Logik, Repositories nur Datenzugriff.

### Paketstruktur

Ein Package pro Domänenmodul. Kein `util`-Paket für Business-Klassen.  
Gemeinsame Querschnittsbelange unter `common/`.

### Entitäten

```java
@Entity
@Table(name = "clients")
public class Client {
    @Id
    @UuidGenerator
    private UUID id;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    // Felder ohne Lombok (oder mit @Data falls projektüblich)
}
```

- Keine `@Data` wenn Equals/HashCode-Probleme mit JPA entstehen (zyklische Referenzen).
- `@EqualsAndHashCode(onlyExplicitlyIncluded = true)` + `@EqualsAndHashCode.Include` auf `id`.

### DTOs

```java
public record ClientRequest(
    @NotBlank String name,
    String description,
    @Email String email,
    String website,
    String currencyCode
) {}
```

- Request-Records für Eingaben, Response-Records für Ausgaben.
- Keine Entity-Objekte direkt in Controller-Response-Bodies.

### Fehlerbehandlung

```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ConstraintViolationException.class)
    public ProblemDetail handleValidation(ConstraintViolationException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage());
        pd.setTitle("Validation Failed");
        return pd;
    }
}
```

HTTP-Status-Zuordnung:
| Exception | Status |
|---|---|
| `EntityNotFoundException` | 404 |
| `ConstraintViolationException` | 422 |
| `IllegalStateException` (Business Rule) | 409 |
| `DataIntegrityViolationException` | 409 |
| Alle anderen | 500 |

### Geld

```java
BigDecimal rate = new BigDecimal("85.00");
BigDecimal hours = BigDecimal.valueOf(durationSeconds).divide(BigDecimal.valueOf(3600), 10, RoundingMode.HALF_UP);
BigDecimal amount = hours.multiply(rate).setScale(2, RoundingMode.HALF_UP);
```

Niemals `double` oder `float` für Geldwerte.

### Zeit

```java
Instant now = clock.instant();                          // Clock injizieren, nicht Instant.now()
ZoneId zone = ZoneId.of(settingsService.getTimezone());
LocalDate entryDate = now.atZone(zone).toLocalDate();
```

- `Clock`-Bean für testbare Zeitoperationen.
- `ZoneId` aus `AppSettingsService`, nicht hardkodiert.

### Tests

- Unit-Tests für Services mit gemockten Repositories.
- Integrationstests mit `@SpringBootTest` + Testcontainers PostgreSQL.
- Controller-Tests mit `@WebMvcTest`.
- `Clock.fixed(...)` in Tests für deterministischen Zeit.

```java
@TestConfiguration
public class TestClockConfig {
    @Bean
    @Primary
    public Clock fixedClock() {
        return Clock.fixed(Instant.parse("2026-06-19T10:00:00Z"), ZoneOffset.UTC);
    }
}
```

---

## Frontend (Angular)

### Allgemein

- Standalone Components überall (kein `NgModule`).
- Angular Signals für lokalen UI-State.
- `inject()` statt Constructor-Injection in neuem Code.
- `OnPush`-ChangeDetection als Default für Performance.

### Service-Struktur

```typescript
@Injectable({ providedIn: 'root' })
export class ClientApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/clients';

  getAll(archived = false): Observable<ClientResponse[]> {
    return this.http.get<ClientResponse[]>(this.base, { params: { archived } });
  }

  create(req: ClientRequest): Observable<ClientResponse> {
    return this.http.post<ClientResponse>(this.base, req);
  }
  // ...
}
```

### Typen

```typescript
export interface ClientResponse {
  id: string;
  name: string;
  description: string | null;
  email: string | null;
  website: string | null;
  currencyCode: string;
  archived: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

export interface ClientRequest {
  name: string;
  description?: string;
  email?: string;
  website?: string;
  currencyCode?: string;
}
```

- Typen in `feature/*/models/` oder `shared/models/`.
- Keine `any`, kein `// @ts-ignore`.

### State-Management

- Kein NgRx / Akita im MVP.
- Signals für Component-State:
  ```typescript
  protected readonly clients = signal<ClientResponse[]>([]);
  protected readonly loading = signal(false);
  ```
- Server-State via RxJS-Observables in Services, in Components per `toSignal()` konvertieren.

### Routing

```typescript
export const routes: Routes = [
  { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'timer', loadComponent: () => ... },
  // ...
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];
```

- Lazy-Loading aller Feature-Components.
- Filter-State in URL Query-Params (`ActivatedRoute.queryParams`).

### Formularvalidierung

- Reactive Forms für alle Formulare.
- Validierungsfehler inline neben dem Feld anzeigen.
- Backend-Fehler (422) als Formular-Error setzen:

```typescript
this.apiService.create(formValue).pipe(
  catchError((err: HttpErrorResponse) => {
    if (err.status === 422) {
      this.form.setErrors({ serverError: err.error.detail });
    }
    return EMPTY;
  })
).subscribe(...);
```

### Code-Style

- `prettier` mit Default-Config.
- `eslint` mit Angular-ESLint Ruleset.
- Kein Semikolon-Debatte: `prettier` entscheidet.
- Dateinamenskonvention: `kebab-case.component.ts`, `kebab-case.service.ts`.

---

## Allgemein

### Was NICHT zu tun ist

- Keine Security/Auth-Features bis explizit angefordert.
- Keine Team-/Multi-User-Features.
- Keine Clockify-Assets (Logos, geschützte Texte).
- Kein `float`/`double` für Geld.
- Keine harte Löschung von archivierten Entities wenn Abhängigkeiten existieren.
- Keine Business-Logik im Frontend — Backend ist Source of Truth.
- Keine ungenutzten DTOs oder toten Endpunkte.

### Definition of Done (pro Feature)

- Backend validiert Eingaben.
- Fehler kommen als RFC 7807 `ProblemDetail`.
- Flyway-Migration für neue Tabellen/Spalten vorhanden.
- Unit-Tests für Kernlogik.
- Frontend zeigt: Ladezustand, Fehlerzustand, Leerzustand.
- UI funktioniert auf Desktop und Tablet.
