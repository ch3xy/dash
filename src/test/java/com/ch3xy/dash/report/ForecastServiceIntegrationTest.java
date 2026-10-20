package com.ch3xy.dash.report;

import com.ch3xy.dash.AbstractIntegrationTest;
import com.ch3xy.dash.client.ClientRequest;
import com.ch3xy.dash.client.ClientResponse;
import com.ch3xy.dash.client.ClientService;
import com.ch3xy.dash.project.BudgetReset;
import com.ch3xy.dash.project.ProjectRequest;
import com.ch3xy.dash.project.ProjectResponse;
import com.ch3xy.dash.project.ProjectService;
import com.ch3xy.dash.project.ProjectStatus;
import com.ch3xy.dash.report.dto.ForecastResponse;
import com.ch3xy.dash.timeentry.TimeEntryRequest;
import com.ch3xy.dash.timeentry.TimeEntryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ForecastServiceIntegrationTest extends AbstractIntegrationTest {

    // Far in the future so no other test data falls into the source year.
    private static final LocalDate TODAY = LocalDate.of(2041, 10, 20);

    @Autowired ForecastService forecastService;
    @Autowired ClientService clientService;
    @Autowired ProjectService projectService;
    @Autowired TimeEntryService timeEntryService;

    @Test
    void lastYearsTimeOfArchivedProjectIsPricedAtClientsCurrentProject() {
        ClientResponse client = clientService.create(new ClientRequest("Forecast A " + System.nanoTime(), null, null, null, null));
        ProjectResponse old = project(client.id(), "A1", "50.00");
        // 5h on Monday 2040-10-22 → 52 weeks later: Monday 2041-10-21.
        entry(old.id(), "2040-10-22T07:00:00Z", "2040-10-22T12:00:00Z", true);
        projectService.updateStatus(old.id(), ProjectStatus.ARCHIVED);
        ProjectResponse current = project(client.id(), "A2", "100.00");

        ForecastResponse fc = forecastService.getForecast(monthFilter(client.id(), GroupBy.PROJECT), false, TODAY);

        assertThat(fc.from()).isEqualTo(LocalDate.of(2041, 10, 21));
        assertThat(fc.to()).isEqualTo(LocalDate.of(2041, 10, 31));
        assertThat(fc.totalDurationSeconds()).isEqualTo(5 * 3600);
        assertThat(fc.revenueAmount()).isEqualByComparingTo("500.00");
        assertThat(fc.groups()).singleElement().satisfies(g -> {
            assertThat(g.key()).isEqualTo(current.id().toString());
            assertThat(g.label()).isEqualTo("A2");
        });
        assertThat(fc.sourceFrom()).isEqualTo(LocalDate.of(2040, 10, 22));
        assertThat(fc.days()).hasSize(11);
        assertThat(fc.days().getFirst().totalSeconds()).isEqualTo(5 * 3600);
    }

    @Test
    void elapsedDaysAndNonBillableTimeDoNotAddRevenue() {
        ClientResponse client = clientService.create(new ClientRequest("Forecast B " + System.nanoTime(), null, null, null, null));
        ProjectResponse p = project(client.id(), "B1", "80.00");
        // Before "today" next year → already elapsed, not part of the forecast.
        entry(p.id(), "2040-10-10T07:00:00Z", "2040-10-10T09:00:00Z", true);
        entry(p.id(), "2040-10-22T07:00:00Z", "2040-10-22T09:00:00Z", false);

        ForecastResponse fc = forecastService.getForecast(monthFilter(client.id(), GroupBy.CLIENT), false, TODAY);

        assertThat(fc.totalDurationSeconds()).isEqualTo(2 * 3600);
        assertThat(fc.billableDurationSeconds()).isZero();
        assertThat(fc.revenueAmount()).isEqualByComparingTo("0");
        assertThat(fc.groups()).singleElement().satisfies(g -> assertThat(g.key()).isEqualTo(client.id().toString()));
    }

    @Test
    void rangeWithoutFuturePartIsEmpty() {
        ReportFilter past = new ReportFilter(LocalDate.of(2041, 10, 1), TODAY,
                null, null, null, null, null, null, GroupBy.PROJECT);

        ForecastResponse fc = forecastService.getForecast(past, false, TODAY);

        assertThat(fc.from()).isNull();
        assertThat(fc.groups()).isEmpty();
        assertThat(fc.days()).isEmpty();
    }

    private ProjectResponse project(UUID clientId, String name, String rate) {
        return projectService.create(new ProjectRequest(clientId, name, null, null, true,
                new BigDecimal(rate), "EUR", null, null, BudgetReset.NONE));
    }

    private void entry(UUID projectId, String start, String end, boolean billable) {
        timeEntryService.create(new TimeEntryRequest(projectId, null, "x",
                Instant.parse(start), Instant.parse(end), billable, Set.of()));
    }

    private static ReportFilter monthFilter(UUID clientId, GroupBy groupBy) {
        return new ReportFilter(LocalDate.of(2041, 10, 1), LocalDate.of(2041, 10, 31),
                clientId, null, null, null, null, null, groupBy);
    }
}
