package com.ch3xy.dash.timeentry;

import com.ch3xy.dash.project.Project;
import com.ch3xy.dash.project.ProjectRepository;
import com.ch3xy.dash.settings.AppSettingsService;
import com.ch3xy.dash.tag.Tag;
import com.ch3xy.dash.tag.TagRepository;
import com.ch3xy.dash.task.Task;
import com.ch3xy.dash.task.TaskRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class TimeEntryService {

    private static final BigDecimal SECONDS_PER_HOUR = BigDecimal.valueOf(3600);

    private final TimeEntryRepository repository;
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final TagRepository tagRepository;
    private final RateResolverService rateResolver;
    private final AppSettingsService settingsService;

    public TimeEntryService(TimeEntryRepository repository,
                            ProjectRepository projectRepository,
                            TaskRepository taskRepository,
                            TagRepository tagRepository,
                            RateResolverService rateResolver,
                            AppSettingsService settingsService) {
        this.repository = repository;
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.tagRepository = tagRepository;
        this.rateResolver = rateResolver;
        this.settingsService = settingsService;
    }

    public Page<TimeEntryResponse> findAll(TimeEntryFilter filter, Pageable pageable) {
        return repository.findWithFilter(
                filter.projectId(), filter.clientId(), filter.taskId(), filter.tagId(),
                filter.from(), filter.to(), filter.billable(), filter.q(), pageable
        ).map(TimeEntryResponse::from);
    }

    public TimeEntryResponse findById(UUID id) {
        return TimeEntryResponse.from(require(id));
    }

    @Transactional
    public TimeEntryResponse create(TimeEntryRequest req) {
        return create(req, TimeEntrySource.MANUAL);
    }

    @Transactional
    public TimeEntryResponse create(TimeEntryRequest req, TimeEntrySource source) {
        TimeEntry entry = new TimeEntry();
        entry.setSource(source);
        apply(entry, req);
        return TimeEntryResponse.from(repository.save(entry));
    }

    @Transactional
    public TimeEntryResponse update(UUID id, TimeEntryRequest req) {
        TimeEntry entry = require(id);
        apply(entry, req);
        return TimeEntryResponse.from(repository.save(entry));
    }

    @Transactional
    public void delete(UUID id) {
        TimeEntry entry = require(id);
        repository.delete(entry);
    }

    /**
     * Populates an entry from a request: validates the interval, computes derived
     * fields (duration, entry date), resolves the rate snapshot and amount.
     */
    private void apply(TimeEntry entry, TimeEntryRequest req) {
        if (!req.endTime().isAfter(req.startTime())) {
            throw new IllegalArgumentException("endTime must be after startTime");
        }

        Project project = projectRepository.findById(req.projectId())
                .orElseThrow(() -> new EntityNotFoundException("Project not found: " + req.projectId()));

        Task task = null;
        if (req.taskId() != null) {
            task = taskRepository.findById(req.taskId())
                    .orElseThrow(() -> new EntityNotFoundException("Task not found: " + req.taskId()));
            if (!task.getProject().getId().equals(project.getId())) {
                throw new IllegalArgumentException("Task does not belong to the given project");
            }
        }

        long durationSeconds = ChronoUnit.SECONDS.between(req.startTime(), req.endTime());
        entry.setProject(project);
        entry.setTask(task);
        entry.setDescription(req.description());
        entry.setStartTime(req.startTime());
        entry.setEndTime(req.endTime());
        entry.setDurationSeconds((int) durationSeconds);
        entry.setEntryDate(req.endTime().atZone(settingsService.getTimezone()).toLocalDate());
        entry.setBillable(req.billable());
        entry.setTags(resolveTags(req.tagIds()));

        ResolvedRate rate = rateResolver.resolve(project, task, req.startTime());
        entry.setHourlyRateSnapshot(rate.hourlyRate());
        entry.setCurrencyCodeSnapshot(rate.currencyCode());
        entry.setAmountSnapshot(computeAmount(req.billable(), durationSeconds, rate.hourlyRate()));
    }

    private BigDecimal computeAmount(boolean billable, long durationSeconds, BigDecimal hourlyRate) {
        if (!billable || hourlyRate == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal hours = BigDecimal.valueOf(durationSeconds)
                .divide(SECONDS_PER_HOUR, 10, RoundingMode.HALF_UP);
        return hours.multiply(hourlyRate).setScale(2, RoundingMode.HALF_UP);
    }

    private Set<Tag> resolveTags(Set<UUID> tagIds) {
        if (tagIds == null || tagIds.isEmpty()) {
            return new HashSet<>();
        }
        Set<Tag> tags = new HashSet<>(tagRepository.findAllById(tagIds));
        if (tags.size() != tagIds.size()) {
            throw new EntityNotFoundException("One or more tags not found");
        }
        return tags;
    }

    private TimeEntry require(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Time entry not found: " + id));
    }
}
