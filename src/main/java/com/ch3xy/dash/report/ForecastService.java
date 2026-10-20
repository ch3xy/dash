package com.ch3xy.dash.report;

import com.ch3xy.dash.project.Project;
import com.ch3xy.dash.project.ProjectRepository;
import com.ch3xy.dash.report.ReportQueryRepository.ForecastSourceRow;
import com.ch3xy.dash.report.dto.DailyBreakdownResponse.DayEntry;
import com.ch3xy.dash.report.dto.DailyBreakdownResponse.ProjectSegment;
import com.ch3xy.dash.report.dto.ForecastResponse;
import com.ch3xy.dash.report.dto.SummaryReportResponse.SummaryGroup;
import com.ch3xy.dash.settings.AppSettingsService;
import com.ch3xy.dash.settings.RoundingRule;
import com.ch3xy.dash.timeentry.RateResolverService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Forecast for the not-yet-elapsed part of a report range. Every future day is
 * filled with what was tracked 52 weeks earlier, i.e. on the same weekday of last year:
 * <ul>
 *   <li>a source project that is still active keeps its time;</li>
 *   <li>time of an archived project goes to the client's current project
 *       (see {@link ReportQueryRepository#currentProjectByClient});</li>
 *   <li>time without a current target project (client gone, no active project) is dropped.</li>
 * </ul>
 * Revenue uses the target project's current rate, so last year's hours are priced
 * as if worked today. Tasks are not mapped, the task filter therefore yields no forecast.
 */
@Service
@Transactional(readOnly = true)
public class ForecastService {

    private static final BigDecimal SECONDS_PER_HOUR = BigDecimal.valueOf(3600);
    /** Window used to decide which project of a client is the "current" one. */
    private static final int CURRENT_PROJECT_WINDOW_DAYS = 90;
    /** Offset to the source day; whole weeks keep weekends on weekends. */
    private static final int SOURCE_OFFSET_WEEKS = 52;

    private final ReportQueryRepository queryRepository;
    private final ProjectRepository projectRepository;
    private final RateResolverService rateResolver;
    private final AppSettingsService settingsService;
    private final Clock clock;

    public ForecastService(ReportQueryRepository queryRepository,
                           ProjectRepository projectRepository,
                           RateResolverService rateResolver,
                           AppSettingsService settingsService,
                           Clock clock) {
        this.queryRepository = queryRepository;
        this.projectRepository = projectRepository;
        this.rateResolver = rateResolver;
        this.settingsService = settingsService;
        this.clock = clock;
    }

    public ForecastResponse getForecast(ReportFilter filter, boolean rounded) {
        return getForecast(filter, rounded, LocalDate.now(clock.withZone(settingsService.getTimezone())));
    }

    ForecastResponse getForecast(ReportFilter filter, boolean rounded, LocalDate today) {
        if (filter.to() == null || !filter.to().isAfter(today)) {
            return ForecastResponse.empty();
        }
        LocalDate from = filter.from() != null && filter.from().isAfter(today) ? filter.from() : today.plusDays(1);
        LocalDate to = filter.to();
        LocalDate sourceFrom = from.minusWeeks(SOURCE_OFFSET_WEEKS);
        LocalDate sourceTo = to.minusWeeks(SOURCE_OFFSET_WEEKS);
        GroupBy groupBy = filter.groupBy() != null ? filter.groupBy() : GroupBy.PROJECT;

        if (filter.taskId() != null) {
            return new ForecastResponse(from, to, sourceFrom, sourceTo, 0, 0,
                    BigDecimal.ZERO.setScale(2), List.of(), emptyDays(from, to));
        }

        RoundingRule rule = rounded ? settingsService.getRoundingRule() : RoundingRule.NONE;
        int minutes = rounded ? settingsService.getRoundingMinutes() : 0;
        ReportFilter source = new ReportFilter(sourceFrom, sourceTo, filter.clientId(), null, null,
                filter.tagId(), filter.billable(), filter.q(), groupBy);

        Map<UUID, UUID> currentByClient = queryRepository.currentProjectByClient(
                today.minusDays(CURRENT_PROJECT_WINDOW_DAYS));
        List<Mapped> rows = map(queryRepository.forecastSourceRows(source, rule, minutes, false),
                currentByClient, filter.projectId(), from, to);
        // Grouping by tag counts an entry once per tag, so tag groups come from a
        // separate query and never feed the totals or the daily bars.
        List<Mapped> groupRows = groupBy == GroupBy.TAG
                ? map(queryRepository.forecastSourceRows(source, rule, minutes, true),
                        currentByClient, filter.projectId(), from, to)
                : rows;

        Map<UUID, Project> projects = projectRepository.findAllById(
                        rows.stream().map(Mapped::projectId).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(Project::getId, Function.identity()));
        Instant now = clock.instant();
        Map<UUID, BigDecimal> rates = new HashMap<>();
        projects.values().forEach(p -> rates.put(p.getId(), rateResolver.resolve(p, null, now).hourlyRate()));

        long total = 0;
        long billable = 0;
        BigDecimal revenue = BigDecimal.ZERO;
        for (Mapped r : rows) {
            total += r.seconds();
            if (r.billable()) billable += r.seconds();
            revenue = revenue.add(amount(r, rates));
        }

        return new ForecastResponse(from, to, sourceFrom, sourceTo, total, billable,
                revenue.setScale(2, RoundingMode.HALF_UP),
                groups(groupRows, groupBy, projects, rates),
                days(rows, from, to, projects));
    }

    /** A source row moved to its forecast date and target project. */
    private record Mapped(LocalDate day, UUID projectId, UUID clientId, String clientLabel,
                          boolean billable, String tagKey, String tagLabel, long seconds) {}

    private List<Mapped> map(List<ForecastSourceRow> source, Map<UUID, UUID> currentByClient,
                             UUID projectFilter, LocalDate from, LocalDate to) {
        List<Mapped> out = new ArrayList<>();
        for (ForecastSourceRow r : source) {
            UUID target = "ACTIVE".equals(r.projectStatus()) ? r.projectId()
                    : r.clientId() != null ? currentByClient.get(r.clientId()) : null;
            if (target == null || (projectFilter != null && !projectFilter.equals(target))) continue;
            LocalDate day = r.day().plusWeeks(SOURCE_OFFSET_WEEKS);
            out.add(new Mapped(day, target, r.clientId(), r.clientLabel(), r.billable(),
                    r.tagKey(), r.tagLabel(), r.seconds()));
        }
        return out;
    }

    private BigDecimal amount(Mapped r, Map<UUID, BigDecimal> rates) {
        BigDecimal rate = rates.get(r.projectId());
        if (!r.billable() || rate == null) return BigDecimal.ZERO;
        return BigDecimal.valueOf(r.seconds())
                .divide(SECONDS_PER_HOUR, 10, RoundingMode.HALF_UP)
                .multiply(rate);
    }

    /** Groups with the same keys and labels as {@link ReportQueryRepository#summaryGrouped}. */
    private List<SummaryGroup> groups(List<Mapped> rows, GroupBy groupBy,
                                      Map<UUID, Project> projects, Map<UUID, BigDecimal> rates) {
        Map<String, String> labels = new LinkedHashMap<>();
        Map<String, long[]> seconds = new HashMap<>();
        Map<String, BigDecimal> revenue = new HashMap<>();
        for (Mapped r : rows) {
            String key;
            String label;
            switch (groupBy) {
                case PROJECT -> {
                    key = r.projectId().toString();
                    label = projects.get(r.projectId()).getName();
                }
                case CLIENT -> {
                    key = r.clientId() != null ? r.clientId().toString() : null;
                    label = r.clientLabel();
                }
                case TASK -> {
                    key = null;
                    label = "No task";
                }
                case TAG -> {
                    key = r.tagKey();
                    label = r.tagLabel();
                }
                case DAY -> key = label = r.day().toString();
                case WEEK -> key = label = r.day().with(DayOfWeek.MONDAY).toString();
                case MONTH -> key = label = r.day().toString().substring(0, 7);
                default -> throw new IllegalStateException();
            }
            labels.putIfAbsent(key, label);
            long[] s = seconds.computeIfAbsent(key, k -> new long[2]);
            s[0] += r.seconds();
            if (r.billable()) s[1] += r.seconds();
            revenue.merge(key, amount(r, rates), BigDecimal::add);
        }
        return labels.entrySet().stream()
                .map(e -> new SummaryGroup(e.getKey(), e.getValue(),
                        seconds.get(e.getKey())[0], seconds.get(e.getKey())[1],
                        revenue.get(e.getKey()).setScale(2, RoundingMode.HALF_UP)))
                .sorted(Comparator.comparingLong(SummaryGroup::durationSeconds).reversed())
                .toList();
    }

    private List<DayEntry> days(List<Mapped> rows, LocalDate from, LocalDate to, Map<UUID, Project> projects) {
        Map<LocalDate, Map<UUID, Long>> byDay = new HashMap<>();
        for (Mapped r : rows) {
            byDay.computeIfAbsent(r.day(), d -> new HashMap<>()).merge(r.projectId(), r.seconds(), Long::sum);
        }
        List<DayEntry> days = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            String date = d.toString();
            List<ProjectSegment> segs = byDay.getOrDefault(d, Map.of()).entrySet().stream()
                    .map(e -> {
                        Project p = projects.get(e.getKey());
                        return new ProjectSegment(date, e.getKey().toString(), p.getName(), p.getColor(), e.getValue());
                    })
                    .sorted(Comparator.comparingLong(ProjectSegment::durationSeconds).reversed())
                    .toList();
            days.add(new DayEntry(date, segs.stream().mapToLong(ProjectSegment::durationSeconds).sum(), segs));
        }
        return days;
    }

    private List<DayEntry> emptyDays(LocalDate from, LocalDate to) {
        return days(List.of(), from, to, Map.of());
    }
}
