package com.ch3xy.dash.timeentry;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.UUID;

@Schema(description = "Sammel-Löschung mehrerer Zeiteinträge.")
public record BulkDeleteRequest(
        @Schema(description = "UUIDs der zu löschenden Zeiteinträge")
        @NotEmpty List<UUID> ids) {
}
