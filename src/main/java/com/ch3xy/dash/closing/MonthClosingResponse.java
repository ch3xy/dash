package com.ch3xy.dash.closing;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.Instant;

@Schema(description = "Kennzahlen und Abschluss-Status eines Monats.")
public record MonthClosingResponse(
        @Schema(description = "Monat im Format yyyy-MM", example = "2026-09") String month,
        @Schema(description = "true, wenn der Monat abgeschlossen ist") boolean locked,
        @Schema(description = "Zeitpunkt des Abschlusses, null wenn offen") Instant lockedAt,
        @Schema(description = "Notiz zum Abschluss") String note,
        @Schema(description = "true, wenn der Monat abgeschlossen werden darf (offen und vollständig vergangen)") boolean lockable,
        @Schema(description = "Anzahl Zeiteinträge") int entryCount,
        @Schema(description = "Gesamtdauer in Sekunden") long totalSeconds,
        @Schema(description = "Abrechenbare Dauer in Sekunden") long billableSeconds,
        @Schema(description = "Umsatz aus abrechenbaren Einträgen") BigDecimal revenue,
        @Schema(description = "Währung des Umsatzes") String currency) {
}
