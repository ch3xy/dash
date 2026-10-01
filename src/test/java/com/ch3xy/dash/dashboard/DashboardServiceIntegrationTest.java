package com.ch3xy.dash.dashboard;

import com.ch3xy.dash.AbstractIntegrationTest;
import com.ch3xy.dash.project.BudgetReset;
import com.ch3xy.dash.project.ProjectRequest;
import com.ch3xy.dash.project.ProjectResponse;
import com.ch3xy.dash.project.ProjectService;
import com.ch3xy.dash.timeentry.TimeEntryRequest;
import com.ch3xy.dash.timeentry.TimeEntryService;
import com.ch3xy.dash.timer.RunningTimerRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DashboardServiceIntegrationTest extends AbstractIntegrationTest {

    @Autowired DashboardService dashboardService;
    @Autowired ProjectService projectService;
    @Autowired TimeEntryService timeEntryService;
    @Autowired RunningTimerRepository timerRepository;

    @Test
    void dashboardReturnsPeriodStatsAndNoTimerWhenNoneRunning() {
        timerRepository.deleteAll();
        // Ensure at least one project with a budget exists so budget query runs.
        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Dash Project " + System.nanoTime(), null, null, true,
                new BigDecimal("60.00"), "EUR", 6000, null, BudgetReset.NONE));
        assertThat(project.id()).isNotNull();

        DashboardResponse dashboard = dashboardService.getDashboard(null, null);

        assertThat(dashboard.today()).isNotNull();
        assertThat(dashboard.period()).isNotNull();
        assertThat(dashboard.today().currencyCode()).isEqualTo("EUR");
        assertThat(dashboard.runningTimer()).isNull();
        assertThat(dashboard.budgetAlerts()).isNotNull();
        assertThat(dashboard.topProjects()).isNotNull();
        assertThat(dashboard.topClients()).isNotNull();
    }

    @Test
    void defaultPeriodIsCurrentWeekMondayToSunday() {
        DashboardResponse dashboard = dashboardService.getDashboard(null, null);

        assertThat(dashboard.from().getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY);
        assertThat(dashboard.to()).isEqualTo(dashboard.from().plusDays(6));
    }

    @Test
    void periodStatsAndTopProjectsFollowRequestedRange() {
        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Dash Range " + System.nanoTime(), null, null, true,
                new BigDecimal("100.00"), "EUR", null, null, BudgetReset.NONE));
        // Isolated window: April 2027 (Vienna = UTC+2).
        timeEntryService.create(new TimeEntryRequest(project.id(), null, "in range",
                Instant.parse("2027-04-06T07:00:00Z"), Instant.parse("2027-04-06T09:00:00Z"), true, Set.of()));
        timeEntryService.create(new TimeEntryRequest(project.id(), null, "outside",
                Instant.parse("2027-04-20T07:00:00Z"), Instant.parse("2027-04-20T08:00:00Z"), true, Set.of()));

        DashboardResponse dashboard = dashboardService.getDashboard(
                LocalDate.of(2027, 4, 5), LocalDate.of(2027, 4, 11));

        assertThat(dashboard.period().durationSeconds()).isEqualTo(7200);
        assertThat(dashboard.period().revenueAmount()).isEqualByComparingTo("200.00");
        assertThat(dashboard.topProjects()).anySatisfy(p -> {
            assertThat(p.projectId()).isEqualTo(project.id());
            assertThat(p.durationSeconds()).isEqualTo(7200);
        });
    }

    @Test
    void rejectsInvertedRange() {
        assertThatThrownBy(() -> dashboardService.getDashboard(
                LocalDate.of(2027, 4, 11), LocalDate.of(2027, 4, 5)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
