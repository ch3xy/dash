package com.ch3xy.dash.report;

import com.ch3xy.dash.report.dto.WeeklyReportResponse;
import com.ch3xy.dash.report.dto.WeeklyReportResponse.WeeklyDay;
import com.ch3xy.dash.settings.AppSettingsService;
import com.ch3xy.dash.timeentry.TimeEntry;
import com.ch3xy.dash.timeentry.TimeEntryRepository;
import com.ch3xy.dash.timeentry.TimeEntryResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class ReportService {

    private final TimeEntryRepository timeEntryRepository;
    private final AppSettingsService settingsService;

    public ReportService(TimeEntryRepository timeEntryRepository,
                         AppSettingsService settingsService) {
        this.timeEntryRepository = timeEntryRepository;
        this.settingsService = settingsService;
    }

    /**
     * Weekly timesheet aggregation. The week containing {@code reference} is used,
     * starting on Monday and ending on Sunday. When {@code reference} is null the
     * current week in the application timezone is used.
     */
    public WeeklyReportResponse getWeekly(LocalDate reference) {
        LocalDate effective = reference != null
                ? reference
                : LocalDate.now(settingsService.getTimezone());
        LocalDate weekStart = effective.with(DayOfWeek.MONDAY);
        LocalDate weekEnd = weekStart.plusDays(6);

        List<TimeEntry> entries = timeEntryRepository.findByEntryDateRange(weekStart, weekEnd);
        Map<LocalDate, List<TimeEntry>> byDate = entries.stream()
                .collect(Collectors.groupingBy(TimeEntry::getEntryDate));

        List<WeeklyDay> days = new ArrayList<>(7);
        long weekTotal = 0;
        for (int i = 0; i < 7; i++) {
            LocalDate date = weekStart.plusDays(i);
            List<TimeEntry> dayEntries = byDate.getOrDefault(date, List.of());
            long daySeconds = dayEntries.stream().mapToLong(TimeEntry::getDurationSeconds).sum();
            weekTotal += daySeconds;
            days.add(new WeeklyDay(
                    date,
                    daySeconds,
                    dayEntries.stream().map(TimeEntryResponse::from).toList()
            ));
        }

        return new WeeklyReportResponse(weekStart, weekEnd, days, weekTotal);
    }
}
