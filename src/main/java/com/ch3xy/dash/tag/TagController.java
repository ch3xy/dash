package com.ch3xy.dash.tag;

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

@Tag(name = "Tags", description = "Freie Kategorisierungslabels für Zeiteinträge. Tag-Namen sind systemweit eindeutig.")
@RestController
@RequestMapping("/api/v1/tags")
public class TagController {

    private final TagService service;

    public TagController(TagService service) {
        this.service = service;
    }

    @Operation(
            summary = "Alle Tags abrufen",
            description = "Gibt eine Liste aller Tags zurück. Standardmäßig werden nur aktive (nicht archivierte) Tags geliefert."
    )
    @GetMapping
    public ResponseEntity<List<TagResponse>> getAll(
            @Parameter(description = "Wenn true, werden auch archivierte Tags in die Antwort eingeschlossen.")
            @RequestParam(defaultValue = "false") boolean archived) {
        return ResponseEntity.ok(service.findAll(archived));
    }

    @Operation(
            summary = "Neuen Tag anlegen",
            description = "Erstellt einen neuen Tag. Der Name muss systemweit eindeutig sein."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Tag erfolgreich angelegt"),
            @ApiResponse(responseCode = "409", description = "Tag-Name bereits vergeben")
    })
    @PostMapping
    public ResponseEntity<TagResponse> create(@Valid @RequestBody TagRequest req) {
        TagResponse created = service.create(req);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(created);
    }

    @Operation(
            summary = "Einzelnen Tag abrufen",
            description = "Gibt den Tag mit der angegebenen ID zurück."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Tag gefunden"),
            @ApiResponse(responseCode = "404", description = "Tag nicht gefunden")
    })
    @GetMapping("/{id}")
    public ResponseEntity<TagResponse> getById(
            @Parameter(description = "UUID des Tags") @PathVariable UUID id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @Operation(
            summary = "Tag vollständig aktualisieren",
            description = "Ersetzt alle Felder des Tags mit den übermittelten Werten (PUT-Semantik)."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Tag aktualisiert"),
            @ApiResponse(responseCode = "404", description = "Tag nicht gefunden"),
            @ApiResponse(responseCode = "409", description = "Tag-Name bereits vergeben")
    })
    @PutMapping("/{id}")
    public ResponseEntity<TagResponse> update(
            @Parameter(description = "UUID des Tags") @PathVariable UUID id,
            @Valid @RequestBody TagRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @Operation(
            summary = "Tag archivieren",
            description = "Setzt den Tag auf archiviert. Archivierte Tags erscheinen nicht mehr in Auswahlfeldern, bleiben aber an bereits verknüpften Zeiteinträgen erhalten."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Tag archiviert"),
            @ApiResponse(responseCode = "404", description = "Tag nicht gefunden")
    })
    @PatchMapping("/{id}/archive")
    public ResponseEntity<TagResponse> archive(
            @Parameter(description = "UUID des Tags") @PathVariable UUID id) {
        return ResponseEntity.ok(service.archive(id));
    }
}
