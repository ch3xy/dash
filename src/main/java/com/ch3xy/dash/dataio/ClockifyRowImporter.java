package com.ch3xy.dash.dataio;

import com.ch3xy.dash.client.ClientRequest;
import com.ch3xy.dash.client.ClientResponse;
import com.ch3xy.dash.client.ClientService;
import com.ch3xy.dash.project.BudgetReset;
import com.ch3xy.dash.project.ProjectRequest;
import com.ch3xy.dash.project.ProjectResponse;
import com.ch3xy.dash.project.ProjectService;
import com.ch3xy.dash.settings.AppSettingsService;
import com.ch3xy.dash.tag.TagRequest;
import com.ch3xy.dash.tag.TagResponse;
import com.ch3xy.dash.tag.TagService;
import com.ch3xy.dash.task.TaskRequest;
import com.ch3xy.dash.task.TaskResponse;
import com.ch3xy.dash.task.TaskService;
import com.ch3xy.dash.timeentry.TimeEntryRequest;
import com.ch3xy.dash.timeentry.TimeEntryService;
import com.ch3xy.dash.timeentry.TimeEntrySource;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Imports a single Clockify CSV row in its own transaction (REQUIRES_NEW) so that
 * a failing row rolls back only itself and never poisons the surrounding import.
 */
@Component
public class ClockifyRowImporter {

    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    static final DateTimeFormatter MONTH_FIRST = DateTimeFormatter.ofPattern("MM/dd/yyyy");
    static final DateTimeFormatter DAY_FIRST = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final Pattern SLASH_DATE = Pattern.compile("(\\d{1,2})/(\\d{1,2})/\\d{4}");
    private static final List<DateTimeFormatter> TIME_FORMATS = List.of(
            DateTimeFormatter.ofPattern("HH:mm:ss"),
            DateTimeFormatter.ofPattern("HH:mm"),
            DateTimeFormatter.ofPattern("hh:mm:ss a"),
            DateTimeFormatter.ofPattern("hh:mm a")
    );

    private final ClientService clientService;
    private final ProjectService projectService;
    private final TaskService taskService;
    private final TagService tagService;
    private final TimeEntryService timeEntryService;
    private final AppSettingsService settingsService;

    public ClockifyRowImporter(ClientService clientService,
                               ProjectService projectService,
                               TaskService taskService,
                               TagService tagService,
                               TimeEntryService timeEntryService,
                               AppSettingsService settingsService) {
        this.clientService = clientService;
        this.projectService = projectService;
        this.taskService = taskService;
        this.tagService = tagService;
        this.timeEntryService = timeEntryService;
        this.settingsService = settingsService;
    }

