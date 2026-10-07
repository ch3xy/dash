package com.ch3xy.dash.timeentry;

import com.ch3xy.dash.closing.MonthLockService;
import com.ch3xy.dash.project.Project;
import com.ch3xy.dash.project.ProjectRepository;
import com.ch3xy.dash.settings.AppSettingsService;
import com.ch3xy.dash.tag.Tag;
import com.ch3xy.dash.tag.TagRepository;
import com.ch3xy.dash.task.Task;
import com.ch3xy.dash.task.TaskRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

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
    private final NamedParameterJdbcTemplate jdbc;
    private final MonthLockService monthLocks;

    public TimeEntryService(TimeEntryRepository repository,
                            ProjectRepository projectRepository,
                            TaskRepository taskRepository,
                            TagRepository tagRepository,
                            RateResolverService rateResolver,
                            AppSettingsService settingsService,
                            NamedParameterJdbcTemplate jdbc,
                            MonthLockService monthLocks) {
        this.repository = repository;
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.tagRepository = tagRepository;
        this.rateResolver = rateResolver;
        this.settingsService = settingsService;
        this.jdbc = jdbc;
        this.monthLocks = monthLocks;
    }

    /**
     * The most recently used project/task pairings, ordered by last use.
     */
    public List<RecentCombination> recentCombinations(int limit) {
        MapSqlParameterSource params = new MapSqlParameterSource().addValue("limit", limit);
        return jdbc.query("""
                SELECT te.project_id, p.name AS project_name, te.task_id, t.name AS task_name,
                       MAX(te.created_at) AS last_used
                FROM time_entries te
                JOIN projects p ON p.id = te.project_id
                LEFT JOIN tasks t ON t.id = te.task_id
                GROUP BY te.project_id, p.name, te.task_id, t.name
                ORDER BY last_used DESC
                LIMIT :limit
                """, params, (rs, rowNum) -> new RecentCombination(
                rs.getObject("project_id", UUID.class),
                rs.getString("project_name"),
                rs.getObject("task_id", UUID.class),
                rs.getString("task_name")));
    }

    public Page<TimeEntryResponse> findAll(TimeEntryFilter filter, Pageable pageable) {
        // The native filter query has a fixed, deterministic ORDER BY. Any client-supplied
        // Sort would be appended verbatim as column names by Spring Data — a crash and a
        // SQL-injection vector — so we strip it and keep only paging (preserving unpaged).
        Pageable paging = pageable.isPaged()
                ? PageRequest.of(pageable.getPageNumber(), pageable.getPageSize())
                : Pageable.unpaged();
        return repository.findWithFilter(
                idStr(filter.projectId()), idStr(filter.clientId()), idStr(filter.taskId()), idStr(filter.tagId()),
                filter.from(), filter.to(), filter.billable(), filter.q(), paging
        ).map(TimeEntryResponse::from);
    }

    private static String idStr(UUID id) {
        return id != null ? id.toString() : null;
    }

    public TimeEntryResponse findById(UUID id) {
        return TimeEntryResponse.from(require(id));
    }

    /** True if an entry for this project with exactly this interval already exists (import dedup). */
    public boolean existsForInterval(UUID projectId, Instant start, Instant end) {
        return repository.existsByProjectIdAndStartTimeAndEndTime(projectId, start, end);
    }

    @Transactional
    public TimeEntryResponse create(TimeEntryRequest req) {
        return create(req, TimeEntrySource.MANUAL);
    }

    /**
     * Manual and copied entries are rejected on archived projects. TIMER (stopping a
     * timer started before archiving), IMPORT and ADJUSTMENT (split) stay allowed.
     * No source may write into a closed month (Monatsabschluss).
     */
    @Transactional
    public TimeEntryResponse create(TimeEntryRequest req, TimeEntrySource source) {
        TimeEntry entry = new TimeEntry();
        entry.setSource(source);
        apply(entry, req);
        monthLocks.requireOpen(entry.getEntryDate());
        if (source == TimeEntrySource.MANUAL) {
            entry.getProject().requireNotArchived();
        }
        return TimeEntryResponse.from(repository.save(entry));
    }

    /**
     * Creates several manual entries in one transaction (timesheet bulk entry).
     * Either all entries are persisted or none are.
     */
    @Transactional
    public List<TimeEntryResponse> createAll(List<TimeEntryRequest> requests) {
        List<TimeEntryResponse> created = new ArrayList<>(requests.size());
        for (TimeEntryRequest req : requests) {
            created.add(create(req, TimeEntrySource.MANUAL));
        }
        return created;
    }

    @Transactional
    public TimeEntryResponse update(UUID id, TimeEntryRequest req) {
        TimeEntry entry = require(id);
        monthLocks.requireOpen(entry.getEntryDate());
        UUID previousProjectId = entry.getProject().getId();
        apply(entry, req);
        monthLocks.requireOpen(entry.getEntryDate());
        // Editing an entry of an archived project is fine; moving time onto one is not.
        if (!entry.getProject().getId().equals(previousProjectId)) {
            entry.getProject().requireNotArchived();
        }
        return TimeEntryResponse.from(repository.save(entry));
    }

    @Transactional
    public void delete(UUID id) {
        TimeEntry entry = require(id);
        monthLocks.requireOpen(entry.getEntryDate());
        repository.delete(entry);
    }

    @Transactional
    public void deleteAll(List<UUID> ids) {
        List<TimeEntry> entries = repository.findAllById(ids);
        if (entries.size() != new HashSet<>(ids).size()) {
            throw new EntityNotFoundException("One or more time entries not found");
        }
        requireOpen(entries);
        repository.deleteAll(entries);
    }

    // Shared WHERE clause for criteria-based deletion; expects `te` (time_entries) and `p` (projects).
    private static final String CRITERIA_WHERE = """
            p.id = te.project_id
              AND (CAST(:projectId AS uuid) IS NULL OR te.project_id = CAST(:projectId AS uuid))
              AND (CAST(:clientId AS uuid) IS NULL OR p.client_id = CAST(:clientId AS uuid))
              AND (CAST(:from AS date) IS NULL OR te.entry_date >= CAST(:from AS date))
              AND (CAST(:to AS date) IS NULL OR te.entry_date <= CAST(:to AS date))
            """;

    public DeletePreview previewDelete(DeleteCriteria criteria) {
        requireCriteria(criteria);
        return jdbc.queryForObject("""
                SELECT count(*) AS cnt, COALESCE(SUM(te.duration_seconds), 0) AS total,
                       count(*) FILTER (WHERE EXISTS (
                           SELECT 1 FROM month_locks ml
                           WHERE ml.month = CAST(date_trunc('month', te.entry_date) AS date))) AS locked
                FROM time_entries te, projects p
                WHERE
                """ + CRITERIA_WHERE,
                criteriaParams(criteria),
                (rs, rowNum) -> new DeletePreview(rs.getInt("cnt"), rs.getLong("total"), rs.getInt("locked")));
    }

    /**
     * Deletes all entries matching the criteria. The caller passes the count it
     * confirmed in the preview; if the data changed in between, nothing is deleted.
     */
    @Transactional
    public int deleteByCriteria(DeleteCriteria criteria, int expectedCount) {
        DeletePreview preview = previewDelete(criteria);
        if (preview.lockedCount() > 0) {
            throw new IllegalStateException(preview.lockedCount()
                    + " der Einträge liegen in abgeschlossenen Monaten – es wurde nichts gelöscht");
        }
        int actual = preview.count();
        if (actual != expectedCount) {
            throw new IllegalStateException(
                    "Expected " + expectedCount + " entries but " + actual + " match; nothing was deleted");
        }
        return jdbc.update("DELETE FROM time_entries te USING projects p WHERE " + CRITERIA_WHERE,
                criteriaParams(criteria));
    }

    private static void requireCriteria(DeleteCriteria criteria) {
        if (criteria.isEmpty()) {
            throw new IllegalArgumentException("At least one criterion (date, project or client) is required");
        }
        if (criteria.from() != null && criteria.to() != null && criteria.to().isBefore(criteria.from())) {
            throw new IllegalArgumentException("'to' must not be before 'from'");
        }
    }

    private static MapSqlParameterSource criteriaParams(DeleteCriteria c) {
        return new MapSqlParameterSource()
                .addValue("projectId", idStr(c.projectId()), Types.VARCHAR)
                .addValue("clientId", idStr(c.clientId()), Types.VARCHAR)
                .addValue("from", c.from(), Types.DATE)
                .addValue("to", c.to(), Types.DATE);
    }

    /**
     * Applies the set fields of the request to all given entries. Changing the
     * billable flag recomputes the amount from the stored rate snapshot, so the
     * historical rate stays intact.
     */
    @Transactional
    public List<TimeEntryResponse> bulkUpdate(BulkUpdateRequest req) {
        List<TimeEntry> entries = repository.findAllById(req.ids());
        if (entries.size() != new HashSet<>(req.ids()).size()) {
            throw new EntityNotFoundException("One or more time entries not found");
        }
        requireOpen(entries);
        Set<Tag> tagsToAdd = req.addTagIds() != null && !req.addTagIds().isEmpty()
                ? resolveTags(req.addTagIds()) : Set.of();
        Set<UUID> tagIdsToRemove = req.removeTagIds() != null ? req.removeTagIds() : Set.of();
        for (TimeEntry entry : entries) {
            if (req.billable() != null) {
                entry.setBillable(req.billable());
                entry.setAmountSnapshot(computeAmount(req.billable(),
                        entry.getDurationSeconds(), entry.getHourlyRateSnapshot()));
            }
            entry.getTags().addAll(tagsToAdd);
            entry.getTags().removeIf(t -> tagIdsToRemove.contains(t.getId()));
        }
        return repository.saveAll(entries).stream().map(TimeEntryResponse::from).toList();
    }

    @Transactional
    public List<TimeEntryResponse> split(UUID id, Instant splitAt) {
        TimeEntry original = require(id);
        if (!splitAt.isAfter(original.getStartTime()) || !splitAt.isBefore(original.getEndTime())) {
            throw new IllegalArgumentException("splitAt must be strictly between startTime and endTime");
        }
        monthLocks.requireOpen(original.getEntryDate());
        Set<UUID> tagIds = original.getTags().stream().map(Tag::getId).collect(Collectors.toSet());
        UUID projectId = original.getProject().getId();
        UUID taskId = original.getTask() != null ? original.getTask().getId() : null;
        TimeEntryRequest req1 = new TimeEntryRequest(projectId, taskId, original.getDescription(),
                original.getStartTime(), splitAt, original.isBillable(), tagIds);
        TimeEntryRequest req2 = new TimeEntryRequest(projectId, taskId, original.getDescription(),
                splitAt, original.getEndTime(), original.isBillable(), tagIds);
        repository.delete(original);
        repository.flush();
        return List.of(create(req1, TimeEntrySource.ADJUSTMENT), create(req2, TimeEntrySource.ADJUSTMENT));
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

    private void requireOpen(List<TimeEntry> entries) {
        entries.stream().map(TimeEntry::getEntryDate).distinct().forEach(monthLocks::requireOpen);
    }

    private TimeEntry require(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Time entry not found: " + id));
    }
}
