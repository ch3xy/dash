package com.ch3xy.dash.dashboard;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@Tag(name = "Dashboard", description = "Tagesübersicht und KPIs auf einen Blick.")
@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {

    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    @Operation(
            summary = "Dashboard-Daten abrufen",
            description = "Gibt eine konsolidierte Übersicht zurück: laufender Timer, heute getrackte Zeit, Kennzahlen des gewählten Zeitraums (Dauer, Billable, Umsatz), Budgetwarnungen sowie Top-Projekte und Top-Kunden im Zeitraum. Ohne Zeitraum gilt die aktuelle Woche (Mo–So)."
    )
    @GetMapping
    public ResponseEntity<DashboardResponse> get(
            @Parameter(description = "Beginn des Zeitraums (ISO-8601, inklusive). Standard: Montag der aktuellen Woche.")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @Parameter(description = "Ende des Zeitraums (ISO-8601, inklusive). Standard: from + 6 Tage.")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok(service.getDashboard(from, to));
    }
}
