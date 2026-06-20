package com.ch3xy.dash.settings;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Settings", description = "App-weite Einstellungen: Zeitzone, Standardwährung, Standardstundensatz und Rundungsregel.")
@RestController
@RequestMapping("/api/v1/settings")
public class AppSettingsController {

    private final AppSettingsService service;

    public AppSettingsController(AppSettingsService service) {
        this.service = service;
    }

    @Operation(
            summary = "Alle App-Einstellungen abrufen",
            description = "Gibt die aktuellen App-Einstellungen zurück: Zeitzone (Default: Europe/Vienna), Standardwährung (Default: EUR), Standard-Stundensatz und die konfigurierte Rundungsregel für Reportdauern."
    )
    @GetMapping
    public ResponseEntity<AppSettingsResponse> get() {
        return ResponseEntity.ok(service.getAll());
    }

    @Operation(
            summary = "App-Einstellungen aktualisieren",
            description = "Ersetzt alle App-Einstellungen mit den übermittelten Werten (PUT-Semantik). Änderungen wirken sich auf zukünftige Berechnungen aus; bereits gespeicherte Snapshot-Werte in Zeiteinträgen bleiben unverändert."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Einstellungen aktualisiert"),
            @ApiResponse(responseCode = "400", description = "Ungültige Einstellungswerte, z. B. unbekannte Zeitzone oder Währungscode")
    })
    @PutMapping
    public ResponseEntity<AppSettingsResponse> update(@Valid @RequestBody AppSettingsRequest req) {
        return ResponseEntity.ok(service.update(req));
    }
}
