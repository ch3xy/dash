package com.ch3xy.dash.report;

import com.ch3xy.dash.settings.AppSettingsService;
import com.ch3xy.dash.timeentry.TimeEntryResponse;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.StringWriter;
import java.io.UncheckedIOException;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.stream.Collectors;

/**
 * Renders filtered time entries as a CSV document (Excel-compatible).
 */
@Service
public class CsvExportService {

    private final ReportRowFetcher rowFetcher;
    private final AppSettingsService settingsService;

    public CsvExportService(ReportRowFetcher rowFetcher, AppSettingsService settingsService) {
        this.rowFetcher = rowFetcher;
        this.settingsService = settingsService;
    }

    public String export(ReportFilter filter, DurationRounding rounding) {
        ZoneId zone = settingsService.getTimezone();
        DateTimeFormatter timeFmt = DateTimeFormatter.ofPattern("HH:mm").withZone(zone);

        StringWriter writer = new StringWriter();
        try (CSVPrinter printer = new CSVPrinter(writer, CSVFormat.DEFAULT.builder()
                .setHeader(ReportExportColumns.HEADERS).build())) {
            for (TimeEntryResponse e : rowFetcher.fetch(filter)) {
                printer.printRecord(
                        e.entryDate(),
                        e.entryDate().getDayOfWeek(),
                        text(nullToEmpty(e.clientName())),
                        text(e.projectName()),
                        text(nullToEmpty(e.taskName())),
                        text(nullToEmpty(e.description())),
                        timeFmt.format(e.startTime()),
                        timeFmt.format(e.endTime()),
                        ReportExportColumns.formatDuration(rounding.apply(e.durationSeconds())),
                        ReportExportColumns.decimalHours(rounding.apply(e.durationSeconds())),
                        e.billable() ? "Yes" : "No",
                        e.hourlyRateSnapshot() != null ? e.hourlyRateSnapshot().toPlainString() : "",
                        nullToEmpty(e.currencyCodeSnapshot()),
                        e.amountSnapshot() != null ? e.amountSnapshot().toPlainString() : "",
                        text(e.tags().stream().map(t -> t.name()).collect(Collectors.joining(";")))
                );
            }
        } catch (IOException ex) {
            throw new UncheckedIOException("Failed to render CSV", ex);
        }
        return writer.toString();
    }

    /**
     * Free text with a leading quote if it starts like a formula, so spreadsheets
     * show it instead of evaluating it (CSV injection).
     */
    static String text(String s) {
        return !s.isEmpty() && "=+-@\t\r".indexOf(s.charAt(0)) >= 0 ? "'" + s : s;
    }

    private static String nullToEmpty(String s) {
        return s != null ? s : "";
    }
}
