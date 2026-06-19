package com.ch3xy.dash.timeentry;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record TimeEntryRequest(
        @NotNull UUID projectId,
        UUID taskId,
        String description,
        @NotNull Instant startTime,
        @NotNull Instant endTime,
        boolean billable,
        Set<UUID> tagIds
) {}
