package com.ch3xy.dash.report;

import com.ch3xy.dash.report.dto.BudgetReportEntry;
import com.ch3xy.dash.report.dto.SummaryReportResponse;
import com.ch3xy.dash.report.dto.SummaryReportResponse.SummaryGroup;
import com.ch3xy.dash.report.dto.TrendReportResponse;
import com.ch3xy.dash.report.dto.TrendReportResponse.TrendPoint;
import com.ch3xy.dash.report.dto.WeeklyReportResponse;
import com.ch3xy.dash.report.dto.WeeklyReportResponse.WeeklyDay;
import com.ch3xy.dash.settings.AppSettingsService;
import com.ch3xy.dash.timeentry.TimeEntry;
import com.ch3xy.dash.timeentry.TimeEntryFilter;
import com.ch3xy.dash.timeentry.TimeEntryRepository;
import com.ch3xy.dash.timeentry.TimeEntryResponse;
import com.ch3xy.dash.timeentry.TimeEntryService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
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
    private final TimeEntryService timeEntryService;
    private final ReportQueryRepository queryRepository;
    private final AppSettingsService settingsService;

    public ReportService(TimeEntryRepository timeEntryRepository,
                         TimeEntryService timeEntryService,
                         ReportQueryRepository queryRepository,
                         AppSettingsService settingsService) {
        this.timeEntryRepository = timeEntryRepository;
        this.timeEntryService = timeEntryService;
        this.queryRepository = queryRepository;
        this.settingsService = settingsService;
    }

    // --- Summary ---------------------------------------------------------

    public SummaryReportResponse getSummary(ReportFilter filter) {
        GroupBy groupBy = filter.groupBy() != null ? filter.groupBy() : GroupBy.PROJECT;
        ReportFilter effective = filter.withGroupBy(groupBy);
        List<SummaryGroup> groups = queryRepository.summaryGrouped(effective);

        long total = groups.stream().mapToLong(SummaryGroup::durationSeconds).sum();
        long billable = groups.stream().mapToLong(SummaryGroup::billableDurationSeconds).sum();
        BigDecimal revenue = groups.stream()
                .map(SummaryGroup::revenueAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        double ratio = total > 0 ? (double) billable / total : 0.0;

        return new SummaryReportResponse(
                total, billable, total - billable, ratio,
                revenue, settingsService.getCurrency(),
                groupBy.name(), groups,
                new SummaryReportResponse.Period(filter.from(), filter.to())
        );
    }

    // --- Detailed --------------------------------------------------------

    public Page<TimeEntryResponse> getDetailed(ReportFilter filter, Pageable pageable) {
        return timeEntryService.findAll(toEntryFilter(filter), pageable);
    }

    // --- Budget ----------------------------------------------------------

    public List<BudgetReportEntry> getBudgetReport() {
        LocalDate today = LocalDate.now(settingsService.getTimezone());
        return queryRepository.budget(today.withDayOfMonth(1), today.withDayOfYear(1));
    }

    // --- Revenue (grouped, sorted by revenue) ----------------------------

    public SummaryReportResponse getRevenue(ReportFilter filter) {
        GroupBy groupBy = filter.groupBy() != null ? filter.groupBy() : GroupBy.CLIENT;
        SummaryReportResponse summary = getSummary(filter.withGroupBy(groupBy));
        List<SummaryGroup> byRevenue = summary.groups().stream()
                .sorted((a, b) -> b.revenueAmount().compareTo(a.revenueAmount()))
                .toList();
        return new SummaryReportResponse(
                summary.totalDurationSeconds(), summary.billableDurationSeconds(),
                summary.nonBillableDurationSeconds(), summary.billableRatio(),
                summary.revenueAmount(), summary.currencyCode(),
                summary.groupedBy(), byRevenue, summary.period()
        );
    }

    // --- Trends ----------------------------------------------------------

    public TrendReportResponse getTrends(ReportFilter filter, GroupBy granularity) {
        GroupBy g = granularity != null ? granularity : GroupBy.DAY;
        List<TrendPoint> data = queryRepository.trend(filter, g);
        return new TrendReportResponse(g.name(), data);
    }

    // --- Weekly timesheet ------------------------------------------------

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

    // --- Helpers ---------------------------------------------------------

    static TimeEntryFilter toEntryFilter(ReportFilter f) {
        return new TimeEntryFilter(
                f.from(), f.to(), f.clientId(), f.projectId(),
                f.taskId(), f.tagId(), f.billable(), f.q()
        );
    }
}
