package com.ch3xy.dash.timeentry;

import java.time.LocalDate;
import java.util.UUID;

public record TimeEntryFilter(
        LocalDate from,
        LocalDate to,
        UUID clientId,
        UUID projectId,
        UUID taskId,
        UUID tagId,
        Boolean billable,
        String q
) {}
