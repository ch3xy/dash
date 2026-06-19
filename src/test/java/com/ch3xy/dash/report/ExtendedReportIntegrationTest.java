package com.ch3xy.dash.report;

import com.ch3xy.dash.AbstractIntegrationTest;
import com.ch3xy.dash.project.BudgetReset;
import com.ch3xy.dash.project.ProjectRequest;
import com.ch3xy.dash.project.ProjectResponse;
import com.ch3xy.dash.project.ProjectService;
import com.ch3xy.dash.report.dto.HeatmapResponse;
import com.ch3xy.dash.report.dto.SummaryReportResponse;
import com.ch3xy.dash.settings.AppSettingsRequest;
import com.ch3xy.dash.settings.AppSettingsService;
import com.ch3xy.dash.timeentry.TimeEntryRequest;
import com.ch3xy.dash.timeentry.TimeEntryService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class ExtendedReportIntegrationTest extends AbstractIntegrationTest {

    @Autowired ReportService reportService;
    @Autowired XlsxExportService xlsxExportService;
    @Autowired ProjectService projectService;
    @Autowired TimeEntryService timeEntryService;
    @Autowired AppSettingsService settingsService;

    @AfterEach
    void resetRounding() {
        settingsService.update(new AppSettingsRequest(
                "Europe/Vienna", "EUR", new BigDecimal("0.00"), "NONE", 15));
    }

    @Test
    void roundedSummaryRoundsEachEntryUpToInterval() {
        // Configure 15-minute round-up.
        settingsService.update(new AppSettingsRequest(
                "Europe/Vienna", "EUR", new BigDecimal("0.00"), "UP", 15));

        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Rounded Project " + System.nanoTime(), null, null, true,
                new BigDecimal("60.00"), "EUR", null, null, BudgetReset.NONE));

        // 50 minutes → rounds up to 60 minutes (3600s) with 15-min UP rounding.
        timeEntryService.create(new TimeEntryRequest(project.id(), null, "x",
                Instant.parse("2026-04-10T08:00:00Z"), Instant.parse("2026-04-10T08:50:00Z"),
                true, Set.of()));

        ReportFilter filter = new ReportFilter(
                LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30),
                null, project.id(), null, null, null, null, GroupBy.PROJECT);

        SummaryReportResponse raw = reportService.getSummary(filter, false);
        SummaryReportResponse rounded = reportService.getSummary(filter, true);

        assertThat(raw.totalDurationSeconds()).isEqualTo(3000);     // 50 min
        assertThat(rounded.totalDurationSeconds()).isEqualTo(3600); // rounded up to 60 min
    }

    @Test
    void heatmapAggregatesPerDayWithIntensity() {
        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Heatmap Project " + System.nanoTime(), null, null, true,
                new BigDecimal("60.00"), "EUR", null, null, BudgetReset.NONE));

        // 8h on 2026-05-04 → intensity 1.0
        timeEntryService.create(new TimeEntryRequest(project.id(), null, "full day",
                Instant.parse("2026-05-04T06:00:00Z"), Instant.parse("2026-05-04T14:00:00Z"),
                true, Set.of()));

        HeatmapResponse heatmap = reportService.getHeatmap(2026);
        assertThat(heatmap.year()).isEqualTo(2026);

        HeatmapResponse.HeatmapDay day = heatmap.data().stream()
                .filter(d -> d.date().equals(LocalDate.of(2026, 5, 4)))
                .findFirst().orElseThrow();
        assertThat(day.durationSeconds()).isGreaterThanOrEqualTo(28800);
        assertThat(day.intensity()).isEqualTo(1.0);
    }

    @Test
    void xlsxExportProducesNonEmptyWorkbook() {
        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Xlsx Project " + System.nanoTime(), null, null, true,
                new BigDecimal("70.00"), "EUR", null, null, BudgetReset.NONE));
        timeEntryService.create(new TimeEntryRequest(project.id(), null, "xlsx work",
                Instant.parse("2026-04-15T08:00:00Z"), Instant.parse("2026-04-15T10:00:00Z"),
                true, Set.of()));

        ReportFilter filter = new ReportFilter(
                LocalDate.of(2026, 4, 1), LocalDate.of(2026, 4, 30),
                null, project.id(), null, null, null, null, null);
        byte[] xlsx = xlsxExportService.export(filter);

        // XLSX files are ZIP archives → start with the "PK" magic bytes.
        assertThat(xlsx).isNotEmpty();
        assertThat(xlsx[0]).isEqualTo((byte) 'P');
        assertThat(xlsx[1]).isEqualTo((byte) 'K');
    }
}