    /**
     * @return whether the row produced a time entry or why it was skipped.
     * @throws RuntimeException if the row could not be imported (rolls this row back).
     */
    /**
     * Decides once per file whether slash dates are {@code MM/dd/yyyy} or {@code dd/MM/yyyy}:
     * a first part above 12 means day first, a second part above 12 means month first.
     * If no value decides it, day first is assumed (European export) and a warning is added.
     */
    static DateTimeFormatter detectSlashDateFormat(List<CSVRecord> records, List<String> warnings) {
        boolean dayFirst = false;
        boolean monthFirst = false;
        boolean anySlash = false;
        for (CSVRecord record : records) {
            for (String column : List.of("Start Date", "End Date")) {
                String value = get(record, column);
                Matcher m = value != null ? SLASH_DATE.matcher(value.trim()) : null;
                if (m == null || !m.matches()) {
                    continue;
                }
                anySlash = true;
                dayFirst |= Integer.parseInt(m.group(1)) > 12;
                monthFirst |= Integer.parseInt(m.group(2)) > 12;
            }
        }
        if (dayFirst && monthFirst) {
            warnings.add("Date format: the file mixes DD/MM and MM/DD dates; read as DD/MM/YYYY");
        } else if (anySlash && !dayFirst && !monthFirst) {
            warnings.add("Date format: ambiguous (no day above 12); read as DD/MM/YYYY");
        }
        return monthFirst && !dayFirst ? MONTH_FIRST : DAY_FIRST;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public RowOutcome importRow(CSVRecord record, ImportCounters counters, DateTimeFormatter slashDateFormat) {
        ZoneId zone = settingsService.getTimezone();
        String currency = settingsService.getCurrency();

        Instant start = parseInstant(get(record, "Start Date"), get(record, "Start Time"), zone, slashDateFormat);
        Instant end = parseInstant(get(record, "End Date"), get(record, "End Time"), zone, slashDateFormat);
        if (start == null || end == null || !end.isAfter(start)) {
            return RowOutcome.INVALID;
        }

        UUID clientId = findOrCreateClient(get(record, "Client"), currency, counters);
        UUID projectId = findOrCreateProject(get(record, "Project"), clientId, currency, counters);
        if (timeEntryService.existsForInterval(projectId, start, end)) {
            return RowOutcome.DUPLICATE;
        }
        UUID taskId = findOrCreateTask(get(record, "Task"), projectId, counters);
        Set<UUID> tagIds = findOrCreateTags(get(record, "Tags"), counters);
        boolean billable = "Yes".equalsIgnoreCase(get(record, "Billable"));

        timeEntryService.create(new TimeEntryRequest(
                projectId, taskId, get(record, "Description"),
                start, end, billable, tagIds
        ), TimeEntrySource.IMPORT);
        return RowOutcome.IMPORTED;
    }

    private UUID findOrCreateClient(String name, String currency, ImportCounters counters) {
        if (name == null || name.isBlank()) {
            return null;
        }
        return clientService.findAll(false).stream()
                .filter(c -> c.name().equalsIgnoreCase(name))
                .map(ClientResponse::id)
                .findFirst()
                .orElseGet(() -> {
                    counters.clients++;
                    return clientService.create(new ClientRequest(name, null, null, null, currency)).id();
                });
    }

    private UUID findOrCreateProject(String name, UUID clientId, String currency, ImportCounters counters) {
        String projectName = (name == null || name.isBlank()) ? "Imported" : name;
        return projectService.findAll(true).stream()
                .filter(p -> p.name().equalsIgnoreCase(projectName) && Objects.equals(p.clientId(), clientId))
                .map(ProjectResponse::id)
                .findFirst()
                .orElseGet(() -> {
                    counters.projects++;
                    return projectService.create(new ProjectRequest(
                            clientId, projectName, null, null, true, null, currency,
                            null, null, BudgetReset.NONE)).id();
                });
    }

    private UUID findOrCreateTask(String name, UUID projectId, ImportCounters counters) {
        if (name == null || name.isBlank()) {
            return null;
        }
        return taskService.findByProject(projectId, true).stream()
                .filter(t -> t.name().equalsIgnoreCase(name))
                .map(TaskResponse::id)
                .findFirst()
                .orElseGet(() -> {
                    counters.tasks++;
                    return taskService.create(projectId, new TaskRequest(name, null, true, null, null)).id();
                });
    }

    private Set<UUID> findOrCreateTags(String raw, ImportCounters counters) {
        Set<UUID> ids = new HashSet<>();
        if (raw == null || raw.isBlank()) {
            return ids;
        }
        List<TagResponse> existing = tagService.findAll(false);
        for (String part : raw.split("[,;]")) {
            String tagName = part.trim();
            if (tagName.isEmpty()) {
                continue;
            }
            UUID id = existing.stream()
                    .filter(t -> t.name().equalsIgnoreCase(tagName))
                    .map(TagResponse::id)
                    .findFirst()
                    .orElseGet(() -> {
                        counters.tags++;
                        return tagService.create(new TagRequest(tagName, null)).id();
                    });
            ids.add(id);
        }
        return ids;
    }

    private Instant parseInstant(String date, String time, ZoneId zone, DateTimeFormatter slashDateFormat) {
        if (date == null || date.isBlank()) {
            return null;
        }
        LocalDate localDate = parseDate(date, slashDateFormat);
        LocalTime localTime = (time == null || time.isBlank()) ? LocalTime.MIDNIGHT : parseTime(time);
        if (localDate == null || localTime == null) {
            return null;
        }
        return localDate.atTime(localTime).atZone(zone).toInstant();
    }

    private LocalDate parseDate(String value, DateTimeFormatter slashDateFormat) {
        for (DateTimeFormatter fmt : List.of(ISO_DATE, slashDateFormat)) {
            try {
                return LocalDate.parse(value, fmt);
            } catch (RuntimeException ignored) {
                // try next format
            }
        }
        return null;
    }

    private LocalTime parseTime(String value) {
        for (DateTimeFormatter fmt : TIME_FORMATS) {
            try {
                return LocalTime.parse(value.toUpperCase(), fmt);
            } catch (RuntimeException ignored) {
                // try next format
            }
        }
        return null;
    }

    private static String get(CSVRecord record, String column) {
        return record.isMapped(column) ? record.get(column) : null;
    }
}
