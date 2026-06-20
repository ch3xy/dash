package com.ch3xy.dash.report;

import com.ch3xy.dash.common.pagination.PageResponse;
import com.ch3xy.dash.report.dto.BudgetReportEntry;
import com.ch3xy.dash.report.dto.HeatmapResponse;
import com.ch3xy.dash.report.dto.SummaryReportResponse;
import com.ch3xy.dash.report.dto.TrendReportResponse;
import com.ch3xy.dash.report.dto.WeeklyReportResponse;
import com.ch3xy.dash.timeentry.TimeEntryResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Tag(name = "Reports", description = "Auswertungen und Datenexporte. Alle Report-Endpunkte akzeptieren dieselben Filterparameter (Zeitraum, Kunde, Projekt, Task, Tag, Billable, Freitext).")
@RestController
@RequestMapping("/api/v1/reports")
public class ReportController {

    private final ReportService service;
    private final CsvExportService csvExportService;
    private final XlsxExportService xlsxExportService;

    public ReportController(ReportService service,
                            CsvExportService csvExportService,
                            XlsxExportService xlsxExportService) {
        this.service = service;
        this.csvExportService = csvExportService;
        this.xlsxExportService = xlsxExportService;
    }

    @Operation(
            summary = "Zusammenfassenden Report abrufen",
            description = "Aggregiert Zeiteinträge nach den gewählten Filtern und Gruppierungen. Liefert Gesamtdauer, abrechenbare Dauer, nicht-abrechenbare Dauer, Billable-Quote, Umsatz sowie Top-Projekte und Top-Kunden."
    )
    @GetMapping("/summary")
    public ResponseEntity<SummaryReportResponse> summary(
            @ParameterObject FilterParams params,
            @Parameter(description = "Wenn true, werden Dauern gemäß der konfigurierten App-Rundungsregel gerundet (z. B. auf 15 Minuten). Standardmäßig werden Rohdauern verwendet.") @RequestParam(defaultValue = "false") boolean rounded) {
        return ResponseEntity.ok(service.getSummary(params.toFilter(), rounded));
    }

    @Operation(
            summary = "Detaillierten Report mit Einzeleinträgen abrufen",
            description = "Gibt eine paginierte Liste aller Zeiteinträge zurück, die den Filterkriterien entsprechen. Nützlich zum Prüfen und Exportieren einzelner Einträge."
    )
    @GetMapping("/detailed")
    public ResponseEntity<PageResponse<TimeEntryResponse>> detailed(
            @ParameterObject FilterParams params,
            @ParameterObject Pageable pageable) {
        return ResponseEntity.ok(PageResponse.of(service.getDetailed(params.toFilter(), pageable)));
    }

    @Operation(
            summary = "Budgetstatus aller Projekte abrufen",
            description = "Gibt für jedes Projekt mit definiertem Stundenbudget den aktuellen Verbrauch, die verbleibenden Stunden und den Verbrauchsprozentsatz zurück. Projekte über 80 % sollten als Warnung und über 100 % als überschritten hervorgehoben werden."
    )
    @GetMapping("/budget")
    public ResponseEntity<List<BudgetReportEntry>> budget() {
        return ResponseEntity.ok(service.getBudgetReport());
    }

    @Operation(
            summary = "Umsatz-Report abrufen",
            description = "Aggregiert den erzielten Umsatz (abrechenbare Stunden × Stundensatz-Snapshot) nach den gewählten Filtern und Gruppierungen. Nicht-abrechenbare Einträge tragen keinen Umsatz bei."
    )
    @GetMapping("/revenue")
    public ResponseEntity<SummaryReportResponse> revenue(@ParameterObject FilterParams params) {
        return ResponseEntity.ok(service.getRevenue(params.toFilter()));
    }

