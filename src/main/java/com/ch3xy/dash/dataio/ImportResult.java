package com.ch3xy.dash.dataio;

import java.util.List;

public record ImportResult(
        int importedEntries,
        int skippedDuplicates,
        int createdClients,
        int createdProjects,
        int createdTasks,
        int createdTags,
        List<String> warnings
) {}
