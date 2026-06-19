package com.ch3xy.dash.timer;

import jakarta.validation.constraints.NotNull;

import java.util.Set;
import java.util.UUID;

public record TimerStartRequest(
        @NotNull UUID projectId,
        UUID taskId,
        String description,
        boolean billable,
        Set<UUID> tagIds
) {}
