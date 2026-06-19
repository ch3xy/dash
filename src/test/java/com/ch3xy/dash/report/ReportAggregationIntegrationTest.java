package com.ch3xy.dash.report;

import com.ch3xy.dash.AbstractIntegrationTest;
import com.ch3xy.dash.client.ClientRequest;
import com.ch3xy.dash.client.ClientResponse;
import com.ch3xy.dash.client.ClientService;
import com.ch3xy.dash.project.BudgetReset;
import com.ch3xy.dash.project.ProjectRequest;
import com.ch3xy.dash.project.ProjectResponse;
import com.ch3xy.dash.project.ProjectService;
import com.ch3xy.dash.report.dto.BudgetReportEntry;
import com.ch3xy.dash.report.dto.SummaryReportResponse;
import com.ch3xy.dash.report.dto.TrendReportResponse;
import com.ch3xy.dash.timeentry.TimeEntryRequest;
import com.ch3xy.dash.timeentry.TimeEntryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class ReportAggregationIntegrationTest extends AbstractIntegrationTest {

    @Autowired ReportService reportService;
    @Autowired CsvExportService csvExportService;
    @Autowired ClientService clientService;
    @Autowired ProjectService projectService;
    @Autowired TimeEntryService timeEntryService;

    // Isolated reporting window (February 2026) to avoid collisions with other tests.
    private static final LocalDate FROM = LocalDate.of(2026, 2, 1);
    private static final LocalDate TO = LocalDate.of(2026, 2, 28);

    private ReportFilter window(GroupBy groupBy) {
        return new ReportFilter(FROM, TO, null, null, null, null, null, null, groupBy);
    }

    @Test
    void summaryGroupsByProjectWithBillableRatioAndRevenue() {
        ClientResponse client = clientService.create(new ClientRequest("Report Client " + System.nanoTime(), null, null, null, "EUR"));
        ProjectResponse project = projectService.create(new ProjectRequest(
                client.id(), "Report Project " + System.nanoTime(), null, null, true,
                new BigDecimal("100.00"), "EUR", null, null, BudgetReset.NONE));

        // 2h billable (=200.00) + 1h non-billable
        timeEntryService.create(new TimeEntryRequest(project.id(), null, "billable work",
                Instant.parse("2026-02-10T08:00:00Z"), Instant.parse("2026-02-10T10:00:00Z"), true, Set.of()));
        timeEntryService.create(new TimeEntryRequest(project.id(), null, "admin",
                Instant.parse("2026-02-11T08:00:00Z"), Instant.parse("2026-02-11T09:00:00Z"), false, Set.of()));

        // Filter to just this project to isolate assertions.
        ReportFilter filter = new ReportFilter(FROM, TO, null, project.id(), null, null, null, null, GroupBy.PROJECT);
        SummaryReportResponse summary = reportService.getSummary(filter);

        assertThat(summary.totalDurationSeconds()).isEqualTo(10800); // 3h
        assertThat(summary.billableDurationSeconds()).isEqualTo(7200); // 2h
        assertThat(summary.nonBillableDurationSeconds()).isEqualTo(3600);
        assertThat(summary.billableRatio()).isEqualTo(7200.0 / 10800.0);
        assertThat(summary.revenueAmount()).isEqualByComparingTo("200.00");
        assertThat(summary.groups()).hasSize(1);
        assertThat(summary.groups().get(0).label()).startsWith("Report Project");
    }

    @Test
    void budgetReportComputesUsedPercentAndStatus() {
        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Budget Report Project " + System.nanoTime(), null, null, true,
                new BigDecimal("50.00"), "EUR", 120, null, BudgetReset.NONE)); // 120 min budget

        // Log 108 minutes (90%) → WARNING
        timeEntryService.create(new TimeEntryRequest(project.id(), null, "x",
                Instant.parse("2026-02-05T08:00:00Z"), Instant.parse("2026-02-05T09:48:00Z"), true, Set.of()));

        BudgetReportEntry entry = reportService.getBudgetReport().stream()
                .filter(b -> b.projectId().equals(project.id()))
                .findFirst().orElseThrow();

        assertThat(entry.usedMinutes()).isEqualTo(108);
        assertThat(entry.usedPercent()).isEqualTo(90.0);
        assertThat(entry.status()).isEqualTo("WARNING");
    }

    @Test
    void trendReportBucketsByDay() {
        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Trend Project " + System.nanoTime(), null, null, true,
                new BigDecimal("60.00"), "EUR", null, null, BudgetReset.NONE));
        ReportFilter filter = new ReportFilter(
                LocalDate.of(2026, 2, 20), LocalDate.of(2026, 2, 21),
                null, project.id(), null, null, null, null, null);

        timeEntryService.create(new TimeEntryRequest(project.id(), null, "d1",
                Instant.parse("2026-02-20T08:00:00Z"), Instant.parse("2026-02-20T09:00:00Z"), true, Set.of()));

        TrendReportResponse trend = reportService.getTrends(filter, GroupBy.DAY);
        assertThat(trend.granularity()).isEqualTo("DAY");
        assertThat(trend.data()).anySatisfy(p -> {
            assertThat(p.period()).isEqualTo("2026-02-20");
            assertThat(p.durationSeconds()).isEqualTo(3600);
            assertThat(p.revenueAmount()).isEqualByComparingTo("60.00");
        });
    }

    @Test
    void csvExportContainsHeaderAndRows() {
        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Csv Project " + System.nanoTime(), null, null, true,
                new BigDecimal("70.00"), "EUR", null, null, BudgetReset.NONE));
        timeEntryService.create(new TimeEntryRequest(project.id(), null, "exported work",
                Instant.parse("2026-02-15T08:00:00Z"), Instant.parse("2026-02-15T10:00:00Z"), true, Set.of()));

        ReportFilter filter = new ReportFilter(FROM, TO, null, project.id(), null, null, null, null, null);
        String csv = csvExportService.export(filter);

        assertThat(csv).startsWith("Date,Day,Client,Project,Task,Description");
        assertThat(csv).contains("exported work");
        assertThat(csv).contains("2:00");      // duration h:mm
        assertThat(csv).contains("140.00");    // 2h * 70.00
    }
}
