package com.ch3xy.dash.client;

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

@Tag(name = "Clients", description = "Verwaltung von Kunden. Kunden können archiviert, aber nicht hart gelöscht werden, solange Projekte existieren.")
@RestController
@RequestMapping("/api/v1/clients")
public class ClientController {

    private final ClientService service;

    public ClientController(ClientService service) {
        this.service = service;
    }

    @Operation(
            summary = "Alle Kunden abrufen",
            description = "Gibt eine Liste aller Kunden zurück. Standardmäßig werden nur aktive (nicht archivierte) Kunden geliefert."
    )
    @GetMapping
    public ResponseEntity<List<ClientResponse>> getAll(
            @Parameter(description = "Wenn true, werden auch archivierte Kunden in der Antwort eingeschlossen.")
            @RequestParam(defaultValue = "false") boolean archived) {
        return ResponseEntity.ok(service.findAll(archived));
    }

    @Operation(
            summary = "Neuen Kunden anlegen",
            description = "Erstellt einen neuen Kunden. Der Kundenname muss eindeutig sein (Groß-/Kleinschreibung wird ignoriert)."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Kunde erfolgreich angelegt"),
            @ApiResponse(responseCode = "409", description = "Kundenname bereits vergeben")
    })
    @PostMapping
    public ResponseEntity<ClientResponse> create(@Valid @RequestBody ClientRequest req) {
        ClientResponse created = service.create(req);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(created);
    }

    @Operation(
            summary = "Einzelnen Kunden abrufen",
            description = "Gibt den Kunden mit der angegebenen ID zurück."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Kunde gefunden"),
            @ApiResponse(responseCode = "404", description = "Kunde nicht gefunden")
    })
    @GetMapping("/{id}")
    public ResponseEntity<ClientResponse> getById(
            @Parameter(description = "UUID des Kunden") @PathVariable UUID id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @Operation(
            summary = "Kunden vollständig aktualisieren",
            description = "Ersetzt alle Felder des Kunden mit den übermittelten Werten (PUT-Semantik)."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Kunde aktualisiert"),
            @ApiResponse(responseCode = "404", description = "Kunde nicht gefunden"),
            @ApiResponse(responseCode = "409", description = "Kundenname bereits vergeben")
    })
    @PutMapping("/{id}")
    public ResponseEntity<ClientResponse> update(
            @Parameter(description = "UUID des Kunden") @PathVariable UUID id,
            @Valid @RequestBody ClientRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @Operation(
            summary = "Kunden archivieren",
            description = "Setzt den Kunden auf archiviert. Archivierte Kunden erscheinen nicht mehr in Auswahlfeldern, bleiben aber in historischen Daten erhalten."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Kunde archiviert"),
            @ApiResponse(responseCode = "404", description = "Kunde nicht gefunden")
    })
    @PatchMapping("/{id}/archive")
    public ResponseEntity<ClientResponse> archive(
            @Parameter(description = "UUID des Kunden") @PathVariable UUID id) {
        return ResponseEntity.ok(service.archive(id));
    }

    @Operation(
            summary = "Kunden löschen",
            description = "Löscht den Kunden dauerhaft. Nur möglich, wenn dem Kunden keine Projekte zugeordnet sind."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Kunde gelöscht"),
            @ApiResponse(responseCode = "404", description = "Kunde nicht gefunden"),
            @ApiResponse(responseCode = "409", description = "Kunde hat zugeordnete Projekte und kann nicht gelöscht werden")
    })
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @Parameter(description = "UUID des Kunden") @PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
