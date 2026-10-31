package com.ch3xy.dash.dataio;

/**
 * Mutable tally of entities created during an import run, or during one row of it
 * (merged into the run total once the row committed); never persisted.
 */
final class ImportCounters {
    int clients;
    int projects;
    int tasks;
    int tags;

    void add(ImportCounters other) {
        clients += other.clients;
        projects += other.projects;
        tasks += other.tasks;
        tags += other.tags;
    }
}
