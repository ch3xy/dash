# Modul: Settings

Schlüssel-Wert-Konfiguration der Anwendung. Wird von allen anderen Modulen gelesen.

---

## Datenbank

Tabelle `app_settings` — siehe [datamodel.md](../datamodel.md).

Default-Werte via Flyway V9 eingefügt.

---

## Backend-Klassen

### `AppSetting.java`

```java
@Entity @Table(name = "app_settings")
public class AppSetting {
    @Id String key;
    @NotBlank String value;
}
```

### `AppSettingsRepository.java`

```java
public interface AppSettingsRepository extends JpaRepository<AppSetting, String> {}
```

### `AppSettingsService.java`

Zentrale Anlaufstelle für alle anderen Services.

```java
@Service
public class AppSettingsService {

    public ZoneId getTimezone() {
        return ZoneId.of(getValue("timezone"));
    }

    public String getCurrency() {
        return getValue("currency");
    }

    public BigDecimal getDefaultRate() {
        return new BigDecimal(getValue("default_rate"));
    }

    public RoundingRule getRoundingRule() {
        return RoundingRule.valueOf(getValue("rounding_rule"));
    }

    public int getRoundingMinutes() {
        return Integer.parseInt(getValue("rounding_minutes"));
    }

    public AppSettingsResponse getAll() {
        // Alle Settings als typisiertes DTO
    }

    public AppSettingsResponse updateAll(AppSettingsRequest req) {
        // Alle Settings in einer Transaktion speichern
        // Validiert ZoneId und Währungscode
    }

    private String getValue(String key) {
        return repository.findById(key)
            .map(AppSetting::getValue)
            .orElseThrow(() -> new IllegalStateException("Setting '" + key + "' not found"));
    }
}

public enum RoundingRule { NONE, UP, NEAREST, DOWN }
```

### `AppSettingsController.java`

```java
@RestController @RequestMapping("/api/v1/settings")
public class AppSettingsController {
    @GetMapping  public ResponseEntity<AppSettingsResponse> get() { ... }
    @PutMapping  public ResponseEntity<AppSettingsResponse> update(@Valid @RequestBody AppSettingsRequest req) { ... }
}
```

### DTOs

```java
public record AppSettingsResponse(
    String timezone,
    String currency,
    BigDecimal defaultRate,
    String roundingRule,
    int roundingMinutes
) {}

public record AppSettingsRequest(
    @NotBlank String timezone,       // muss valide ZoneId sein
    @NotBlank String currency,       // ISO 4217, 3 Buchstaben
    @NotNull BigDecimal defaultRate,
    @NotNull String roundingRule,    // NONE|UP|NEAREST|DOWN
    int roundingMinutes              // 5|10|15|30
) {}
```

---

## Validierung

- `timezone`: `ZoneId.of(value)` darf keine `DateTimeException` werfen.
- `currency`: 3 Großbuchstaben (Regex `[A-Z]{3}`).
- `roundingMinutes`: muss in `{5, 10, 15, 30}` enthalten sein (wenn `roundingRule != NONE`).

---

## Verwendung in anderen Services

```java
// In TimerService oder TimeEntryService
private final AppSettingsService settings;

ZoneId zone = settings.getTimezone();
LocalDate entryDate = endTime.atZone(zone).toLocalDate();

BigDecimal fallbackRate = settings.getDefaultRate();
```

`AppSettingsService` wird **überall** injiziert wo Zeitzone, Währung oder Default-Rate gebraucht wird.
