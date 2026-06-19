package com.ch3xy.dash.timer;

import com.ch3xy.dash.project.Project;
import com.ch3xy.dash.tag.TagRef;
import com.ch3xy.dash.task.Task;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public record TimerResponse(
        UUID id,
        UUID projectId, String projectName,
        UUID taskId, String taskName,
        String description,
        Instant startTime,
        long elapsedSeconds,
        boolean billable,
        List<TagRef> tags
) {
    public static TimerResponse from(RunningTimer timer, Instant now) {
        Project project = timer.getProject();
        Task task = timer.getTask();
        long elapsed = java.time.Duration.between(timer.getStartTime(), now).getSeconds();
        List<TagRef> tags = timer.getTags().stream()
                .map(TagRef::from)
                .sorted(Comparator.comparing(TagRef::name))
                .toList();
        return new TimerResponse(
                timer.getId(),
                project.getId(), project.getName(),
                task != null ? task.getId() : null,
                task != null ? task.getName() : null,
                timer.getDescription(),
                timer.getStartTime(),
                Math.max(0, elapsed),
                timer.isBillable(),
                tags
        );
    }
}
