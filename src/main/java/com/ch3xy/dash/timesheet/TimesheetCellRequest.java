package com.ch3xy.dash.timesheet;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Target total for one timesheet cell (project/task on a day). The existing
 * entries of that cell are extended or trimmed until their sum matches.
 */
public record TimesheetCellRequest(
        @NotNull UUID projectId,
        UUID taskId,
        @NotNull LocalDate date,
        @NotNull @Min(0) @Max(86_400) Integer durationSeconds
) {}
