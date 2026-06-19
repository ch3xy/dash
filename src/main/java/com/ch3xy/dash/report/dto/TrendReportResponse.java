package com.ch3xy.dash.report.dto;

import java.math.BigDecimal;
import java.util.List;

public record TrendReportResponse(
        String granularity,
        List<TrendPoint> data
) {
    public record TrendPoint(
            String period,
            long durationSeconds,
            BigDecimal revenueAmount
    ) {}
}
