package com.ch3xy.dash.timeentry;

import com.ch3xy.dash.common.pagination.PageResponse;
import com.ch3xy.dash.timer.TimerResponse;
import com.ch3xy.dash.timer.TimerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Tag(name = "Time Entries", description = "Verwaltung abgeschlossener Zeiteinträge. Einträge können manuell angelegt, via Timer erzeugt oder importiert werden.")
@RestController
@RequestMapping("/api/v1/time-entries")
public class TimeEntryController {

    private final TimeEntryService service;
    private final TimerService timerService;

    public TimeEntryController(TimeEntryService service, TimerService timerService) {
        this.service = service;
        this.timerService = timerService;
    }

    @Operation(
            summary = "Zeiteinträge gefiltert abrufen",
            description = "Gibt eine paginierte Liste von Zeiteinträgen zurück. Alle Filterparameter sind optional und können kombiniert werden. Ergebnisse werden absteigend nach Startzeit sortiert."
    )
    @GetMapping
    public ResponseEntity<PageResponse<TimeEntryResponse>> getAll(
            @Parameter(description = "Startdatum des Zeitraums (ISO-8601, z. B. 2025-01-01). Filtert nach entryDate.") @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @Parameter(description = "Enddatum des Zeitraums (ISO-8601, z. B. 2025-01-31). Filtert nach entryDate.") @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @Parameter(description = "UUID des Kunden — filtert auf Projekte dieses Kunden.") @RequestParam(required = false) UUID clientId,
            @Parameter(description = "UUID des Projekts.") @RequestParam(required = false) UUID projectId,
            @Parameter(description = "UUID des Tasks.") @RequestParam(required = false) UUID taskId,
            @Parameter(description = "UUID des Tags — filtert auf Einträge mit diesem Tag.") @RequestParam(required = false) UUID tagId,
            @Parameter(description = "Wenn true, werden nur abrechenbare Einträge zurückgegeben. Wenn false, nur nicht-abrechenbare.") @RequestParam(required = false) Boolean billable,
            @Parameter(description = "Freitextsuche in der Beschreibung (case-insensitive, enthält-Suche).") @RequestParam(required = false) String q,
            @Parameter(hidden = true) Pageable pageable) {
        TimeEntryFilter filter = new TimeEntryFilter(from, to, clientId, projectId, taskId, tagId, billable, q);
        return ResponseEntity.ok(PageResponse.of(service.findAll(filter, pageable)));
    }

