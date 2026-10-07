package com.ch3xy.dash.closing;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.YearMonth;
import java.util.List;

@Tag(name = "Monatsabschluss", description = "Monate abschließen (Zeiteinträge schreibgeschützt) und wieder freigeben.")
@RestController
@RequestMapping("/api/v1/closing")
public class MonthClosingController {

    private final MonthLockService service;

    public MonthClosingController(MonthLockService service) {
        this.service = service;
    }

    @Operation(
            summary = "Monatsübersicht abrufen",
            description = "Alle Monate mit Einträgen oder Abschluss sowie der Vormonat, neueste zuerst, mit Kennzahlen und Abschluss-Status."
    )
    @GetMapping("/months")
    public ResponseEntity<List<MonthClosingResponse>> overview() {
        return ResponseEntity.ok(service.overview());
    }

    @Operation(
            summary = "Abgeschlossene Monate abrufen",
            description = "Leichtgewichtige Liste aller gesperrten Monate, z. B. um Ansichten schreibgeschützt darzustellen."
    )
    @GetMapping("/locks")
    public ResponseEntity<List<MonthLockResponse>> locks() {
        return ResponseEntity.ok(service.findLocks());
    }

    @Operation(
            summary = "Monat abschließen",
            description = "Sperrt alle Zeiteinträge des Monats (nach entryDate) gegen Anlegen, Ändern und Löschen. Nur vollständig vergangene Monate können abgeschlossen werden."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Monat abgeschlossen"),
            @ApiResponse(responseCode = "409", description = "Monat ist bereits abgeschlossen"),
            @ApiResponse(responseCode = "422", description = "Monat ist nicht vollständig vergangen")
    })
    @PostMapping("/months/{month}/lock")
    public ResponseEntity<MonthLockResponse> lock(
            @Parameter(description = "Monat im Format yyyy-MM") @PathVariable @DateTimeFormat(pattern = "yyyy-MM") YearMonth month,
            @Valid @RequestBody(required = false) MonthLockRequest req) {
        return ResponseEntity.ok(service.lock(month, req != null ? req.note() : null));
    }

    @Operation(
            summary = "Monat wieder freigeben",
            description = "Hebt den Abschluss auf; die Einträge des Monats sind danach wieder bearbeitbar."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Monat freigegeben"),
            @ApiResponse(responseCode = "404", description = "Monat ist nicht abgeschlossen")
    })
    @DeleteMapping("/months/{month}/lock")
    public ResponseEntity<Void> unlock(
            @Parameter(description = "Monat im Format yyyy-MM") @PathVariable @DateTimeFormat(pattern = "yyyy-MM") YearMonth month) {
        service.unlock(month);
        return ResponseEntity.noContent().build();
    }
}
