package com.ch3xy.dash.timer;

import com.ch3xy.dash.project.Project;
import com.ch3xy.dash.project.ProjectRepository;
import com.ch3xy.dash.tag.Tag;
import com.ch3xy.dash.tag.TagRepository;
import com.ch3xy.dash.task.Task;
import com.ch3xy.dash.task.TaskRepository;
import com.ch3xy.dash.timeentry.TimeEntry;
import com.ch3xy.dash.timeentry.TimeEntryRepository;
import com.ch3xy.dash.timeentry.TimeEntryRequest;
import com.ch3xy.dash.timeentry.TimeEntryResponse;
import com.ch3xy.dash.timeentry.TimeEntryService;
import com.ch3xy.dash.timeentry.TimeEntrySource;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class TimerService {

    private final RunningTimerRepository timerRepository;
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final TagRepository tagRepository;
    private final TimeEntryService timeEntryService;
    private final TimeEntryRepository timeEntryRepository;
    private final Clock clock;

    public TimerService(RunningTimerRepository timerRepository,
                        ProjectRepository projectRepository,
                        TaskRepository taskRepository,
                        TagRepository tagRepository,
                        TimeEntryService timeEntryService,
                        TimeEntryRepository timeEntryRepository,
                        Clock clock) {
        this.timerRepository = timerRepository;
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
        this.tagRepository = tagRepository;
        this.timeEntryService = timeEntryService;
        this.timeEntryRepository = timeEntryRepository;
        this.clock = clock;
    }

    public TimerResponse getCurrent() {
        RunningTimer timer = currentOrThrow();
        return TimerResponse.from(timer, clock.instant());
    }

    @Transactional
    public TimerResponse start(TimerStartRequest req) {
        requireNoRunningTimer();
        Project project = requireProject(req.projectId());
        Task task = resolveTask(req.taskId(), project);

        RunningTimer timer = new RunningTimer();
        timer.setProject(project);
        timer.setTask(task);
        timer.setDescription(req.description());
        timer.setStartTime(clock.instant());
        timer.setBillable(req.billable());
        timer.setTags(resolveTags(req.tagIds()));
        return TimerResponse.from(timerRepository.save(timer), clock.instant());
    }

    @Transactional
    public TimeEntryResponse stop(TimerStopRequest req) {
        RunningTimer timer = currentOrThrow();
        Instant now = clock.instant();

        String description = req != null && req.description() != null
                ? req.description()
                : timer.getDescription();

        Set<UUID> tagIds = timer.getTags().stream().map(Tag::getId).collect(Collectors.toSet());
        TimeEntryRequest entryReq = new TimeEntryRequest(
                timer.getProject().getId(),
                timer.getTask() != null ? timer.getTask().getId() : null,
                description,
                timer.getStartTime(),
                now,
                timer.isBillable(),
                tagIds
        );

        TimeEntryResponse created = timeEntryService.create(entryReq, TimeEntrySource.TIMER);
        timerRepository.delete(timer);
        return created;
    }

    @Transactional
    public void discard() {
        RunningTimer timer = currentOrThrow();
        timerRepository.delete(timer);
    }

    @Transactional
    public TimerResponse update(TimerUpdateRequest req) {
        RunningTimer timer = currentOrThrow();
        if (req.projectId() != null) {
            timer.setProject(requireProject(req.projectId()));
        }
        if (req.taskId() != null) {
            timer.setTask(resolveTask(req.taskId(), timer.getProject()));
        }
        if (req.description() != null) {
            timer.setDescription(req.description());
        }
        if (req.billable() != null) {
            timer.setBillable(req.billable());
        }
        if (req.tagIds() != null) {
            timer.setTags(resolveTags(req.tagIds()));
        }
        return TimerResponse.from(timerRepository.save(timer), clock.instant());
    }

    @Transactional
    public TimerResponse continueFrom(UUID timeEntryId) {
        TimeEntry entry = timeEntryRepository.findById(timeEntryId)
                .orElseThrow(() -> new EntityNotFoundException("Time entry not found: " + timeEntryId));
        Set<UUID> tagIds = entry.getTags().stream().map(Tag::getId).collect(Collectors.toSet());
        TimerStartRequest req = new TimerStartRequest(
                entry.getProject().getId(),
                entry.getTask() != null ? entry.getTask().getId() : null,
                entry.getDescription(),
                entry.isBillable(),
                tagIds
        );
        return start(req);
    }

    private RunningTimer currentOrThrow() {
        return timerRepository.findFirstByOrderByStartTimeAsc()
                .orElseThrow(() -> new EntityNotFoundException("No running timer"));
    }

    private void requireNoRunningTimer() {
        if (timerRepository.count() > 0) {
            throw new IllegalStateException("A timer is already running; stop it before starting a new one");
        }
    }

    private Project requireProject(UUID projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new EntityNotFoundException("Project not found: " + projectId));
    }

    private Task resolveTask(UUID taskId, Project project) {
        if (taskId == null) {
            return null;
        }
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task not found: " + taskId));
        if (!task.getProject().getId().equals(project.getId())) {
            throw new IllegalArgumentException("Task does not belong to the given project");
        }
        return task;
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
}
