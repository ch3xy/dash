package com.ch3xy.dash.dataio;

import com.ch3xy.dash.client.ClientResponse;
import com.ch3xy.dash.client.ClientService;
import com.ch3xy.dash.project.ProjectRateResponse;
import com.ch3xy.dash.project.ProjectResponse;
import com.ch3xy.dash.project.ProjectService;
import com.ch3xy.dash.settings.AppSettingsService;
import com.ch3xy.dash.tag.TagService;
import com.ch3xy.dash.task.TaskResponse;
import com.ch3xy.dash.task.TaskService;
import com.ch3xy.dash.timeentry.TimeEntryFilter;
import com.ch3xy.dash.timeentry.TimeEntryResponse;
import com.ch3xy.dash.timeentry.TimeEntryService;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Assembles a full export of all application data for local backup.
 */
@Service
public class BackupService {

    private final AppSettingsService settingsService;
    private final ClientService clientService;
    private final ProjectService projectService;
    private final TaskService taskService;
    private final TagService tagService;
    private final TimeEntryService timeEntryService;

    public BackupService(AppSettingsService settingsService,
                         ClientService clientService,
                         ProjectService projectService,
                         TaskService taskService,
                         TagService tagService,
                         TimeEntryService timeEntryService) {
        this.settingsService = settingsService;
        this.clientService = clientService;
        this.projectService = projectService;
        this.taskService = taskService;
        this.tagService = tagService;
        this.timeEntryService = timeEntryService;
    }

    @Transactional(readOnly = true)
    public BackupDocument export() {
        List<ProjectResponse> projects = projectService.findAll(true);

        List<ProjectRateResponse> rates = new ArrayList<>();
        List<TaskResponse> tasks = new ArrayList<>();
        for (ProjectResponse project : projects) {
            rates.addAll(projectService.getRates(project.id()));
            tasks.addAll(taskService.findByProject(project.id(), true));
        }

        List<ClientResponse> clients = clientService.findAll(true);
        List<TimeEntryResponse> timeEntries = timeEntryService
                .findAll(emptyFilter(), Pageable.unpaged())
                .getContent();

        return new BackupDocument(
                Instant.now().toString(),
                settingsService.getAll(),
                clients,
                projects,
                rates,
                tasks,
                tagService.findAll(true),
                timeEntries
        );
    }

    private static TimeEntryFilter emptyFilter() {
        return new TimeEntryFilter(null, null, null, null, null, null, null, null);
    }
}
