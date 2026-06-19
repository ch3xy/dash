package com.ch3xy.dash.timeentry;

import com.ch3xy.dash.AbstractIntegrationTest;
import com.ch3xy.dash.project.BudgetReset;
import com.ch3xy.dash.project.ProjectRateRequest;
import com.ch3xy.dash.project.ProjectRequest;
import com.ch3xy.dash.project.ProjectResponse;
import com.ch3xy.dash.project.ProjectService;
import com.ch3xy.dash.task.TaskRequest;
import com.ch3xy.dash.task.TaskResponse;
import com.ch3xy.dash.task.TaskService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TimeEntryServiceIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    TimeEntryService service;
    @Autowired
    ProjectService projectService;
    @Autowired
    TaskService taskService;

    private static final Instant START = Instant.parse("2026-06-19T08:00:00Z");
    private static final Instant END = Instant.parse("2026-06-19T10:00:00Z"); // 2h

    private ProjectResponse projectWithDefaultRate() {
        return projectService.create(new ProjectRequest(
                null, "TE Project " + System.nanoTime(), null, null, true,
                new BigDecimal("50.00"), "EUR", null, null, BudgetReset.NONE));
    }

    @Test
    void taskOverrideTakesPriorityOverProjectRate() {
        ProjectResponse project = projectWithDefaultRate();
        projectService.addRate(project.id(), new ProjectRateRequest(
                new BigDecimal("80.00"), "EUR", Instant.parse("2026-01-01T00:00:00Z"), null));
        TaskResponse task = taskService.create(project.id(), new TaskRequest(
                "Override Task", null, true, new BigDecimal("120.00"), null));

        TimeEntryResponse entry = service.create(new TimeEntryRequest(
                project.id(), task.id(), "x", START, END, true, Set.of()));

        assertThat(entry.hourlyRateSnapshot()).isEqualByComparingTo("120.00");
        assertThat(entry.amountSnapshot()).isEqualByComparingTo("240.00"); // 2h * 120
    }

    @Test
    void activeProjectRateUsedWhenNoTaskOverride() {
        ProjectResponse project = projectWithDefaultRate();
        projectService.addRate(project.id(), new ProjectRateRequest(
                new BigDecimal("80.00"), "EUR", Instant.parse("2026-01-01T00:00:00Z"), null));

        TimeEntryResponse entry = service.create(new TimeEntryRequest(
                project.id(), null, "x", START, END, true, Set.of()));

        assertThat(entry.hourlyRateSnapshot()).isEqualByComparingTo("80.00");
        assertThat(entry.amountSnapshot()).isEqualByComparingTo("160.00");
    }

    @Test
    void projectDefaultRateUsedWhenNoProjectRateExists() {
        ProjectResponse project = projectWithDefaultRate();

        TimeEntryResponse entry = service.create(new TimeEntryRequest(
                project.id(), null, "x", START, END, true, Set.of()));

        assertThat(entry.hourlyRateSnapshot()).isEqualByComparingTo("50.00");
        assertThat(entry.amountSnapshot()).isEqualByComparingTo("100.00");
    }

    @Test
    void nonBillableEntryHasZeroAmount() {
        ProjectResponse project = projectWithDefaultRate();

        TimeEntryResponse entry = service.create(new TimeEntryRequest(
                project.id(), null, "x", START, END, false, Set.of()));

        assertThat(entry.amountSnapshot()).isEqualByComparingTo("0.00");
    }

    @Test
    void endBeforeStartIsRejected() {
        ProjectResponse project = projectWithDefaultRate();

        assertThatThrownBy(() -> service.create(new TimeEntryRequest(
                project.id(), null, "x", END, START, true, Set.of())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("endTime must be after startTime");
    }

    @Test
    void clientSuppliedSortIsIgnoredAndDoesNotBreakTheNativeQuery() {
        ProjectResponse project = projectWithDefaultRate();
        service.create(new TimeEntryRequest(project.id(), null, "x", START, END, true, Set.of()));

        // A camelCase sort property would previously be appended verbatim to the native SQL
        // ORDER BY (e.g. "te.startTime"), crashing on PostgreSQL. It must now be ignored.
        var sorted = PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "startTime"));
        var result = service.findAll(
                new TimeEntryFilter(null, null, null, project.id(), null, null, null, null), sorted);

        assertThat(result.getContent()).hasSize(1);
    }

    @Test
    void changingProjectRateLeavesExistingEntrySnapshotStable() {
        ProjectResponse project = projectWithDefaultRate();
        projectService.addRate(project.id(), new ProjectRateRequest(
                new BigDecimal("80.00"), "EUR", Instant.parse("2026-01-01T00:00:00Z"), null));

        TimeEntryResponse entry = service.create(new TimeEntryRequest(
                project.id(), null, "x", START, END, true, Set.of()));
        assertThat(entry.hourlyRateSnapshot()).isEqualByComparingTo("80.00");

        // Introduce a new, higher rate effective later — historical entry must not change.
        projectService.addRate(project.id(), new ProjectRateRequest(
                new BigDecimal("200.00"), "EUR", Instant.parse("2026-06-15T00:00:00Z"), null));

        assertThat(service.findById(entry.id()).hourlyRateSnapshot()).isEqualByComparingTo("80.00");
    }
}
