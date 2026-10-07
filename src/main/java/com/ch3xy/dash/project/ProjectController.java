package com.ch3xy.dash.project;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@Tag(name = "Projects", description = "Projektverwaltung inklusive Stundensatzhistorie und Budgetkontrolle.")
@RestController
@RequestMapping("/api/v1/projects")
public class ProjectController {

    private final ProjectService service;

    public ProjectController(ProjectService service) {
        this.service = service;
    }

    @Operation(
            summary = "Alle Projekte abrufen",
            description = "Gibt eine Liste aller Projekte zurück. Standardmäßig werden nur aktive Projekte geliefert. Mit archived=true werden alle Projekte unabhängig vom Status eingeschlossen; mit status nur Projekte genau dieses Status."
    )
    @GetMapping
    public ResponseEntity<List<ProjectResponse>> getAll(
            @Parameter(description = "Wenn true, werden archivierte Projekte in die Antwort eingeschlossen.")
            @RequestParam(defaultValue = "false") boolean archived,
            @Parameter(description = "Nur Projekte mit diesem Status; hat Vorrang vor archived.")
            @RequestParam(required = false) ProjectStatus status) {
        return ResponseEntity.ok(status != null ? service.findByStatus(status) : service.findAll(archived));
    }

    @Operation(
            summary = "Neues Projekt anlegen",
            description = "Erstellt ein neues Projekt und ordnet es optional einem Kunden zu. Projektname muss innerhalb desselben Kunden eindeutig sein."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Projekt erfolgreich angelegt"),
            @ApiResponse(responseCode = "404", description = "Angegebener Kunde nicht gefunden"),
            @ApiResponse(responseCode = "409", description = "Projektname für diesen Kunden bereits vergeben")
    })
    @PostMapping
    public ResponseEntity<ProjectResponse> create(@Valid @RequestBody ProjectRequest req) {
        ProjectResponse created = service.create(req);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(created);
    }

    @Operation(
            summary = "Einzelnes Projekt abrufen",
            description = "Gibt das Projekt mit der angegebenen ID zurück, inklusive Budgetkonfiguration und aktivem Stundensatz."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Projekt gefunden"),
            @ApiResponse(responseCode = "404", description = "Projekt nicht gefunden")
    })
    @GetMapping("/{id}")
    public ResponseEntity<ProjectResponse> getById(
            @Parameter(description = "UUID des Projekts") @PathVariable UUID id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @Operation(
            summary = "Projekt vollständig aktualisieren",
            description = "Ersetzt alle Felder des Projekts mit den übermittelten Werten (PUT-Semantik). Ändert nicht die Stundensatzhistorie."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Projekt aktualisiert"),
            @ApiResponse(responseCode = "404", description = "Projekt nicht gefunden"),
            @ApiResponse(responseCode = "409", description = "Projektname für diesen Kunden bereits vergeben")
    })
    @PutMapping("/{id}")
    public ResponseEntity<ProjectResponse> update(
            @Parameter(description = "UUID des Projekts") @PathVariable UUID id,
            @Valid @RequestBody ProjectRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @Operation(
            summary = "Projektstatus ändern",
            description = "Setzt den Status des Projekts (ACTIVE, ARCHIVED). Archivierte Projekte erscheinen nicht mehr in Auswahlfeldern und nehmen keine neuen Zeiteinträge oder Timer an; in Reports bleiben sie sichtbar."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Status aktualisiert"),
            @ApiResponse(responseCode = "404", description = "Projekt nicht gefunden")
    })
    @PatchMapping("/{id}/status")
    public ResponseEntity<ProjectResponse> updateStatus(
            @Parameter(description = "UUID des Projekts") @PathVariable UUID id,
            @Valid @RequestBody ProjectStatusRequest req) {
        return ResponseEntity.ok(service.updateStatus(id, req.status()));
    }

    @Operation(
            summary = "Budgetstatus eines Projekts abrufen",
            description = "Gibt den aktuellen Budgetverbrauch zurück: verbrauchte Minuten, verbleibende Minuten und Verbrauchsprozentsatz. Bei monatlichem Budget-Reset werden nur Einträge des laufenden Monats gewertet."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Budgetstatus berechnet"),
            @ApiResponse(responseCode = "404", description = "Projekt nicht gefunden")
    })
    @GetMapping("/{id}/budget-status")
    public ResponseEntity<BudgetStatusResponse> getBudgetStatus(
            @Parameter(description = "UUID des Projekts") @PathVariable UUID id) {
        return ResponseEntity.ok(service.getBudgetStatus(id));
    }

    @Operation(
            summary = "Stundensatzhistorie eines Projekts abrufen",
            description = "Gibt alle historischen Stundensätze des Projekts zurück, geordnet nach Gültigkeitsdatum. Jeder Satz enthält validFrom und validTo, um die Gültigkeitsspannen nachzuvollziehen."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Stundensätze gefunden"),
            @ApiResponse(responseCode = "404", description = "Projekt nicht gefunden")
    })
    @GetMapping("/{id}/rates")
    public ResponseEntity<List<ProjectRateResponse>> getRates(
            @Parameter(description = "UUID des Projekts") @PathVariable UUID id) {
        return ResponseEntity.ok(service.getRates(id));
    }

    @Operation(
            summary = "Neuen Stundensatz für ein Projekt hinterlegen",
            description = "Fügt einen neuen Stundensatz hinzu und schließt den bisher aktiven Satz historisch ab. Bereits gespeicherte Zeiteinträge behalten ihren Snapshot-Satz und werden nicht verändert."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Stundensatz hinzugefügt"),
            @ApiResponse(responseCode = "404", description = "Projekt nicht gefunden")
    })
    @PostMapping("/{id}/rates")
    public ResponseEntity<ProjectRateResponse> addRate(
            @Parameter(description = "UUID des Projekts") @PathVariable UUID id,
            @Valid @RequestBody ProjectRateRequest req) {
        return ResponseEntity.ok(service.addRate(id, req));
    }
}
