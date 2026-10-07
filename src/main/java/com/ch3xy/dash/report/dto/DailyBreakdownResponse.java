package com.ch3xy.dash.report.dto;

import java.util.List;

/**
 * Daily project breakdown used by the Clockify-style stacked bar chart.
 * Every day in the requested range is present, even days with no entries
 * (those have totalSeconds=0 and an empty projects list).
 */
public record DailyBreakdownResponse(List<DayEntry> days) {

    public record DayEntry(
            String date,
            long totalSeconds,
            List<ProjectSegment> projects
    ) {}

    /** One project's contribution on a single day. date is YYYY-MM-DD (used internally for grouping). */
    public record ProjectSegment(
            String date,
            String projectId,
            String projectName,
            String projectColor,
            long durationSeconds
    ) {}
}
