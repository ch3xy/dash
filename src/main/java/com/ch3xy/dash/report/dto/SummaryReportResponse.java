package com.ch3xy.dash.report.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record SummaryReportResponse(
        long totalDurationSeconds,
        long billableDurationSeconds,
        long nonBillableDurationSeconds,
        double billableRatio,
        BigDecimal revenueAmount,
        String currencyCode,
        String groupedBy,
        List<SummaryGroup> groups,
        Period period
) {
    public record SummaryGroup(
            String key,
            String label,
            long durationSeconds,
            long billableDurationSeconds,
            BigDecimal revenueAmount
    ) {}

    public record Period(LocalDate from, LocalDate to) {}
}
