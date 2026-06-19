package com.ch3xy.dash.dataio;

/**
 * Counts of rows restored from a {@link BackupDocument}, per entity type.
 */
public record RestoreResult(
        int clients,
        int projects,
        int projectRates,
        int tasks,
        int tags,
        int timeEntries
) {}
