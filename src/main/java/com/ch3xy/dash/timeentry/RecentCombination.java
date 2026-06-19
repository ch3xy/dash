package com.ch3xy.dash.timeentry;

import java.util.UUID;

/**
 * A recently used project/task pairing, surfaced to speed up timer/manual entry.
 */
public record RecentCombination(
        UUID projectId,
        String projectName,
        UUID taskId,
        String taskName
) {}
