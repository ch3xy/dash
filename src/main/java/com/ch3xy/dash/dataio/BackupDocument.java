package com.ch3xy.dash.dataio;

import com.ch3xy.dash.client.ClientResponse;
import com.ch3xy.dash.project.ProjectRateResponse;
import com.ch3xy.dash.project.ProjectResponse;
import com.ch3xy.dash.settings.AppSettingsResponse;
import com.ch3xy.dash.tag.TagResponse;
import com.ch3xy.dash.task.TaskResponse;
import com.ch3xy.dash.timeentry.TimeEntryResponse;

import java.util.List;

/**
 * Full snapshot of all application data, suitable as a local backup artifact.
 */
public record BackupDocument(
        String exportedAt,
        AppSettingsResponse settings,
        List<ClientResponse> clients,
        List<ProjectResponse> projects,
        List<ProjectRateResponse> projectRates,
        List<TaskResponse> tasks,
        List<TagResponse> tags,
        List<TimeEntryResponse> timeEntries
) {}
