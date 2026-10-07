package com.ch3xy.dash.timeentry;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.time.LocalDate;
import java.util.UUID;

@Schema(description = "Löschen aller Zeiteinträge, die den Kriterien entsprechen. Mindestens ein Kriterium ist Pflicht.")
public record DeleteByCriteriaRequest(
        @Schema(description = "Startdatum (inklusive), filtert nach entryDate") LocalDate from,
        @Schema(description = "Enddatum (inklusive), filtert nach entryDate") LocalDate to,
        @Schema(description = "UUID des Kunden") UUID clientId,
        @Schema(description = "UUID des Projekts") UUID projectId,
        @Schema(description = "Anzahl Einträge laut Vorschau. Weicht die tatsächliche Anzahl ab, wird nichts gelöscht.")
        @NotNull @PositiveOrZero Integer expectedCount) {

    DeleteCriteria criteria() {
        return new DeleteCriteria(from, to, clientId, projectId);
    }
}
