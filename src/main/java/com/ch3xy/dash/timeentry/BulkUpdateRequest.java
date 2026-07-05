package com.ch3xy.dash.timeentry;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Schema(description = "Sammel-Änderung für mehrere Zeiteinträge. Nur gesetzte Felder werden angewendet.")
public record BulkUpdateRequest(
        @Schema(description = "UUIDs der zu ändernden Zeiteinträge")
        @NotEmpty List<UUID> ids,
        @Schema(description = "Neuer Billable-Status für alle Einträge. Der Umsatz-Snapshot wird neu berechnet.")
        Boolean billable,
        @Schema(description = "Tags, die allen Einträgen hinzugefügt werden")
        Set<UUID> addTagIds,
        @Schema(description = "Tags, die von allen Einträgen entfernt werden")
        Set<UUID> removeTagIds) {
}
