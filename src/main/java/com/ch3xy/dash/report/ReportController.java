package com.ch3xy.dash.report;

import com.ch3xy.dash.common.pagination.PageResponse;
import com.ch3xy.dash.report.dto.BudgetReportEntry;
import com.ch3xy.dash.report.dto.HeatmapResponse;
import com.ch3xy.dash.report.dto.SummaryReportResponse;
import com.ch3xy.dash.report.dto.TrendReportResponse;
import com.ch3xy.dash.report.dto.WeeklyReportResponse;
import com.ch3xy.dash.timeentry.TimeEntryResponse;
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

    @GetMapping("/summary")
    public ResponseEntity<SummaryReportResponse> summary(
            FilterParams params,
            @RequestParam(defaultValue = "false") boolean rounded) {
        return ResponseEntity.ok(service.getSummary(params.toFilter(), rounded));
    }

    @GetMapping("/detailed")
    public ResponseEntity<PageResponse<TimeEntryResponse>> detailed(FilterParams params, Pageable pageable) {
        return ResponseEntity.ok(PageResponse.of(service.getDetailed(params.toFilter(), pageable)));
    }

    @GetMapping("/budget")
    public ResponseEntity<List<BudgetReportEntry>> budget() {
        return ResponseEntity.ok(service.getBudgetReport());
    }

    @GetMapping("/revenue")
    public ResponseEntity<SummaryReportResponse> revenue(FilterParams params) {
        return ResponseEntity.ok(service.getRevenue(params.toFilter()));
    }

    @GetMapping("/trends")
    public ResponseEntity<TrendReportResponse> trends(
            FilterParams params,
            @RequestParam(required = false) GroupBy granularity,
            @RequestParam(defaultValue = "false") boolean rounded) {
        return ResponseEntity.ok(service.getTrends(params.toFilter(), granularity, rounded));
    }

    @GetMapping("/heatmap")
    public ResponseEntity<HeatmapResponse> heatmap(@RequestParam(required = false) Integer year) {
        return ResponseEntity.ok(service.getHeatmap(year));
    }

    @GetMapping("/weekly")
    public ResponseEntity<WeeklyReportResponse> weekly(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart) {
        return ResponseEntity.ok(service.getWeekly(weekStart));
    }

    @GetMapping("/export.csv")
    public ResponseEntity<byte[]> exportCsv(FilterParams params) {
        byte[] body = csvExportService.export(params.toFilter()).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"report.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(body);
    }

    @GetMapping("/export.xlsx")
    public ResponseEntity<byte[]> exportXlsx(FilterParams params) {
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
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            UUID clientId,
            UUID projectId,
            UUID taskId,
            UUID tagId,
            Boolean billable,
            String q,
            GroupBy groupBy
    ) {
        ReportFilter toFilter() {
            return new ReportFilter(from, to, clientId, projectId, taskId, tagId, billable, q, groupBy);
        }
    }
}
