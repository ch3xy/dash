package com.ch3xy.dash.task;

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

@Tag(name = "Tasks", description = "Aufgaben innerhalb von Projekten. Ein Task kann einen eigenen Stundensatz definieren, der den Projektstundensatz überschreibt.")
@RestController
public class TaskController {

    private final TaskService service;

    public TaskController(TaskService service) {
        this.service = service;
    }

    @Operation(
            summary = "Alle Tasks eines Projekts abrufen",
            description = "Gibt alle Tasks des angegebenen Projekts zurück. Standardmäßig werden nur aktive (nicht archivierte) Tasks geliefert."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Tasks gefunden"),
            @ApiResponse(responseCode = "404", description = "Projekt nicht gefunden")
    })
    @GetMapping("/api/v1/projects/{projectId}/tasks")
    public ResponseEntity<List<TaskResponse>> getByProject(
            @Parameter(description = "UUID des Projekts, dessen Tasks abgerufen werden sollen") @PathVariable UUID projectId,
            @Parameter(description = "Wenn true, werden auch archivierte Tasks eingeschlossen.") @RequestParam(defaultValue = "false") boolean archived) {
        return ResponseEntity.ok(service.findByProject(projectId, archived));
    }

    @Operation(
            summary = "Neuen Task anlegen",
            description = "Erstellt einen neuen Task innerhalb des angegebenen Projekts. Der Taskname muss innerhalb des Projekts eindeutig sein."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Task erfolgreich angelegt"),
            @ApiResponse(responseCode = "404", description = "Projekt nicht gefunden"),
            @ApiResponse(responseCode = "409", description = "Taskname in diesem Projekt bereits vergeben")
    })
    @PostMapping("/api/v1/projects/{projectId}/tasks")
    public ResponseEntity<TaskResponse> create(
            @Parameter(description = "UUID des Projekts, dem der Task zugeordnet wird") @PathVariable UUID projectId,
            @Valid @RequestBody TaskRequest req) {
        TaskResponse created = service.create(projectId, req);
        URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/v1/tasks/{id}").buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(created);
    }

    @Operation(
            summary = "Einzelnen Task abrufen",
            description = "Gibt den Task mit der angegebenen ID zurück, inklusive optionalem Stundensatz-Override."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Task gefunden"),
            @ApiResponse(responseCode = "404", description = "Task nicht gefunden")
    })
    @GetMapping("/api/v1/tasks/{id}")
    public ResponseEntity<TaskResponse> getById(
            @Parameter(description = "UUID des Tasks") @PathVariable UUID id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @Operation(
            summary = "Task vollständig aktualisieren",
            description = "Ersetzt alle Felder des Tasks mit den übermittelten Werten (PUT-Semantik)."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Task aktualisiert"),
            @ApiResponse(responseCode = "404", description = "Task nicht gefunden"),
            @ApiResponse(responseCode = "409", description = "Taskname in diesem Projekt bereits vergeben")
    })
    @PutMapping("/api/v1/tasks/{id}")
    public ResponseEntity<TaskResponse> update(
            @Parameter(description = "UUID des Tasks") @PathVariable UUID id,
            @Valid @RequestBody TaskRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @Operation(
            summary = "Task archivieren",
            description = "Setzt den Task auf archiviert. Archivierte Tasks erscheinen nicht mehr in Auswahlfeldern, bleiben aber in historischen Zeiteinträgen erhalten."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Task archiviert"),
            @ApiResponse(responseCode = "404", description = "Task nicht gefunden")
    })
    @PatchMapping("/api/v1/tasks/{id}/archive")
    public ResponseEntity<TaskResponse> archive(
            @Parameter(description = "UUID des Tasks") @PathVariable UUID id) {
        return ResponseEntity.ok(service.archive(id));
    }
}
