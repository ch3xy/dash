# Modul: Task

Tasks/Aktivitäten innerhalb von Projekten. Optional — Zeiteinträge können ohne Task existieren.

---

## Datenbank

Tabelle `tasks` — siehe [datamodel.md](../datamodel.md).

Constraint: `ux_task_name_per_project` — `unique lower(name) per project_id`

---

## Backend-Klassen

### `Task.java`

```java
@Entity @Table(name = "tasks")
public class Task {
    @Id @UuidGenerator UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "project_id") Project project;
    @NotBlank String name;
    String description;
    boolean billableByDefault;
    BigDecimal hourlyRateOverride;    // nullable; überschreibt Projektrate
    Integer estimatedMinutes;         // nullable
    boolean archived;
    @CreationTimestamp Instant createdAt;
    @UpdateTimestamp Instant updatedAt;
}
```

### `TaskRepository.java`

```java
public interface TaskRepository extends JpaRepository<Task, UUID> {
    List<Task> findAllByProjectIdAndArchivedFalseOrderByNameAsc(UUID projectId);
    List<Task> findAllByProjectIdOrderByNameAsc(UUID projectId);
    boolean existsByNameIgnoreCaseAndProjectIdAndIdNot(String name, UUID projectId, UUID excludeId);
}
```

### `TaskService.java`

Methoden:
- `findByProject(UUID projectId, boolean includeArchived)` → `List<TaskResponse>`
- `findById(UUID)` → `TaskResponse`
- `create(UUID projectId, TaskRequest)` → `TaskResponse`; wirft 409 bei Namenskollision
- `update(UUID, TaskRequest)` → `TaskResponse`
- `archive(UUID)` → void; kein Hard-Delete (Einträge referenzieren Tasks)

### DTOs

```java
public record TaskRequest(
    @NotBlank String name,
    String description,
    boolean billableByDefault,
    BigDecimal hourlyRateOverride,
    Integer estimatedMinutes
) {}

public record TaskResponse(
    UUID id,
    UUID projectId,
    String name,
    String description,
    boolean billableByDefault,
    BigDecimal hourlyRateOverride,
    Integer estimatedMinutes,
    boolean archived,
    Instant createdAt,
    Instant updatedAt
) {}
```

---

## Business-Regeln

- Task-Name einmalig je Projekt (case-insensitiv).
- `hourlyRateOverride` hat höchste Priorität in der Rate-Resolution (s. [rules/business-rules.md](../rules/business-rules.md)).
- Archivierte Tasks werden aus Auswahlfeldern ausgeblendet, bleiben aber in alten TimeEntries sichtbar.
- Tasks können nicht gelöscht werden wenn TimeEntries sie referenzieren.