    @Operation(
            summary = "Zeittrend-Report abrufen",
            description = "Gibt die erfassten Stunden als Zeitreihe zurück, aggregiert nach der gewählten Granularität (DAY, WEEK, MONTH). Nützlich für Liniendiagramme und Trendanalysen."
    )
    @GetMapping("/trends")
    public ResponseEntity<TrendReportResponse> trends(
            @ParameterObject FilterParams params,
            @Parameter(description = "Zeitliche Granularität der Aggregation: DAY, WEEK oder MONTH. Standard ist DAY.") @RequestParam(required = false) GroupBy granularity,
            @Parameter(description = "Wenn true, werden Dauern gemäß der App-Rundungsregel gerundet.") @RequestParam(defaultValue = "false") boolean rounded) {
        return ResponseEntity.ok(service.getTrends(params.toFilter(), granularity, rounded));
    }

    @Operation(
            summary = "Aktivitäts-Heatmap abrufen",
            description = "Gibt für jeden Kalendertag des angegebenen Jahres die gesamte Trackinglaufzeit in Sekunden zurück. Tage ohne Einträge haben den Wert 0. Geeignet für GitHub-ähnliche Aktivitätsheatmaps."
    )
    @GetMapping("/heatmap")
    public ResponseEntity<HeatmapResponse> heatmap(
            @Parameter(description = "Kalenderjahr (z. B. 2025). Wenn nicht angegeben, wird das aktuelle Jahr verwendet.") @RequestParam(required = false) Integer year) {
        return ResponseEntity.ok(service.getHeatmap(year));
    }

    @Operation(
            summary = "Wochenbericht abrufen",
            description = "Gibt die Zeiteinträge der angegebenen Woche aggregiert nach Projekt und Wochentag zurück. Nützlich für die Timesheet-Ansicht. Montag gilt als Wochenstart."
    )
    @GetMapping("/weekly")
    public ResponseEntity<WeeklyReportResponse> weekly(
            @Parameter(description = "Montag der gewünschten Woche (ISO-8601, z. B. 2025-01-06). Wenn nicht angegeben, wird die aktuelle Woche verwendet.") @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart) {
        return ResponseEntity.ok(service.getWeekly(weekStart));
    }

    @Operation(
            summary = "Report als CSV-Datei exportieren",
            description = "Exportiert alle gefilterten Zeiteinträge als CSV-Datei (UTF-8, Semikolon-getrennt). Der Content-Disposition-Header triggert den Browser-Download."
    )
    @GetMapping("/export.csv")
    public ResponseEntity<byte[]> exportCsv(@ParameterObject FilterParams params) {
        byte[] body = csvExportService.export(params.toFilter()).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"report.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(body);
    }

    @Operation(
            summary = "Report als XLSX-Datei exportieren",
            description = "Exportiert alle gefilterten Zeiteinträge als Excel-Datei (.xlsx). Der Content-Disposition-Header triggert den Browser-Download."
    )
    @GetMapping("/export.xlsx")
    public ResponseEntity<byte[]> exportXlsx(@ParameterObject FilterParams params) {
        byte[] body = xlsxExportService.export(params.toFilter());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"report.xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(body);
    }

    /**
     * Shared query parameters for report endpoints, bound from the request.
     */
    public record FilterParams(
            @Parameter(description = "Startdatum des Zeitraums (ISO-8601, z. B. 2025-01-01). Filtert nach entryDate.")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,

            @Parameter(description = "Enddatum des Zeitraums (ISO-8601, z. B. 2025-01-31). Filtert nach entryDate.")
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,

            @Parameter(description = "UUID des Kunden — schließt alle Projekte dieses Kunden ein.")
            UUID clientId,

            @Parameter(description = "UUID des Projekts.")
            UUID projectId,

            @Parameter(description = "UUID des Tasks.")
            UUID taskId,

            @Parameter(description = "UUID des Tags — filtert auf Einträge mit diesem Tag.")
            UUID tagId,

            @Parameter(description = "Wenn true, werden nur abrechenbare Einträge ausgewertet. Wenn false, nur nicht-abrechenbare.")
            Boolean billable,

            @Parameter(description = "Freitextsuche in der Beschreibung (case-insensitive, enthält-Suche).")
            String q,

            @Parameter(description = "Gruppierungsdimension: CLIENT, PROJECT, TASK, TAG, DATE, DAY_OF_WEEK, WEEK oder MONTH.")
            GroupBy groupBy
    ) {
        ReportFilter toFilter() {
            return new ReportFilter(from, to, clientId, projectId, taskId, tagId, billable, q, groupBy);
        }
    }
}
