package com.ch3xy.dash.report;

import com.ch3xy.dash.AbstractIntegrationTest;
import com.ch3xy.dash.project.BudgetReset;
import com.ch3xy.dash.project.ProjectRequest;
import com.ch3xy.dash.project.ProjectResponse;
import com.ch3xy.dash.project.ProjectService;
import com.ch3xy.dash.report.dto.DailyBreakdownResponse;
import com.ch3xy.dash.report.dto.WeeklyReportResponse;
import com.ch3xy.dash.settings.RoundingRule;
import com.ch3xy.dash.timeentry.TimeEntryRequest;
import com.ch3xy.dash.timeentry.TimeEntryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class ReportServiceIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    ReportService reportService;
    @Autowired
    ProjectService projectService;
    @Autowired
    TimeEntryService timeEntryService;
    @Autowired
    ReportQueryRepository queryRepository;

    @Test
    void weeklyReportGroupsEntriesByDayAndTotalsTheWeek() {
        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Weekly Project " + System.nanoTime(), null, null, true,
                new BigDecimal("60.00"), "EUR", null, null, BudgetReset.NONE));

        // Isolated week (March 2026) so entries from other test classes don't pollute it.
        // Monday 2026-03-16: 1h, Wednesday 2026-03-18: 2h
        timeEntryService.create(new TimeEntryRequest(project.id(), null, "mon",
                Instant.parse("2026-03-16T08:00:00Z"), Instant.parse("2026-03-16T09:00:00Z"),
                true, Set.of()));
        timeEntryService.create(new TimeEntryRequest(project.id(), null, "wed",
                Instant.parse("2026-03-18T08:00:00Z"), Instant.parse("2026-03-18T10:00:00Z"),
                true, Set.of()));

        WeeklyReportResponse week = reportService.getWeekly(LocalDate.of(2026, 3, 18));

        assertThat(week.weekStart()).isEqualTo(LocalDate.of(2026, 3, 16));
        assertThat(week.weekEnd()).isEqualTo(LocalDate.of(2026, 3, 22));
        assertThat(week.days()).hasSize(7);
        assertThat(week.weekTotalSeconds()).isEqualTo(10800); // 1h + 2h

        WeeklyReportResponse.WeeklyDay monday = week.days().get(0);
        assertThat(monday.date()).isEqualTo(LocalDate.of(2026, 3, 16));
        assertThat(monday.totalSeconds()).isEqualTo(3600);
        assertThat(monday.entries()).hasSize(1);

        WeeklyReportResponse.WeeklyDay tuesday = week.days().get(1);
        assertThat(tuesday.totalSeconds()).isZero();
        assertThat(tuesday.entries()).isEmpty();
    }

    @Test
    void dailyBreakdownSegmentsCarryBillableTimeAndRevenue() {
        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Daily Project " + System.nanoTime(), null, null, true,
                new BigDecimal("80.00"), "EUR", null, null, BudgetReset.NONE));

        // Isolated day (April 2026): 2h billable + 1h non-billable.
        timeEntryService.create(new TimeEntryRequest(project.id(), null, "billable",
                Instant.parse("2026-04-14T08:00:00Z"), Instant.parse("2026-04-14T10:00:00Z"),
                true, Set.of()));
        timeEntryService.create(new TimeEntryRequest(project.id(), null, "internal",
                Instant.parse("2026-04-14T11:00:00Z"), Instant.parse("2026-04-14T12:00:00Z"),
                false, Set.of()));

        DailyBreakdownResponse breakdown = reportService.getDailyBreakdown(new ReportFilter(
                LocalDate.of(2026, 4, 14), LocalDate.of(2026, 4, 14),
                null, project.id(), null, null, null, null, GroupBy.PROJECT), false);

        assertThat(breakdown.days()).singleElement().satisfies(day ->
                assertThat(day.projects()).singleElement().satisfies(seg -> {
                    assertThat(seg.durationSeconds()).isEqualTo(3 * 3600);
                    assertThat(seg.billableSeconds()).isEqualTo(2 * 3600);
                    assertThat(seg.revenueAmount()).isEqualByComparingTo("160.00");
                }));
    }

    @Test
    void dailyProjectRowsApplyRoundingToDurationAndBillableTime() {
        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Rounded Daily " + System.nanoTime(), null, null, true,
                new BigDecimal("60.00"), "EUR", null, null, BudgetReset.NONE));
        // Two 5-minute entries (one billable) → each rounds up to 15 minutes.
        timeEntryService.create(new TimeEntryRequest(project.id(), null, "a",
                Instant.parse("2026-04-15T08:00:00Z"), Instant.parse("2026-04-15T08:05:00Z"),
                true, Set.of()));
        timeEntryService.create(new TimeEntryRequest(project.id(), null, "b",
                Instant.parse("2026-04-15T09:00:00Z"), Instant.parse("2026-04-15T09:05:00Z"),
                false, Set.of()));
        ReportFilter filter = new ReportFilter(LocalDate.of(2026, 4, 15), LocalDate.of(2026, 4, 15),
                null, project.id(), null, null, null, null, GroupBy.PROJECT);

        assertThat(queryRepository.dailyProjectRows(filter, RoundingRule.UP, 15)).singleElement().satisfies(seg -> {
            assertThat(seg.durationSeconds()).isEqualTo(30 * 60);
            assertThat(seg.billableSeconds()).isEqualTo(15 * 60);
        });
        assertThat(queryRepository.dailyProjectRows(filter, RoundingRule.NONE, 0)).singleElement()
                .satisfies(seg -> assertThat(seg.durationSeconds()).isEqualTo(10 * 60));
    }
}
