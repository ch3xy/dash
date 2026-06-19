package com.ch3xy.dash.task;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TaskResponse(
        UUID id,
        UUID projectId,
        String name,
        String description,
        boolean billableByDefault,
        BigDecimal hourlyRateOverride,
        Integer estimatedMinutes,
        boolean archived,
        Instant createdAt,
        Instant updatedAt
) {
    static TaskResponse from(Task t) {
        return new TaskResponse(
                t.getId(), t.getProject().getId(),
                t.getName(), t.getDescription(),
                t.isBillableByDefault(), t.getHourlyRateOverride(),
                t.getEstimatedMinutes(), t.isArchived(),
                t.getCreatedAt(), t.getUpdatedAt()
        );
    }
}
