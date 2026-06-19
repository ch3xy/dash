# Modul: Dashboard

Aggregierte Schnellübersicht. Kein eigener Datenspeicher — liest aus bestehenden Tabellen.

---

## Backend-Klassen

### `DashboardService.java`

```java
@Service
public class DashboardService {

    public DashboardResponse getDashboard() {
        LocalDate today = LocalDate.now(appZone);
        LocalDate weekStart = today.with(DayOfWeek.MONDAY);
        LocalDate monthStart = today.withDayOfMonth(1);

        return new DashboardResponse(
            getTodayStats(today),
            getWeekStats(weekStart, today),
            getMonthStats(monthStart, today),
            timerService.getCurrent(),
            getBudgetAlerts(),
            getTopProjects(today.minusDays(30), today, 5),
            getTopClients(today.minusDays(30), today, 5)
        );
    }

    private PeriodStats getTodayStats(LocalDate date) {
        // SUM(duration_seconds) und SUM(amount_snapshot) für entry_date = :date
    }

    private List<BudgetAlert> getBudgetAlerts() {
        // Alle Projekte mit hour_budget_minutes != null und usedPercent >= 80
        // Sortiert nach usedPercent DESC
    }
}
```

### `DashboardController.java`

```java
@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {
    @GetMapping
    public ResponseEntity<DashboardResponse> getDashboard() { ... }
}
```

### DTOs

```java
public record DashboardResponse(
    PeriodStats today,
    PeriodStats thisWeek,
    PeriodStats thisMonth,
    TimerResponse runningTimer,         // null wenn kein Timer
    List<BudgetAlert> budgetAlerts,
    List<TopProject> topProjects,
    List<TopClient> topClients
) {}

public record PeriodStats(
    int durationSeconds,
    BigDecimal revenueAmount,
    String currencyCode
) {}

public record BudgetAlert(
    UUID projectId,
    String projectName,
    double usedPercent,
    BudgetAlertStatus status            // WARNING|EXCEEDED
) {}

public record TopProject(
    UUID projectId,
    String projectName,
    String color,
    int durationSeconds
) {}

public record TopClient(
    UUID clientId,
    String clientName,
    BigDecimal revenueAmount,
    String currencyCode
) {}
```

---

## Performance

Dashboard wird häufig aufgerufen. Queries sollen effizient sein:

- `PeriodStats`: Einfache SUM-Aggregation mit Index auf `entry_date`.
- `BudgetAlerts`: Wie im Report-Modul, aber nur Projekte ≥ 80%.
- `TopProjects` / `TopClients`: Limitiert auf N Ergebnisse, Zeitfenster letzte 30 Tage.

Optional: Response-Caching mit kurzer TTL (30s) wenn Performance-Problem auftritt.
