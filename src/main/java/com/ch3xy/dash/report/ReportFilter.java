package com.ch3xy.dash.report;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

public record ReportFilter(
        LocalDate from,
        LocalDate to,
        UUID clientId,
        UUID projectId,
        UUID taskId,
        UUID tagId,
        Boolean billable,
        String q,
        GroupBy groupBy
) {
    /** Longest range that per-day reports expand day by day (about ten years). */
    static final long MAX_DAYS = 3660;

    /** Rejects ranges that would make a per-day report loop (and respond) without bound. */
    static void requireDayRange(LocalDate from, LocalDate to) {
        if (to.isBefore(from)) {
            throw new IllegalArgumentException("to: must not be before from");
        }
        if (ChronoUnit.DAYS.between(from, to) >= MAX_DAYS) {
            throw new IllegalArgumentException("to: the range must not exceed " + MAX_DAYS + " days");
        }
    }

    public ReportFilter withGroupBy(GroupBy g) {
        return new ReportFilter(from, to, clientId, projectId, taskId, tagId, billable, q, g);
    }
}
