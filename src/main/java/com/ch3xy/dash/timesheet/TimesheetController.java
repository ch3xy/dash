package com.ch3xy.dash.timesheet;

import com.ch3xy.dash.timeentry.TimeEntryResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Timesheet", description = "Schnelle Wochenerfassung: Zellen setzen und Wochen kopieren.")
@RestController
@RequestMapping("/api/v1/timesheet")
public class TimesheetController {

    private final TimesheetService service;

    public TimesheetController(TimesheetService service) {
        this.service = service;
    }

    @Operation(
            summary = "Timesheet-Zelle setzen",
            description = "Setzt die Gesamtdauer eines Projekts/Tasks an einem Tag. Mehr Zeit wird als neuer Eintrag nach dem letzten Eintrag des Tages angehängt; weniger Zeit kürzt die jüngsten Einträge der Zelle bzw. löscht sie."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Zelle gesetzt"),
            @ApiResponse(responseCode = "400", description = "Ungültige Dauer oder Task gehört nicht zum Projekt"),
            @ApiResponse(responseCode = "404", description = "Projekt oder Task nicht gefunden")
    })
    @PutMapping("/cell")
    public ResponseEntity<Void> setCell(@Valid @RequestBody TimesheetCellRequest req) {
        service.setCell(req);
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "Woche kopieren",
            description = "Kopiert alle Einträge der Quellwoche (Mo–So) in die Zielwoche, verschoben um ganze Wochen. Stundensätze werden für das neue Datum neu ermittelt."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Einträge kopiert"),
            @ApiResponse(responseCode = "400", description = "Quell- und Zielwoche sind identisch")
    })
    @PostMapping("/copy-week")
    @ResponseStatus(HttpStatus.CREATED)
    public List<TimeEntryResponse> copyWeek(@Valid @RequestBody CopyWeekRequest req) {
        return service.copyWeek(req);
    }
}
