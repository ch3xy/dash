package com.ch3xy.dash.timeentry;

import java.time.LocalDate;
import java.util.UUID;

/** Criteria for deleting time entries in bulk; all set criteria are AND-combined. */
public record DeleteCriteria(LocalDate from, LocalDate to, UUID clientId, UUID projectId) {

    public boolean isEmpty() {
        return from == null && to == null && clientId == null && projectId == null;
    }
}
