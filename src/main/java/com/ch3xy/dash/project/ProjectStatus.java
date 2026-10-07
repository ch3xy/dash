package com.ch3xy.dash.project;

import com.fasterxml.jackson.annotation.JsonAlias;

public enum ProjectStatus {
    // PAUSED/COMPLETED were removed in V5; the aliases keep older backups restorable.
    @JsonAlias({"PAUSED", "COMPLETED"})
    ACTIVE,
    ARCHIVED
}
