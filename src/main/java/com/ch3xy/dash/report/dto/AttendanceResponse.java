package com.ch3xy.dash.report.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Schema(description = "Anwesenheits-Report: pro Arbeitstag erster Start, letztes Ende, erfasste Zeit und Pausenzeit.")
public record AttendanceResponse(
        LocalDate from,
        LocalDate to,
        List<AttendanceDay> days
) {
    public record AttendanceDay(
            LocalDate date,
            @Schema(description = "Startzeit des ersten Zeiteintrags des Tages") Instant firstStart,
            @Schema(description = "Endzeit des letzten Zeiteintrags des Tages") Instant lastEnd,
            @Schema(description = "Summe der erfassten Dauer in Sekunden") long totalSeconds,
            @Schema(description = "Nicht erfasste Zeit zwischen erstem Start und letztem Ende in Sekunden") long breakSeconds
    ) {}
}
