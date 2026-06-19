# Modul: Tag

Flexible Kategorisierung für Zeiteinträge. Globale Liste, nicht projektgebunden.

---

## Datenbank

Tabelle `tags`, Junction `time_entry_tags` — siehe [datamodel.md](../datamodel.md).

---

## Backend-Klassen

### `Tag.java`

```java
@Entity @Table(name = "tags")
public class Tag {
    @Id @UuidGenerator UUID id;
    @NotBlank String name;
    String color;        // Optional, Hex-Code
    boolean archived;
    @CreationTimestamp Instant createdAt;
    @UpdateTimestamp Instant updatedAt;
}
```

### `TagRepository.java`

```java
public interface TagRepository extends JpaRepository<Tag, UUID> {
    List<Tag> findAllByArchivedFalseOrderByNameAsc();
    boolean existsByNameIgnoreCaseAndArchivedFalse(String name);
    boolean existsByNameIgnoreCaseAndArchivedFalseAndIdNot(String name, UUID excludeId);
}
```

### `TagService.java`

- `findAll(boolean includeArchived)` → `List<TagResponse>`
- `create(TagRequest)` → `TagResponse`; 409 bei Namenskollision
- `update(UUID, TagRequest)` → `TagResponse`
- `archive(UUID)` → void

### DTOs

```java
public record TagRequest(
    @NotBlank String name,
    String color
) {}

public record TagResponse(
    UUID id,
    String name,
    String color,
    boolean archived,
    Instant createdAt,
    Instant updatedAt
) {}
```

---

## Business-Regeln

- Tag-Name einmalig unter aktiven Tags (case-insensitiv).
- Tags können jederzeit archiviert werden; bestehende TimeEntry-Verknüpfungen bleiben erhalten.
- Kein Hard-Delete.
