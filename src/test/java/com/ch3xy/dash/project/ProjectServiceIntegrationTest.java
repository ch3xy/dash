package com.ch3xy.dash.project;

import com.ch3xy.dash.AbstractIntegrationTest;
import com.ch3xy.dash.timeentry.TimeEntryRequest;
import com.ch3xy.dash.timeentry.TimeEntryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProjectServiceIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    ProjectService service;

    @Autowired
    ProjectRateRepository rateRepository;

    @Autowired
    TimeEntryService timeEntryService;

    private ProjectResponse newProject(String name) {
        return service.create(new ProjectRequest(
                null, name, null, null, true,
                new BigDecimal("80.00"), "EUR", 6000, null, BudgetReset.NONE));
    }

    @Test
    void addingRateClosesPreviousOpenRate() {
        ProjectResponse project = newProject("Rate History Project");

        Instant t1 = Instant.parse("2026-01-01T00:00:00Z");
        Instant t2 = Instant.parse("2026-06-01T00:00:00Z");

        service.addRate(project.id(), new ProjectRateRequest(new BigDecimal("85.00"), "EUR", t1, "initial"));
        service.addRate(project.id(), new ProjectRateRequest(new BigDecimal("95.00"), "EUR", t2, "increase"));

        List<ProjectRate> rates = rateRepository.findAllByProjectIdOrderByValidFromDesc(project.id());
        assertThat(rates).hasSize(2);

        ProjectRate newest = rates.get(0);
        ProjectRate oldest = rates.get(1);
        assertThat(newest.getHourlyRate()).isEqualByComparingTo("95.00");
        assertThat(newest.getValidTo()).isNull();
        assertThat(oldest.getValidTo()).isEqualTo(t2);

        assertThat(rateRepository.findActiveRateAt(project.id(), t1).orElseThrow().getHourlyRate())
                .isEqualByComparingTo("85.00");
        assertThat(rateRepository.findActiveRateAt(project.id(), t2).orElseThrow().getHourlyRate())
                .isEqualByComparingTo("95.00");
    }

    @Test
    void budgetStatusReportsOnTrackForEmptyProject() {
        ProjectResponse project = newProject("Budget Project");
        BudgetStatusResponse status = service.getBudgetStatus(project.id());

        assertThat(status.usedMinutes()).isZero();
        assertThat(status.remainingMinutes()).isEqualTo(6000);
        assertThat(status.status()).isEqualTo("ON_TRACK");
        assertThat(status.budgetPeriod()).isEqualTo("ALL_TIME");
    }

    @Test
    void backdatedRateIsRejectedAndHistoryStaysIntact() {
        ProjectResponse project = newProject("Backdated Rate Project " + System.nanoTime());
        service.addRate(project.id(), new ProjectRateRequest(
                new BigDecimal("85.00"), "EUR", Instant.parse("2026-03-01T00:00:00Z"), null));

        assertThatThrownBy(() -> service.addRate(project.id(), new ProjectRateRequest(
                new BigDecimal("70.00"), "EUR", Instant.parse("2026-01-01T00:00:00Z"), null)))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(rateRepository.findAllByProjectIdOrderByValidFromDesc(project.id()))
                .singleElement().satisfies(r -> assertThat(r.getValidTo()).isNull());
    }

    @Test
    void budgetStatusWithoutHourBudgetStillReportsRevenue() {
        ProjectResponse project = service.create(new ProjectRequest(
                null, "Money Budget Project " + System.nanoTime(), null, null, true,
                new BigDecimal("100.00"), "EUR", null, new BigDecimal("5000.00"), BudgetReset.NONE));
        timeEntryService.create(new TimeEntryRequest(project.id(), null, "work",
                Instant.parse("2026-05-04T08:00:00Z"), Instant.parse("2026-05-04T10:00:00Z"), true, Set.of()));

        BudgetStatusResponse status = service.getBudgetStatus(project.id());

        assertThat(status.status()).isEqualTo("NO_BUDGET");
        assertThat(status.usedMinutes()).isEqualTo(120);
        assertThat(status.revenueAmount()).isEqualByComparingTo("200.00");
    }
}
