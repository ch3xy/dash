# Modul: Client

Verwaltet Kunden. Kunden sind optional — Projekte können ohne Kunden existieren.

---

## Datenbank

Tabelle `clients` — siehe [datamodel.md](../datamodel.md).

Relevante Constraints:
- `ux_active_client_name`: `unique lower(name) where archived = false`
- Kein Hard-Delete wenn Projekte existieren → `409 Conflict`

---

## Backend-Klassen

### `Client.java`

```java
@Entity @Table(name = "clients")
public class Client {
    @Id @UuidGenerator UUID id;
    @NotBlank String name;
    String description;
    @Email String email;
    String website;
    String currencyCode;              // ISO 4217, nullable (erbt von AppSettings)
    boolean archived;
    @CreationTimestamp Instant createdAt;
    @UpdateTimestamp Instant updatedAt;
}
```

### `ClientRepository.java`

```java
public interface ClientRepository extends JpaRepository<Client, UUID> {
    List<Client> findAllByArchivedFalseOrderByNameAsc();
    List<Client> findAllOrderByNameAsc();
    boolean existsByNameIgnoreCaseAndArchivedFalseAndIdNot(String name, UUID excludeId);
    boolean existsByNameIgnoreCaseAndArchivedFalse(String name);
}
```

### `ClientService.java`

Methoden:
- `findAll(boolean includeArchived)` → `List<ClientResponse>`
- `findById(UUID)` → `ClientResponse` oder `EntityNotFoundException`
- `create(ClientRequest)` → `ClientResponse`; wirft `409` bei Namenskollision
- `update(UUID, ClientRequest)` → `ClientResponse`; prüft Namenskollision (excl. sich selbst)
- `archive(UUID)` → prüft ob aktive Projekte existieren (wenn ja: wirft `409`)
- `delete(UUID)` → nur wenn keine Projekte; sonst `409`

### `ClientController.java`

Endpunkte: s. [api.md](../api.md) — Abschnitt Clients.

### DTOs

```java
public record ClientRequest(
    @NotBlank String name,
    String description,
    @Email String email,
    String website,
    String currencyCode
) {}

public record ClientResponse(
    UUID id,
    String name,
    String description,
    String email,
    String website,
    String currencyCode,
    boolean archived,
    Instant createdAt,
    Instant updatedAt
) {}
```

---

## Business-Regeln

- Name case-insensitiv einmalig unter aktiven Kunden.
- Archivierter Kunde kann reaktiviert werden (Name-Check erneut).
- Hard-Delete nur wenn keine Projekte (`projects.client_id` hat keinen Eintrag für diese UUID).
- Archivierte Kunden erscheinen in Reports aber nicht in Auswahlfeldern.

---

## Tests

| Test | Typ | Was |
|---|---|---|
| `ClientServiceTest` | Unit | create doppelter Name → Exception |
| `ClientServiceTest` | Unit | archive mit Projekten → Exception |
| `ClientControllerTest` | `@WebMvcTest` | POST valide → 201, POST leer → 422 |
| `ClientRepositoryTest` | Integration | Unique-Index greift |
