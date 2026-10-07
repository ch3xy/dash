package com.ch3xy.dash.closing;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Ein abgeschlossener (gesperrter) Monat.")
public record MonthLockResponse(
        @Schema(description = "Monat im Format yyyy-MM", example = "2026-09") String month,
        @Schema(description = "Zeitpunkt des Abschlusses") Instant lockedAt,
        @Schema(description = "Optionale Notiz zum Abschluss") String note) {
}
