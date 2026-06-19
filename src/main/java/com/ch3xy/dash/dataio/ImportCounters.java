package com.ch3xy.dash.dataio;

/**
 * Mutable tally of entities created during an import run. Shared across per-row
 * transactions; only mutated in memory, never persisted.
 */
final class ImportCounters {
    int clients;
    int projects;
    int tasks;
    int tags;
}
