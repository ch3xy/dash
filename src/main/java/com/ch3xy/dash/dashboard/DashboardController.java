package com.ch3xy.dash.dashboard;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
            description = "Gibt eine konsolidierte Übersicht zurück: laufender Timer, heute und diese Woche getrackte Zeit, Monatszusammenfassung, Budgetwarnungen, Umsatzvorschau sowie Top-Projekte und Top-Kunden."
    )
    @GetMapping
    public ResponseEntity<DashboardResponse> get() {
        return ResponseEntity.ok(service.getDashboard());
    }
}
