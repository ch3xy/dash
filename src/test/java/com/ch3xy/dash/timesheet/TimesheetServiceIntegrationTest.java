package com.ch3xy.dash.timesheet;

import com.ch3xy.dash.AbstractIntegrationTest;
import com.ch3xy.dash.project.BudgetReset;
import com.ch3xy.dash.project.ProjectRequest;
import com.ch3xy.dash.project.ProjectResponse;
import com.ch3xy.dash.project.ProjectService;
import com.ch3xy.dash.task.TaskRequest;
import com.ch3xy.dash.task.TaskResponse;
import com.ch3xy.dash.task.TaskService;
import com.ch3xy.dash.timeentry.TimeEntryFilter;
import com.ch3xy.dash.timeentry.TimeEntryRequest;
import com.ch3xy.dash.timeentry.TimeEntryResponse;
import com.ch3xy.dash.timeentry.TimeEntryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TimesheetServiceIntegrationTest extends AbstractIntegrationTest {

    @Autowired TimesheetService timesheetService;
    @Autowired TimeEntryService timeEntryService;
    @Autowired ProjectService projectService;
    @Autowired TaskService taskService;

    // Isolated window (February 2027, Europe/Vienna = UTC+1).
    private static final LocalDate DAY = LocalDate.of(2027, 2, 9);

    private ProjectResponse project(boolean billable) {
        return projectService.create(new ProjectRequest(
                null, "Timesheet Project " + System.nanoTime(), null, null, billable,
                new BigDecimal("80.00"), "EUR", null, null, BudgetReset.NONE));
    }

    private List<TimeEntryResponse> entries(UUID projectId, LocalDate from, LocalDate to) {
        return timeEntryService.findAll(
                new TimeEntryFilter(from, to, null, projectId, null, null, null, null),
                Pageable.unpaged()).getContent();
    }

    @Test
    void settingEmptyCellCreatesEntryAtDayStartWithProjectBillableDefault() {
        ProjectResponse p = project(false);

        timesheetService.setCell(new TimesheetCellRequest(p.id(), null, DAY, 5400));

        List<TimeEntryResponse> result = entries(p.id(), DAY, DAY);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).durationSeconds()).isEqualTo(5400);
        assertThat(result.get(0).startTime()).isEqualTo(Instant.parse("2027-02-09T08:00:00Z")); // 09:00 Vienna
        assertThat(result.get(0).billable()).isFalse();
    }

    @Test
    void increasingCellAppendsAfterLastEntryOfTheDay() {
        ProjectResponse p = project(true);
        timeEntryService.create(new TimeEntryRequest(p.id(), null, "existing",
                Instant.parse("2027-02-10T08:00:00Z"), Instant.parse("2027-02-10T09:00:00Z"), true, Set.of()));

        timesheetService.setCell(new TimesheetCellRequest(p.id(), null, DAY.plusDays(1), 7200));

        List<TimeEntryResponse> result = entries(p.id(), DAY.plusDays(1), DAY.plusDays(1));
        assertThat(result).hasSize(2);
        assertThat(result).anySatisfy(e -> {
            assertThat(e.startTime()).isEqualTo(Instant.parse("2027-02-10T09:00:00Z"));
            assertThat(e.durationSeconds()).isEqualTo(3600);
        });
    }

    @Test
    void decreasingCellTrimsLatestEntriesAndDeletesShrunkOnes() {
        ProjectResponse p = project(true);
        LocalDate day = DAY.plusDays(2);
        timeEntryService.create(new TimeEntryRequest(p.id(), null, "morning",
                Instant.parse("2027-02-11T08:00:00Z"), Instant.parse("2027-02-11T10:00:00Z"), true, Set.of()));
        timeEntryService.create(new TimeEntryRequest(p.id(), null, "afternoon",
                Instant.parse("2027-02-11T12:00:00Z"), Instant.parse("2027-02-11T12:30:00Z"), true, Set.of()));

        // 2.5h -> 1.5h: the 30min afternoon entry goes, the morning entry loses 30min.
        timesheetService.setCell(new TimesheetCellRequest(p.id(), null, day, 5400));

        List<TimeEntryResponse> result = entries(p.id(), day, day);
        assertThat(result).hasSize(1);
        assertThat(result.get(0).description()).isEqualTo("morning");
        assertThat(result.get(0).endTime()).isEqualTo(Instant.parse("2027-02-11T09:30:00Z"));
        assertThat(result.get(0).amountSnapshot()).isEqualByComparingTo("120.00");
    }

    @Test
    void cellsAreSeparatedByTask() {
        ProjectResponse p = project(true);
        TaskResponse task = taskService.create(p.id(), new TaskRequest("Design", null, false, null, null));
        LocalDate day = DAY.plusDays(3);
        timeEntryService.create(new TimeEntryRequest(p.id(), null, "no task",
                Instant.parse("2027-02-12T08:00:00Z"), Instant.parse("2027-02-12T09:00:00Z"), true, Set.of()));

        timesheetService.setCell(new TimesheetCellRequest(p.id(), task.id(), day, 1800));

        List<TimeEntryResponse> result = entries(p.id(), day, day);
        assertThat(result).hasSize(2);
        assertThat(result).anySatisfy(e -> {
            assertThat(e.taskId()).isEqualTo(task.id());
            assertThat(e.durationSeconds()).isEqualTo(1800);
            assertThat(e.billable()).isFalse(); // task default wins
        });
        assertThat(result).anySatisfy(e -> assertThat(e.description()).isEqualTo("no task"));
    }

    @Test
    void copyWeekShiftsEntriesBySevenDays() {
        ProjectResponse p = project(true);
        timeEntryService.create(new TimeEntryRequest(p.id(), null, "weekly sync",
                Instant.parse("2027-02-01T08:00:00Z"), Instant.parse("2027-02-01T09:00:00Z"), true, Set.of()));

        List<TimeEntryResponse> copied = timesheetService.copyWeek(
                new CopyWeekRequest(LocalDate.of(2027, 2, 3), LocalDate.of(2027, 2, 17)));

        assertThat(copied).anySatisfy(e -> {
            assertThat(e.description()).isEqualTo("weekly sync");
            assertThat(e.startTime()).isEqualTo(Instant.parse("2027-02-15T08:00:00Z"));
            assertThat(e.entryDate()).isEqualTo(LocalDate.of(2027, 2, 15));
        });
    }

    @Test
    void copyWeekRejectsSameWeek() {
        assertThatThrownBy(() -> timesheetService.copyWeek(
                new CopyWeekRequest(LocalDate.of(2027, 2, 1), LocalDate.of(2027, 2, 7))))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
