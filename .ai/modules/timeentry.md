# Modul: TimeEntry

Kern der Anwendung. Repräsentiert abgeschlossene Zeiterfassungseinträge.

---

## Datenbank

Tabellen `time_entries`, `time_entry_tags` — siehe [datamodel.md](../datamodel.md).

---

## Backend-Klassen

### `TimeEntry.java`

```java
@Entity @Table(name = "time_entries")
public class TimeEntry {
    @Id @UuidGenerator UUID id;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "project_id") Project project;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "task_id") Task task;  // nullable

    String description;
    @NotNull Instant startTime;
    @NotNull Instant endTime;
    int durationSeconds;          // immer positiv, berechnet
    @NotNull LocalDate entryDate; // berechnet aus endTime + App-Zeitzone

    boolean billable;

    BigDecimal hourlyRateSnapshot;    // nullable wenn billable=false oder keine Rate
    String currencyCodeSnapshot;
    BigDecimal amountSnapshot;        // = 0.00 oder null wenn nicht billable

    @Enumerated(EnumType.STRING) TimeEntrySource source;

    @ManyToMany
    @JoinTable(
        name = "time_entry_tags",
        joinColumns = @JoinColumn(name = "time_entry_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    Set<Tag> tags;

    @CreationTimestamp Instant createdAt;
    @UpdateTimestamp Instant updatedAt;
}

public enum TimeEntrySource { TIMER, MANUAL, IMPORT, ADJUSTMENT }
```

### `TimeEntryRepository.java`

```java
public interface TimeEntryRepository extends JpaRepository<TimeEntry, UUID> {

    @Query("""
        SELECT te FROM TimeEntry te
        LEFT JOIN FETCH te.project p
        LEFT JOIN FETCH p.client
        LEFT JOIN FETCH te.task
        LEFT JOIN FETCH te.tags
        WHERE (:projectId IS NULL OR te.project.id = :projectId)
          AND (:clientId IS NULL OR p.client.id = :clientId)
          AND (:taskId IS NULL OR te.task.id = :taskId)
          AND (:from IS NULL OR te.entryDate >= :from)
          AND (:to IS NULL OR te.entryDate <= :to)
          AND (:billable IS NULL OR te.billable = :billable)
          AND (:q IS NULL OR LOWER(te.description) LIKE LOWER(CONCAT('%', :q, '%')))
        ORDER BY te.entryDate DESC, te.startTime DESC
    """)
    Page<TimeEntry> findWithFilter(
        UUID projectId, UUID clientId, UUID taskId,
        LocalDate from, LocalDate to,
        Boolean billable, String q,
        Pageable pageable
    );

    @Query("SELECT SUM(te.durationSeconds) FROM TimeEntry te WHERE te.project.id = :projectId AND te.entryDate >= :from")
    Long sumDurationByProjectSince(UUID projectId, LocalDate from);
}
```

### `TimeEntryService.java`

Methoden:
- `findAll(TimeEntryFilter, Pageable)` → `Page<TimeEntryResponse>`
- `findById(UUID)` → `TimeEntryResponse`
- `create(TimeEntryRequest)` → `TimeEntryResponse`
  - Berechnet `durationSeconds = ChronoUnit.SECONDS.between(startTime, endTime)`
  - Validiert `durationSeconds > 0`
  - Berechnet `entryDate = endTime.atZone(appZone).toLocalDate()`
  - Ruft `RateResolverService.resolve(projectId, taskId, startTime)` auf
  - Berechnet `amountSnapshot` wenn `billable = true`
- `update(UUID, TimeEntryRequest)` → `TimeEntryResponse` (Rate-Snapshot neu berechnet)
- `delete(UUID)` → void
- `continueEntry(UUID)` → `RunningTimerResponse` (delegiert an `TimerService.start`)

### DTOs

```java
public record TimeEntryRequest(
    @NotNull UUID projectId,
    UUID taskId,
    String description,
    @NotNull Instant startTime,
    @NotNull Instant endTime,
    boolean billable,
    Set<UUID> tagIds
) {}

public record TimeEntryResponse(
    UUID id,
    UUID projectId, String projectName,
    UUID clientId, String clientName,
    UUID taskId, String taskName,
    String description,
    Instant startTime, Instant endTime,
    int durationSeconds,
    LocalDate entryDate,
    boolean billable,
    BigDecimal hourlyRateSnapshot,
    String currencyCodeSnapshot,
    BigDecimal amountSnapshot,
    TimeEntrySource source,
    List<TagRef> tags,
    Instant createdAt, Instant updatedAt
) {}

public record TagRef(UUID id, String name, String color) {}
```

---

## Business-Regeln

Vollständige Regeln in [rules/business-rules.md](../rules/business-rules.md).

Kurzfassung:
- `endTime > startTime` (DB-Constraint + Service-Validierung)
- `durationSeconds > 0` (DB-Constraint)
- `entryDate` aus `endTime` in App-Zeitzone
- `hourlyRateSnapshot` nach Priorität: Task > aktive ProjectRate > Project-Default > App-Default
- `amountSnapshot = 0.00` wenn `billable = false`
- Snapshot bleibt unveränderlich nach Erstellung (außer bei `PUT`)

---

## Tests

| Test | Typ | Was |
|---|---|---|
| `TimeEntryServiceTest` | Unit | durationSeconds Berechnung |
| `TimeEntryServiceTest` | Unit | endTime <= startTime → Exception |
| `TimeEntryServiceTest` | Unit | billable=false → amount=0 |
| `TimeEntryServiceTest` | Unit | Rate-Snapshot korrekt gesetzt |
| `TimeEntryRepositoryTest` | Integration | Filter nach Datum, Projekt, Billable |
| `TimeEntryControllerTest` | `@WebMvcTest` | CRUD + Validierungsfehler |
