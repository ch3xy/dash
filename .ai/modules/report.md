# Modul: Report

Eigene Services und Query-Layer für alle Aggregationen. Kein JPA-Entity-Graph für Reports — SQL-Aggregation bevorzugt.

---

## Architektur

```
ReportController
    → ReportService
        → ReportRepository (Native SQL Queries)
        → TimeEntryRepository (für detaillierte Listen)
        → ProjectRepository (für Budget-Status)
```

Report-Queries laufen direkt als native SQL oder JPQL-Aggregationen.  
Keine Business-Logik in Queries — Filterung im SQL, Metriken im Service berechnet.

---

## `ReportRepository.java`

```java
@Repository
public class ReportRepository {

    // Summary: Aggregation pro Gruppierungsfeld
    @Query(value = """
        SELECT
            CASE
                WHEN :groupBy = 'PROJECT' THEN p.id::text
                WHEN :groupBy = 'CLIENT' THEN c.id::text
                WHEN :groupBy = 'TASK' THEN t.id::text
                ELSE 'ALL'
            END as group_key,
            CASE
                WHEN :groupBy = 'PROJECT' THEN p.name
                WHEN :groupBy = 'CLIENT' THEN c.name
                WHEN :groupBy = 'TASK' THEN t.name
                ELSE 'Total'
            END as group_label,
            SUM(te.duration_seconds) as total_seconds,
            SUM(CASE WHEN te.billable THEN te.duration_seconds ELSE 0 END) as billable_seconds,
            SUM(CASE WHEN te.billable THEN te.amount_snapshot ELSE 0 END) as revenue
        FROM time_entries te
        JOIN projects p ON p.id = te.project_id
        LEFT JOIN clients c ON c.id = p.client_id
        LEFT JOIN tasks t ON t.id = te.task_id
        WHERE (:from IS NULL OR te.entry_date >= :from)
          AND (:to IS NULL OR te.entry_date <= :to)
          AND (:projectId IS NULL OR te.project_id = :projectId::uuid)
          AND (:clientId IS NULL OR p.client_id = :clientId::uuid)
          AND (:taskId IS NULL OR te.task_id = :taskId::uuid)
          AND (:billable IS NULL OR te.billable = :billable)
        GROUP BY group_key, group_label
        ORDER BY total_seconds DESC
    """, nativeQuery = true)
    List<Object[]> summaryGrouped(
        LocalDate from, LocalDate to,
        String projectId, String clientId, String taskId,
        Boolean billable, String groupBy
    );

    // Trend: Aggregation pro Zeitperiode
    @Query(value = """
        SELECT
            CASE :granularity
                WHEN 'DAY'   THEN te.entry_date::text
                WHEN 'WEEK'  THEN date_trunc('week', te.entry_date)::text
                WHEN 'MONTH' THEN date_trunc('month', te.entry_date)::text
            END as period,
            SUM(te.duration_seconds) as total_seconds,
            SUM(CASE WHEN te.billable THEN te.amount_snapshot ELSE 0 END) as revenue
        FROM time_entries te
        WHERE te.entry_date BETWEEN :from AND :to
        GROUP BY period
        ORDER BY period
    """, nativeQuery = true)
    List<Object[]> trendData(LocalDate from, LocalDate to, String granularity);

    // Heatmap: Aktivität pro Tag
    @Query(value = """
        SELECT entry_date, SUM(duration_seconds) as total_seconds
        FROM time_entries
        WHERE entry_date BETWEEN :from AND :to
        GROUP BY entry_date
    """, nativeQuery = true)
    List<Object[]> heatmapData(LocalDate from, LocalDate to);

    // Budget-Status für alle Projekte
    @Query(value = """
        SELECT
            p.id,
            p.name,
            p.hour_budget_minutes,
            p.budget_reset,
            COALESCE(SUM(te.duration_seconds), 0) as used_seconds,
            COALESCE(SUM(CASE WHEN te.billable THEN te.amount_snapshot ELSE 0 END), 0) as revenue
        FROM projects p
        LEFT JOIN time_entries te ON te.project_id = p.id
            AND (:resetMonthly = false OR te.entry_date >= date_trunc('month', CURRENT_DATE)::date)
            AND (:resetYearly = false OR te.entry_date >= date_trunc('year', CURRENT_DATE)::date)
        WHERE p.hour_budget_minutes IS NOT NULL
          AND p.status != 'ARCHIVED'
        GROUP BY p.id, p.name, p.hour_budget_minutes, p.budget_reset
        ORDER BY (COALESCE(SUM(te.duration_seconds), 0) / 60.0 / p.hour_budget_minutes) DESC
    """, nativeQuery = true)
    List<Object[]> budgetStatus(boolean resetMonthly, boolean resetYearly);
}
```

