# Modul: Timer

Verwaltet den laufenden Timer (RunningTimer). Maximal ein Timer gleichzeitig.

---

## Datenbank

Tabelle `running_timers` — siehe [datamodel.md](../datamodel.md).

Die Tabelle enthält maximal eine Zeile. Dies wird auf Anwendungsebene erzwungen (kein DB-Constraint nötig, da atomare Checks im Service).

---

## Backend-Klassen

### `RunningTimer.java`

```java
@Entity @Table(name = "running_timers")
public class RunningTimer {
    @Id @UuidGenerator UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "project_id") Project project;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "task_id") Task task;  // nullable
    String description;
    @NotNull Instant startTime;
    boolean billable;
    @CreationTimestamp Instant createdAt;

    // Tags werden nicht in running_timers gespeichert — beim Stoppen übernommen
    @Transient Set<UUID> tagIds;  // im Request gehalten, nicht persistiert
}
```

Tags werden im `TimerService` im Memory gehalten und beim Stop an `TimeEntryService.create` übergeben. Alternativ: separate `running_timer_tags`-Tabelle (bei Neustart des Servers nötig).

**Empfehlung: `running_timer_tags`-Tabelle** für Persistenz über Server-Neustarts hinweg.

```sql
-- V8b (ergänzen zu V8)
create table running_timer_tags (
  running_timer_id uuid not null references running_timers(id) on delete cascade,
  tag_id           uuid not null references tags(id),
  primary key (running_timer_id, tag_id)
);
```

### `RunningTimerRepository.java`

```java
public interface RunningTimerRepository extends JpaRepository<RunningTimer, UUID> {
    Optional<RunningTimer> findFirst();
    boolean existsBy();  // true wenn mind. ein Timer läuft
}
```

### `TimerService.java`

```java
@Service @Transactional
public class TimerService {

    public TimerResponse getCurrent() {
        // findFirst() → Optional<RunningTimer>
        // Wenn vorhanden: elapsedSeconds = ChronoUnit.SECONDS.between(timer.startTime, clock.instant())
    }

    public TimerResponse start(TimerStartRequest req) {
        // Wenn existsBy() → throw new IllegalStateException("Timer already running") → 409
        // RunningTimer erstellen und speichern
        // Tags in running_timer_tags speichern
    }

    public TimeEntryResponse stop(String descriptionOverride) {
        // findFirst() oder EntityNotFoundException
        // endTime = clock.instant()
        // durationSeconds berechnen
        // TimeEntryRequest bauen mit source=TIMER
        // TimeEntryService.create aufrufen
        // RunningTimer löschen
        // TimeEntry zurückgeben
    }

    public void discard() {
        // findFirst() löschen oder EntityNotFoundException
    }

    public TimerResponse update(TimerUpdateRequest req) {
        // findFirst() updaten (project, task, description, billable, tags)
    }
}
```

### `TimerController.java`

Endpunkte und Response-Shapes: s. [api.md](../api.md) — Abschnitt Timer.

### DTOs

```java
public record TimerStartRequest(
    @NotNull UUID projectId,
    UUID taskId,
    String description,
    boolean billable,
    Set<UUID> tagIds
) {}

public record TimerUpdateRequest(
    UUID projectId,
    UUID taskId,
    String description,
    Boolean billable,
    Set<UUID> tagIds
) {}

public record TimerResponse(
    UUID id,
    UUID projectId, String projectName,
    UUID taskId, String taskName,
    String description,
    Instant startTime,
    long elapsedSeconds,
    boolean billable,
    List<TagRef> tags
) {}

public record TimerStopRequest(String description) {}  // optional override
```

---

## Business-Regeln (Timer-spezifisch)

Vollständige Lifecycle-Dokumentation in [rules/business-rules.md](../rules/business-rules.md#5-timer-lifecycle).

- 409 Conflict wenn Timer läuft und `start` erneut aufgerufen wird.
- `stop` erstellt immer einen `TimeEntry` mit `source = TIMER`.
- `entryDate` des resultierenden TimeEntry = `endTime.atZone(appZone).toLocalDate()`.
- Timer über Mitternacht: kein automatisches Splitten.
- `discard` löscht Timer ohne TimeEntry.

---

## Tests

| Test | Typ | Was |
|---|---|---|
| `TimerServiceTest` | Unit | start → stop → TimeEntry erstellt |
| `TimerServiceTest` | Unit | start bei laufendem Timer → 409 |
| `TimerServiceTest` | Unit | discard → kein TimeEntry |
| `TimerServiceTest` | Unit | Timer über Mitternacht (23:00–01:00) |
| `TimerServiceTest` | Unit | elapsedSeconds korrekt mit fixed Clock |
| `TimerControllerTest` | `@WebMvcTest` | GET /timer/current → 404 wenn kein Timer |
