package com.ch3xy.dash.dataio;

/** Result of importing a single CSV row. */
enum RowOutcome {
    IMPORTED,
    /** Missing or invalid start/end. */
    INVALID,
    /** An entry with the same project, start and end already exists. */
    DUPLICATE
}