    @Operation(
            summary = "Neuen Zeiteintrag anlegen",
            description = "Erstellt einen manuellen Zeiteintrag. Start- und Endzeit müssen vollständige Zeitstempel (ISO-8601 mit Zeitzone) sein. Der Stundensatz-Snapshot wird anhand der Ratenpriorität (Task > Projekt > App-Default) ermittelt."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Zeiteintrag angelegt"),
            @ApiResponse(responseCode = "400", description = "Ungültige Daten, z. B. Endzeit vor Startzeit oder Dauer ≤ 0")
    })
    @PostMapping
    public ResponseEntity<TimeEntryResponse> create(@Valid @RequestBody TimeEntryRequest req) {
        TimeEntryResponse created = service.create(req);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(created);
    }

    @Operation(
            summary = "Mehrere Zeiteinträge auf einmal anlegen",
            description = "Erstellt eine Liste von Zeiteinträgen in einer einzigen Anfrage. Nützlich für Importe oder wöchentliche Bulk-Eingaben. Jeder Eintrag wird einzeln validiert; schlägt ein Eintrag fehl, wird die gesamte Anfrage abgelehnt."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Alle Zeiteinträge angelegt"),
            @ApiResponse(responseCode = "400", description = "Mindestens ein Eintrag ist ungültig")
    })
    @PostMapping("/bulk")
    @ResponseStatus(HttpStatus.CREATED)
    public List<TimeEntryResponse> createBulk(
            @RequestBody @Valid List<@Valid TimeEntryRequest> requests) {
        return service.createAll(requests);
    }

    @Operation(
            summary = "Mehrere Zeiteinträge auf einmal löschen",
            description = "Löscht alle Zeiteinträge mit den angegebenen IDs dauerhaft. Schlägt die Anfrage für eine ID fehl, wird nichts gelöscht."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Alle Zeiteinträge gelöscht"),
            @ApiResponse(responseCode = "404", description = "Mindestens ein Zeiteintrag wurde nicht gefunden")
    })
    @PostMapping("/bulk-delete")
    public ResponseEntity<Void> deleteBulk(@Valid @RequestBody BulkDeleteRequest req) {
        service.deleteAll(req.ids());
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "Mehrere Zeiteinträge auf einmal ändern",
            description = "Wendet die gesetzten Felder (Billable-Status, Tags hinzufügen/entfernen) auf alle angegebenen Zeiteinträge an. Bei Billable-Änderung wird der Umsatz-Snapshot aus dem gespeicherten Stundensatz neu berechnet."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Alle Zeiteinträge aktualisiert"),
            @ApiResponse(responseCode = "404", description = "Mindestens ein Zeiteintrag oder Tag wurde nicht gefunden")
    })
    @PostMapping("/bulk-update")
    public ResponseEntity<List<TimeEntryResponse>> updateBulk(@Valid @RequestBody BulkUpdateRequest req) {
        return ResponseEntity.ok(service.bulkUpdate(req));
    }

    @Operation(
            summary = "Zuletzt verwendete Projekt/Task-Kombinationen abrufen",
            description = "Gibt die zuletzt genutzten Kombinationen aus Projekt, Task, Tags und Billable-Flag zurück. Nützlich für Schnellauswahl beim Starten eines neuen Timers."
    )
    @GetMapping("/recent-combinations")
    public ResponseEntity<List<RecentCombination>> recentCombinations(
            @Parameter(description = "Maximale Anzahl zurückgegebener Kombinationen (Standard: 10).") @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(service.recentCombinations(limit));
    }

    @Operation(
            summary = "Einzelnen Zeiteintrag abrufen",
            description = "Gibt den Zeiteintrag mit der angegebenen ID zurück, inklusive Stundensatz-Snapshot und verknüpften Tags."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Zeiteintrag gefunden"),
            @ApiResponse(responseCode = "404", description = "Zeiteintrag nicht gefunden")
    })
    @GetMapping("/{id}")
    public ResponseEntity<TimeEntryResponse> getById(
            @Parameter(description = "UUID des Zeiteintrags") @PathVariable UUID id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @Operation(
            summary = "Zeiteintrag vollständig aktualisieren",
            description = "Ersetzt alle Felder des Zeiteintrags (PUT-Semantik). Der Stundensatz-Snapshot wird neu berechnet, sofern kein expliziter Override übergeben wird."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Zeiteintrag aktualisiert"),
            @ApiResponse(responseCode = "400", description = "Ungültige Daten"),
            @ApiResponse(responseCode = "404", description = "Zeiteintrag nicht gefunden")
    })
    @PutMapping("/{id}")
    public ResponseEntity<TimeEntryResponse> update(
            @Parameter(description = "UUID des Zeiteintrags") @PathVariable UUID id,
            @Valid @RequestBody TimeEntryRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @Operation(
            summary = "Zeiteintrag löschen",
            description = "Löscht den Zeiteintrag dauerhaft. Diese Aktion kann nicht rückgängig gemacht werden."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Zeiteintrag gelöscht"),
            @ApiResponse(responseCode = "404", description = "Zeiteintrag nicht gefunden")
    })
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @Parameter(description = "UUID des Zeiteintrags") @PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "Zeiteintrag als Timer fortsetzen",
            description = "Startet einen neuen laufenden Timer mit denselben Metadaten (Projekt, Task, Tags, Beschreibung, Billable-Flag) wie der angegebene Zeiteintrag. Schlägt fehl, wenn bereits ein Timer läuft."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Timer gestartet"),
            @ApiResponse(responseCode = "404", description = "Zeiteintrag nicht gefunden"),
            @ApiResponse(responseCode = "409", description = "Es läuft bereits ein Timer")
    })
    @PostMapping("/{id}/continue")
    public ResponseEntity<TimerResponse> continueEntry(
            @Parameter(description = "UUID des Zeiteintrags, der als Vorlage verwendet werden soll") @PathVariable UUID id) {
        return ResponseEntity.status(201).body(timerService.continueFrom(id));
    }

    @Operation(
            summary = "Zeiteintrag aufteilen",
            description = "Teilt einen Zeiteintrag an einem bestimmten Zeitpunkt in zwei Einträge auf. Der ursprüngliche Eintrag wird gelöscht. Projekt, Task, Tags und Beschreibung werden auf beide Teile übertragen."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Zwei neue Einträge wurden erstellt"),
            @ApiResponse(responseCode = "400", description = "splitAt liegt außerhalb des Eintragszeitraums"),
            @ApiResponse(responseCode = "404", description = "Zeiteintrag nicht gefunden")
    })
    @PostMapping("/{id}/split")
    public ResponseEntity<List<TimeEntryResponse>> split(
            @PathVariable UUID id,
            @Valid @RequestBody SplitRequest req) {
        return ResponseEntity.ok(service.split(id, req.splitAt()));
    }

    record SplitRequest(@jakarta.validation.constraints.NotNull java.time.Instant splitAt) {}
}
