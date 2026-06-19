# Modul: Project

Verwaltet Projekte, Budgets und Stundensatz-Historie.

---

## Datenbank

Tabellen `projects`, `project_rates` — siehe [datamodel.md](../datamodel.md).

---

## Backend-Klassen

### `Project.java`

```java
@Entity @Table(name = "projects")
public class Project {
    @Id @UuidGenerator UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "client_id") Client client;
    @NotBlank String name;
    String description;
    String color;
    @Enumerated(EnumType.STRING) @NotNull ProjectStatus status;
    boolean billableByDefault;
    BigDecimal defaultHourlyRate;
    @NotBlank String currencyCode;
    Integer hourBudgetMinutes;
    BigDecimal moneyBudgetAmount;
    @Enumerated(EnumType.STRING) @NotNull BudgetReset budgetReset;
    @CreationTimestamp Instant createdAt;
    @UpdateTimestamp Instant updatedAt;
}

public enum ProjectStatus { ACTIVE, PAUSED, COMPLETED, ARCHIVED }
public enum BudgetReset { NONE, MONTHLY, YEARLY }
```

### `ProjectRate.java`

```java
@Entity @Table(name = "project_rates")
public class ProjectRate {
    @Id @UuidGenerator UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "project_id") Project project;
    @NotNull BigDecimal hourlyRate;
    @NotBlank String currencyCode;
    @NotNull Instant validFrom;
    Instant validTo;
    String note;
}
```

### `ProjectRepository.java`

```java
public interface ProjectRepository extends JpaRepository<Project, UUID> {
    List<Project> findAllByStatusNot(ProjectStatus status);
    List<Project> findAllByClientId(UUID clientId);
    boolean existsByNameIgnoreCaseAndClientId(String name, UUID clientId);
}
```

### `ProjectRateRepository.java`

```java
public interface ProjectRateRepository extends JpaRepository<ProjectRate, UUID> {
    List<ProjectRate> findAllByProjectIdOrderByValidFromDesc(UUID projectId);

    @Query("""
        SELECT r FROM ProjectRate r
        WHERE r.project.id = :projectId
          AND r.validFrom <= :at
          AND (r.validTo IS NULL OR r.validTo > :at)
        ORDER BY r.validFrom DESC
        LIMIT 1
    """)
    Optional<ProjectRate> findActiveRateAt(UUID projectId, Instant at);
}
```

### `ProjectService.java`

Methoden:
- `findAll(ProjectFilter)` → `List<ProjectResponse>`
- `findById(UUID)` → `ProjectResponse`
- `create(ProjectRequest)` → `ProjectResponse`
- `update(UUID, ProjectRequest)` → `ProjectResponse`
- `updateStatus(UUID, ProjectStatus)` → `ProjectResponse`
- `getBudgetStatus(UUID)` → `ProjectBudgetStatus`
- `getRates(UUID)` → `List<ProjectRateResponse>`
- `addRate(UUID, ProjectRateRequest)` → `ProjectRateResponse`
  - Schließt aktive Rate ab: `UPDATE project_rates SET valid_to = :newValidFrom WHERE project_id = :id AND valid_to IS NULL`

### DTOs

```java
public record ProjectRequest(
    UUID clientId,
    @NotBlank String name,
    String description,
    String color,
    boolean billableByDefault,
    BigDecimal defaultHourlyRate,
    @NotBlank String currencyCode,
    Integer hourBudgetMinutes,
    BigDecimal moneyBudgetAmount,
    BudgetReset budgetReset
) {}

public record ProjectResponse(
    UUID id,
    UUID clientId, String clientName,
    String name, String description, String color,
    ProjectStatus status,
    boolean billableByDefault,
    BigDecimal defaultHourlyRate, String currencyCode,
    Integer hourBudgetMinutes, BigDecimal moneyBudgetAmount,
    BudgetReset budgetReset,
    Instant createdAt, Instant updatedAt
) {}

public record ProjectBudgetStatus(
    UUID projectId,
    Integer hourBudgetMinutes,
    int usedMinutes,
    int remainingMinutes,
    double usedPercent,
    BigDecimal moneyBudgetAmount,
    BigDecimal revenueAmount,
    String budgetPeriod,
    BudgetAlertStatus status   // ON_TRACK|WARNING|EXCEEDED
) {}

public record ProjectRateRequest(
    @NotNull BigDecimal hourlyRate,
    @NotBlank String currencyCode,
    @NotNull Instant validFrom,
    String note
) {}
```

---

## Business-Regeln

- Projektname einmalig je Client (case-insensitiv).
- Status-Übergänge: Alle Übergänge erlaubt außer von `ARCHIVED` zurück (UI kann warnen).
- Budgetberechnung: s. [rules/business-rules.md](../rules/business-rules.md#3-budgetverbrauch).
- Rate-Abschluss: s. [rules/business-rules.md](../rules/business-rules.md#9-historische-stundensätze).

---

## Tests

| Test | Typ | Was |
|---|---|---|
| `ProjectServiceTest` | Unit | `getBudgetStatus` MONTHLY-Reset |
| `ProjectServiceTest` | Unit | `addRate` schließt alte Rate ab |
| `ProjectRateRepositoryTest` | Integration | `findActiveRateAt` korrekte Priorität |
| `ProjectControllerTest` | `@WebMvcTest` | Budget-Status Endpoint |
