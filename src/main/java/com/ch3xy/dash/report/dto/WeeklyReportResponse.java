package com.ch3xy.dash.report.dto;

import com.ch3xy.dash.timeentry.TimeEntryResponse;

import java.time.LocalDate;
import java.util.List;

public record WeeklyReportResponse(
        LocalDate weekStart,
        LocalDate weekEnd,
        List<WeeklyDay> days,
        long weekTotalSeconds
) {
    public record WeeklyDay(
            LocalDate date,
            long totalSeconds,
            List<TimeEntryResponse> entries
    ) {}
}
