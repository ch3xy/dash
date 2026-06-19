package com.ch3xy.dash.report;

import com.ch3xy.dash.settings.AppSettingsService;
import com.ch3xy.dash.timeentry.TimeEntryRepository;
import com.ch3xy.dash.timeentry.TimeEntryResponse;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.StringWriter;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.stream.Collectors;

/**
 * Renders filtered time entries as a CSV document (Excel-compatible).
 */
@Service
@Transactional(readOnly = true)
public class CsvExportService {

    private static final String[] HEADERS = {
            "Date", "Day", "Client", "Project", "Task", "Description",
            "Start", "End", "Duration", "Duration (decimal)", "Billable",
            "Rate", "Currency", "Amount", "Tags"
    };

    private final TimeEntryRepository repository;
    private final AppSettingsService settingsService;

    public CsvExportService(TimeEntryRepository repository, AppSettingsService settingsService) {
        this.repository = repository;
        this.settingsService = settingsService;
    }

    public String export(ReportFilter filter) {
        ReportFilter f = filter;
        var page = repository.findWithFilter(
                idStr(f.projectId()), idStr(f.clientId()), idStr(f.taskId()), idStr(f.tagId()),
                f.from(), f.to(), f.billable(), f.q(), Pageable.unpaged());

        ZoneId zone = settingsService.getTimezone();
        DateTimeFormatter timeFmt = DateTimeFormatter.ofPattern("HH:mm").withZone(zone);

        StringWriter writer = new StringWriter();
        try (CSVPrinter printer = new CSVPrinter(writer, CSVFormat.DEFAULT.builder()
                .setHeader(HEADERS).build())) {
            for (TimeEntryResponse e : page.map(TimeEntryResponse::from).getContent()) {
                printer.printRecord(
                        e.entryDate(),
                        e.entryDate().getDayOfWeek(),
                        nullToEmpty(e.clientName()),
                        e.projectName(),
                        nullToEmpty(e.taskName()),
                        nullToEmpty(e.description()),
                        timeFmt.format(e.startTime()),
                        timeFmt.format(e.endTime()),
                        formatDuration(e.durationSeconds()),
                        decimalHours(e.durationSeconds()),
                        e.billable() ? "Yes" : "No",
                        e.hourlyRateSnapshot() != null ? e.hourlyRateSnapshot().toPlainString() : "",
                        nullToEmpty(e.currencyCodeSnapshot()),
                        e.amountSnapshot() != null ? e.amountSnapshot().toPlainString() : "",
                        e.tags().stream().map(t -> t.name()).collect(Collectors.joining(";"))
                );
            }
        } catch (IOException ex) {
            throw new UncheckedIOException("Failed to render CSV", ex);
        }
        return writer.toString();
    }

    private static String formatDuration(int seconds) {
        Duration d = Duration.ofSeconds(seconds);
        return "%d:%02d".formatted(d.toHours(), d.toMinutesPart());
    }

    private static String decimalHours(int seconds) {
        return BigDecimal.valueOf(seconds)
                .divide(BigDecimal.valueOf(3600), 2, java.math.RoundingMode.HALF_UP)
                .toPlainString();
    }

    private static String nullToEmpty(String s) {
        return s != null ? s : "";
    }

    private static String idStr(java.util.UUID id) {
        return id != null ? id.toString() : null;
    }
}
