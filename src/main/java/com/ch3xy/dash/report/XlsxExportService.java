package com.ch3xy.dash.report;

import com.ch3xy.dash.settings.AppSettingsService;
import com.ch3xy.dash.timeentry.TimeEntryResponse;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Renders filtered time entries as an XLSX workbook.
 */
@Service
public class XlsxExportService {

    private final ReportRowFetcher rowFetcher;
    private final AppSettingsService settingsService;

    public XlsxExportService(ReportRowFetcher rowFetcher, AppSettingsService settingsService) {
        this.rowFetcher = rowFetcher;
        this.settingsService = settingsService;
    }

    public byte[] export(ReportFilter filter) {
        ZoneId zone = settingsService.getTimezone();
        DateTimeFormatter timeFmt = DateTimeFormatter.ofPattern("HH:mm").withZone(zone);
        List<TimeEntryResponse> rows = rowFetcher.fetch(filter);

        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Time entries");

            CellStyle headerStyle = workbook.createCellStyle();
            Font bold = workbook.createFont();
            bold.setBold(true);
            headerStyle.setFont(bold);

            Row header = sheet.createRow(0);
            for (int i = 0; i < ReportExportColumns.HEADERS.length; i++) {
                Cell cell = header.createCell(i);
                cell.setCellValue(ReportExportColumns.HEADERS[i]);
                cell.setCellStyle(headerStyle);
            }

            int r = 1;
            for (TimeEntryResponse e : rows) {
                Row row = sheet.createRow(r++);
                int c = 0;
                row.createCell(c++).setCellValue(e.entryDate().toString());
                row.createCell(c++).setCellValue(e.entryDate().getDayOfWeek().toString());
                row.createCell(c++).setCellValue(nullToEmpty(e.clientName()));
                row.createCell(c++).setCellValue(e.projectName());
                row.createCell(c++).setCellValue(nullToEmpty(e.taskName()));
                row.createCell(c++).setCellValue(nullToEmpty(e.description()));
                row.createCell(c++).setCellValue(timeFmt.format(e.startTime()));
                row.createCell(c++).setCellValue(timeFmt.format(e.endTime()));
                row.createCell(c++).setCellValue(ReportExportColumns.formatDuration(e.durationSeconds()));
                row.createCell(c++).setCellValue(Double.parseDouble(ReportExportColumns.decimalHours(e.durationSeconds())));
                row.createCell(c++).setCellValue(e.billable() ? "Yes" : "No");
                row.createCell(c++).setCellValue(e.hourlyRateSnapshot() != null ? e.hourlyRateSnapshot().doubleValue() : 0d);
                row.createCell(c++).setCellValue(nullToEmpty(e.currencyCodeSnapshot()));
                row.createCell(c++).setCellValue(e.amountSnapshot() != null ? e.amountSnapshot().doubleValue() : 0d);
                row.createCell(c).setCellValue(e.tags().stream().map(t -> t.name()).collect(Collectors.joining(";")));
            }

            for (int i = 0; i < ReportExportColumns.HEADERS.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new UncheckedIOException("Failed to render XLSX", ex);
        }
    }

    private static String nullToEmpty(String s) {
        return s != null ? s : "";
    }
}
