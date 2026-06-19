package com.ch3xy.dash.dataio;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.StringReader;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Imports a Clockify "Detailed report" CSV. Each row is imported in its own
 * transaction (see {@link ClockifyRowImporter}) so a malformed row is skipped
 * with a warning rather than aborting the whole import.
 */
@Service
public class ClockifyImportService {

    private final ClockifyRowImporter rowImporter;

    public ClockifyImportService(ClockifyRowImporter rowImporter) {
        this.rowImporter = rowImporter;
    }

    public ImportResult importCsv(String csv) {
        ImportCounters counters = new ImportCounters();
        List<String> warnings = new ArrayList<>();
        int imported = 0;
        int rowNumber = 1;

        CSVFormat format = CSVFormat.DEFAULT.builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreSurroundingSpaces(true)
                .setTrim(true)
                .build();

        try (CSVParser parser = CSVParser.parse(new StringReader(csv), format)) {
            for (CSVRecord record : parser) {
                rowNumber++;
                try {
                    if (rowImporter.importRow(record, counters)) {
                        imported++;
                    } else {
                        warnings.add("Row " + rowNumber + ": skipped (missing or invalid start/end)");
                    }
                } catch (RuntimeException ex) {
                    warnings.add("Row " + rowNumber + ": " + ex.getMessage());
                }
            }
        } catch (IOException ex) {
            throw new UncheckedIOException("Failed to read CSV", ex);
        }

        return new ImportResult(imported, counters.clients, counters.projects,
                counters.tasks, counters.tags, warnings);
    }
}
