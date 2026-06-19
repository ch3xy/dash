package com.ch3xy.dash.report;

import com.ch3xy.dash.AbstractIntegrationTest;
import com.ch3xy.dash.project.BudgetReset;
import com.ch3xy.dash.project.ProjectRequest;
import com.ch3xy.dash.project.ProjectResponse;
import com.ch3xy.dash.project.ProjectService;
import com.ch3xy.dash.report.dto.WeeklyReportResponse;
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
}
