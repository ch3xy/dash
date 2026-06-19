package com.ch3xy.dash.dashboard;

import com.ch3xy.dash.AbstractIntegrationTest;
import com.ch3xy.dash.project.BudgetReset;
import com.ch3xy.dash.project.ProjectRequest;
import com.ch3xy.dash.project.ProjectResponse;
import com.ch3xy.dash.project.ProjectService;
import com.ch3xy.dash.timer.RunningTimerRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class DashboardServiceIntegrationTest extends AbstractIntegrationTest {

    @Autowired DashboardService dashboardService;
    @Autowired ProjectService projectService;
    @Autowired RunningTimerRepository timerRepository;

    @Test
    void dashboardReturnsPeriodStatsAndNoTimerWhenNoneRunning() {
        timerRepository.deleteAll();
        // Ensure at least one project with a budget exists so budget query runs.
        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Dash Project " + System.nanoTime(), null, null, true,
                new BigDecimal("60.00"), "EUR", 6000, null, BudgetReset.NONE));
        assertThat(project.id()).isNotNull();

        DashboardResponse dashboard = dashboardService.getDashboard();

        assertThat(dashboard.today()).isNotNull();
        assertThat(dashboard.thisWeek()).isNotNull();
        assertThat(dashboard.thisMonth()).isNotNull();
        assertThat(dashboard.today().currencyCode()).isEqualTo("EUR");
        assertThat(dashboard.runningTimer()).isNull();
        assertThat(dashboard.budgetAlerts()).isNotNull();
        assertThat(dashboard.topProjects()).isNotNull();
        assertThat(dashboard.topClients()).isNotNull();
    }
}
