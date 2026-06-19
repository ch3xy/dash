package com.ch3xy.dash.timer;

import java.util.Set;
import java.util.UUID;

public record TimerUpdateRequest(
        UUID projectId,
        UUID taskId,
        String description,
        Boolean billable,
        Set<UUID> tagIds
) {}
