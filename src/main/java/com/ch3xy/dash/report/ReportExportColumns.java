package com.ch3xy.dash.report;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;

/**
 * Shared column definitions and value formatting for tabular exports (CSV/XLSX).
 */
final class ReportExportColumns {

    static final String[] HEADERS = {
            "Date", "Day", "Client", "Project", "Task", "Description",
            "Start", "End", "Duration", "Duration (decimal)", "Billable",
            "Rate", "Currency", "Amount", "Tags"
    };

    private ReportExportColumns() {}

    static String formatDuration(int seconds) {
        Duration d = Duration.ofSeconds(seconds);
        return "%d:%02d".formatted(d.toHours(), d.toMinutesPart());
    }

    static String decimalHours(int seconds) {
        return BigDecimal.valueOf(seconds)
                .divide(BigDecimal.valueOf(3600), 2, RoundingMode.HALF_UP)
                .toPlainString();
    }
}
