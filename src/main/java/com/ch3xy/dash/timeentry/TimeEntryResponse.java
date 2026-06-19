package com.ch3xy.dash.timeentry;

import com.ch3xy.dash.client.Client;
import com.ch3xy.dash.project.Project;
import com.ch3xy.dash.tag.TagRef;
import com.ch3xy.dash.task.Task;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public record TimeEntryResponse(
        UUID id,
        UUID projectId, String projectName,
        UUID clientId, String clientName,
        UUID taskId, String taskName,
        String description,
        Instant startTime, Instant endTime,
        int durationSeconds,
        LocalDate entryDate,
        boolean billable,
        BigDecimal hourlyRateSnapshot,
        String currencyCodeSnapshot,
        BigDecimal amountSnapshot,
        TimeEntrySource source,
        List<TagRef> tags,
        Instant createdAt, Instant updatedAt
) {
    public static TimeEntryResponse from(TimeEntry te) {
        Project project = te.getProject();
        Client client = project.getClient();
        Task task = te.getTask();
        List<TagRef> tags = te.getTags().stream()
                .map(TagRef::from)
                .sorted(Comparator.comparing(TagRef::name))
                .toList();
        return new TimeEntryResponse(
                te.getId(),
                project.getId(), project.getName(),
                client != null ? client.getId() : null,
                client != null ? client.getName() : null,
                task != null ? task.getId() : null,
                task != null ? task.getName() : null,
                te.getDescription(),
                te.getStartTime(), te.getEndTime(),
                te.getDurationSeconds(), te.getEntryDate(),
                te.isBillable(),
                te.getHourlyRateSnapshot(), te.getCurrencyCodeSnapshot(), te.getAmountSnapshot(),
                te.getSource(), tags,
                te.getCreatedAt(), te.getUpdatedAt()
        );
    }
}
