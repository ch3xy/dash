package com.ch3xy.dash.task;

import com.ch3xy.dash.project.Project;
import com.ch3xy.dash.project.ProjectRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class TaskService {

    private final TaskRepository taskRepository;
    private final ProjectRepository projectRepository;

    public TaskService(TaskRepository taskRepository, ProjectRepository projectRepository) {
        this.taskRepository = taskRepository;
        this.projectRepository = projectRepository;
    }

    public List<TaskResponse> findByProject(UUID projectId, boolean includeArchived) {
        requireProject(projectId);
        List<Task> tasks = includeArchived
                ? taskRepository.findAllByProjectIdOrderByNameAsc(projectId)
                : taskRepository.findAllByProjectIdAndArchivedFalseOrderByNameAsc(projectId);
        return tasks.stream().map(TaskResponse::from).toList();
    }

    public TaskResponse findById(UUID id) {
        return TaskResponse.from(require(id));
    }

    @Transactional
    public TaskResponse create(UUID projectId, TaskRequest req) {
        Project project = requireProject(projectId);
        if (taskRepository.existsByNameIgnoreCaseAndProjectId(req.name(), projectId)) {
            throw new IllegalStateException("A task named '" + req.name() + "' already exists in this project");
        }
        Task task = new Task();
        task.setProject(project);
        apply(task, req);
        return TaskResponse.from(taskRepository.save(task));
    }

    @Transactional
    public TaskResponse update(UUID id, TaskRequest req) {
        Task task = require(id);
        if (taskRepository.existsByNameIgnoreCaseAndProjectIdExcluding(req.name(), task.getProject().getId(), id)) {
            throw new IllegalStateException("A task named '" + req.name() + "' already exists in this project");
        }
        apply(task, req);
        return TaskResponse.from(taskRepository.save(task));
    }

    @Transactional
    public TaskResponse archive(UUID id) {
        Task task = require(id);
        task.setArchived(true);
        return TaskResponse.from(taskRepository.save(task));
    }

    private void apply(Task task, TaskRequest req) {
        task.setName(req.name());
        task.setDescription(req.description());
        task.setBillableByDefault(req.billableByDefault());
        task.setHourlyRateOverride(req.hourlyRateOverride());
        task.setEstimatedMinutes(req.estimatedMinutes());
    }

    private Task require(UUID id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Task not found: " + id));
    }

    private Project requireProject(UUID projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new EntityNotFoundException("Project not found: " + projectId));
    }
}
