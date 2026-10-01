package com.ch3xy.dash.timesheet;

import com.ch3xy.dash.project.Project;
import com.ch3xy.dash.project.ProjectRepository;
import com.ch3xy.dash.settings.AppSettingsService;
import com.ch3xy.dash.tag.Tag;
import com.ch3xy.dash.task.Task;
import com.ch3xy.dash.task.TaskRepository;
import com.ch3xy.dash.timeentry.TimeEntry;
import com.ch3xy.dash.timeentry.TimeEntryRepository;
import com.ch3xy.dash.timeentry.TimeEntryRequest;
import com.ch3xy.dash.timeentry.TimeEntryResponse;
import com.ch3xy.dash.timeentry.TimeEntryService;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Timesheet editing on top of regular time entries. A cell is the sum of all
 * entries of one project/task on one day; setting a cell value appends or trims
 * entries instead of storing a separate aggregate.
 */
@Service
@Transactional(readOnly = true)
public class TimesheetService {

    /** New entries on an otherwise empty day start here (app timezone). */
    static final LocalTime DEFAULT_DAY_START = LocalTime.of(9, 0);

    private final TimeEntryRepository entryRepository;
    private final TimeEntryService entryService;
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final AppSettingsService settingsService;

    public TimesheetService(TimeEntryRepository entryRepository,
                            TimeEntryService entryService,
                            ProjectRepository projectRepository,
                            TaskRepository taskRepository,
                            AppSettingsService settingsService) {
        this.entryRepository = entryRepository;
        this.entryService = entryService;
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.settingsService = settingsService;
    }

    /**
     * Sets the tracked time of a cell. Increasing appends one entry after the
     * day's last entry; decreasing trims the cell's latest entries from the end
     * and deletes those that would shrink to zero.
     */
    @Transactional
    public void setCell(TimesheetCellRequest req) {
        Project project = projectRepository.findById(req.projectId())
                .orElseThrow(() -> new EntityNotFoundException("Project not found: " + req.projectId()));
        Task task = null;
        if (req.taskId() != null) {
            task = taskRepository.findById(req.taskId())
                    .orElseThrow(() -> new EntityNotFoundException("Task not found: " + req.taskId()));
            if (!task.getProject().getId().equals(project.getId())) {
                throw new IllegalArgumentException("Task does not belong to project");
            }
        }

        List<TimeEntry> dayEntries = entryRepository.findByEntryDateRange(req.date(), req.date());
        List<TimeEntry> cell = dayEntries.stream()
                .filter(e -> e.getProject().getId().equals(req.projectId()))
                .filter(e -> Objects.equals(taskId(e), req.taskId()))
                .toList();
        long current = cell.stream().mapToLong(TimeEntry::getDurationSeconds).sum();
        long target = req.durationSeconds();

        if (target > current) {
            Instant start = dayEntries.stream()
                    .map(TimeEntry::getEndTime)
                    .max(Comparator.naturalOrder())
                    .orElseGet(() -> req.date().atTime(DEFAULT_DAY_START).atZone(zone()).toInstant());
            boolean billable = task != null ? task.isBillableByDefault() : project.isBillableByDefault();
            entryService.create(new TimeEntryRequest(project.getId(), req.taskId(), null,
                    start, start.plusSeconds(target - current), billable, null));
        } else if (target < current) {
            trim(cell, current - target);
        }
    }

    private void trim(List<TimeEntry> cell, long seconds) {
        List<TimeEntry> latestFirst = cell.stream()
                .sorted(Comparator.comparing(TimeEntry::getEndTime).reversed())
                .toList();
        long remaining = seconds;
        for (TimeEntry e : latestFirst) {
            if (remaining <= 0) {
                break;
            }
            if (e.getDurationSeconds() <= remaining) {
                remaining -= e.getDurationSeconds();
                entryService.delete(e.getId());
            } else {
                entryService.update(e.getId(), new TimeEntryRequest(
                        e.getProject().getId(), taskId(e), e.getDescription(),
                        e.getStartTime(), e.getEndTime().minusSeconds(remaining), e.isBillable(), tagIds(e)));
                remaining = 0;
            }
        }
    }

    /**
     * Copies every entry of the source week into the target week, shifted by whole
     * weeks. Rates are resolved anew for the copied dates.
     */
    @Transactional
    public List<TimeEntryResponse> copyWeek(CopyWeekRequest req) {
        LocalDate sourceStart = req.source().with(DayOfWeek.MONDAY);
        LocalDate targetStart = req.target().with(DayOfWeek.MONDAY);
        if (sourceStart.equals(targetStart)) {
            throw new IllegalArgumentException("Source and target week must differ");
        }
        long days = ChronoUnit.DAYS.between(sourceStart, targetStart);
        List<TimeEntryRequest> copies = new ArrayList<>();
        for (TimeEntry e : entryRepository.findByEntryDateRange(sourceStart, sourceStart.plusDays(6))) {
            copies.add(new TimeEntryRequest(
                    e.getProject().getId(), taskId(e), e.getDescription(),
                    shift(e.getStartTime(), days), shift(e.getEndTime(), days), e.isBillable(), tagIds(e)));
        }
        return entryService.createAll(copies);
    }

    /** Shifts by calendar days in the app timezone so local times survive DST changes. */
    private Instant shift(Instant instant, long days) {
        return instant.atZone(zone()).plusDays(days).toInstant();
    }

    private ZoneId zone() {
        return settingsService.getTimezone();
    }

    private static UUID taskId(TimeEntry e) {
        return e.getTask() != null ? e.getTask().getId() : null;
    }

    private static java.util.Set<UUID> tagIds(TimeEntry e) {
        return e.getTags().stream().map(Tag::getId).collect(Collectors.toSet());
    }
}