---

## `ReportService.java`

Methoden:

```java
public SummaryReportResponse getSummary(ReportFilter filter) {
    // Ruft summaryGrouped auf
    // Mappt Object[] auf SummaryGroup Records
    // Berechnet Gesamtmetriken + billableRatio
}

public Page<TimeEntryResponse> getDetailed(ReportFilter filter, Pageable pageable) {
    // Delegiert an TimeEntryRepository.findWithFilter
}

public WeeklyReportResponse getWeekly(LocalDate weekStart) {
    // Berechnet weekStart (Montag) und weekEnd (Sonntag)
    // Aggregiert TimeEntries nach Tagen
}

public List<BudgetReportEntry> getBudgetReport() {
    // Ruft budgetStatus auf
    // Berechnet usedPercent, status (ON_TRACK/WARNING/EXCEEDED)
}

public TrendReportResponse getTrends(ReportFilter filter, String granularity) {}

public HeatmapResponse getHeatmap(int year) {}

public byte[] exportCsv(ReportFilter filter) {
    // Alle Einträge (ohne Paginierung) → CSV via Apache Commons CSV
}

public byte[] exportXlsx(ReportFilter filter) {
    // Apache POI für XLSX
}
```

---

## `ReportFilter.java`

```java
public record ReportFilter(
    LocalDate from,
    LocalDate to,
    UUID clientId,
    UUID projectId,
    UUID taskId,
    UUID tagId,
    Boolean billable,
    String q,
    String groupBy,   // PROJECT|CLIENT|TASK|DAY|WEEK|MONTH
    boolean rounded
) {}
```

---

## Report-Response-Shapes

Vollständige JSON-Shapes: s. [api.md](../api.md) — Abschnitt Reports.

---

## CSV-Export Format

Spalten (Reihenfolge):

```
Date, Day, Client, Project, Task, Description, Start, End, Duration (h:mm), Duration (decimal), Billable, Rate, Currency, Amount, Tags
```

Beispiel:
```csv
Date,Day,Client,Project,Task,Description,Start,End,Duration,Duration (decimal),Billable,Rate,Currency,Amount,Tags
2026-06-19,Friday,Acme Corp,Website Relaunch,Development,Homepage layout,08:00,10:00,2:00,2.00,Yes,85.00,EUR,170.00,Design;Frontend
```

---

## XLSX-Export

- Apache POI `XSSFWorkbook`.
- Erste Zeile: Header (fett, Hintergrund grau).
- Datum-Spalten als Excel-Date-Format.
- Betragspalten als `#,##0.00` Currency-Format.
- Auto-Spaltenbreite nach Schreiben.

---

## Dependency (pom.xml / build.gradle)

```xml
<!-- Apache Commons CSV für CSV-Export -->
<dependency>
    <groupId>org.apache.commons</groupId>
    <artifactId>commons-csv</artifactId>
    <version>1.12.0</version>
</dependency>

<!-- Apache POI für XLSX -->
<dependency>
    <groupId>org.apache.poi</groupId>
    <artifactId>poi-ooxml</artifactId>
    <version>5.3.0</version>
</dependency>
```

---

## Tests

| Test | Typ | Was |
|---|---|---|
| `ReportRepositoryTest` | Integration | summaryGrouped nach Projekt/Datum |
| `ReportRepositoryTest` | Integration | trendData MONTHLY Granularität |
| `ReportRepositoryTest` | Integration | budgetStatus mit MONTHLY Reset |
| `ReportServiceTest` | Unit | billableRatio Berechnung |
| `ReportServiceTest` | Unit | CSV-Export Header und Zeilen |
| `ReportControllerTest` | `@WebMvcTest` | Filter-Parameter korrekt weitergeleitet |
