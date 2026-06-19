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

/**
 * Imports a single Clockify CSV row in its own transaction (REQUIRES_NEW) so that
 * a failing row rolls back only itself and never poisons the surrounding import.
 */
@Component
public class ClockifyRowImporter {

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy")
    );
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
     * @return true if the row produced a time entry, false if it was skipped.
     * @throws RuntimeException if the row could not be imported (rolls this row back).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean importRow(CSVRecord record, ImportCounters counters) {
        ZoneId zone = settingsService.getTimezone();
        String currency = settingsService.getCurrency();

        Instant start = parseInstant(get(record, "Start Date"), get(record, "Start Time"), zone);
        Instant end = parseInstant(get(record, "End Date"), get(record, "End Time"), zone);
        if (start == null || end == null || !end.isAfter(start)) {
            return false;
        }

        UUID clientId = findOrCreateClient(get(record, "Client"), currency, counters);
        UUID projectId = findOrCreateProject(get(record, "Project"), clientId, currency, counters);
        UUID taskId = findOrCreateTask(get(record, "Task"), projectId, counters);
        Set<UUID> tagIds = findOrCreateTags(get(record, "Tags"), counters);
        boolean billable = "Yes".equalsIgnoreCase(get(record, "Billable"));

        timeEntryService.create(new TimeEntryRequest(
                projectId, taskId, get(record, "Description"),
                start, end, billable, tagIds
        ), TimeEntrySource.IMPORT);
        return true;
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

    private Instant parseInstant(String date, String time, ZoneId zone) {
        if (date == null || date.isBlank()) {
            return null;
        }
        LocalDate localDate = parseDate(date);
        LocalTime localTime = (time == null || time.isBlank()) ? LocalTime.MIDNIGHT : parseTime(time);
        if (localDate == null || localTime == null) {
            return null;
        }
        return localDate.atTime(localTime).atZone(zone).toInstant();
    }

    private LocalDate parseDate(String value) {
        for (DateTimeFormatter fmt : DATE_FORMATS) {
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
