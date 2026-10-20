package com.ch3xy.dash.report.dto;

import com.ch3xy.dash.report.dto.DailyBreakdownResponse.DayEntry;
import com.ch3xy.dash.report.dto.SummaryReportResponse.SummaryGroup;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Forecast for the future part of a report range (days after today), filled
 * with the time tracked 52 weeks earlier (same weekday last year), mapped onto today's
 * projects and priced at their current rates. {@code from}/{@code to} and the
 * source range are null when the range has no future part.
 * Groups use the same keys and labels as the summary report, so the client can
 * merge them; days carry one entry per forecast day (stacked bar chart).
 */
public record ForecastResponse(
        LocalDate from,
        LocalDate to,
        LocalDate sourceFrom,
        LocalDate sourceTo,
        long totalDurationSeconds,
        long billableDurationSeconds,
        BigDecimal revenueAmount,
        List<SummaryGroup> groups,
        List<DayEntry> days
) {
    public static ForecastResponse empty() {
        return new ForecastResponse(null, null, null, null, 0, 0,
                BigDecimal.ZERO.setScale(2), List.of(), List.of());
    }
}
