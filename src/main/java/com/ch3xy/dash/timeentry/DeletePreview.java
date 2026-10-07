package com.ch3xy.dash.timeentry;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Vorschau einer Sammel-Löschung: betroffene Einträge und deren Gesamtdauer.")
public record DeletePreview(
        @Schema(description = "Anzahl betroffener Zeiteinträge") int count,
        @Schema(description = "Summierte Dauer in Sekunden") long totalSeconds,
        @Schema(description = "Davon in abgeschlossenen Monaten; ist der Wert > 0, wird die Löschung abgelehnt") int lockedCount) {
}
