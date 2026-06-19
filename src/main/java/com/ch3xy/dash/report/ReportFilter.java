package com.ch3xy.dash.report;

import java.time.LocalDate;
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
    public ReportFilter withGroupBy(GroupBy g) {
        return new ReportFilter(from, to, clientId, projectId, taskId, tagId, billable, q, g);
    }
}
