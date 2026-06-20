package com.ch3xy.dash.timer;

import com.ch3xy.dash.timeentry.TimeEntryResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Timer", description = "Steuerung des laufenden Timers. Es kann jeweils nur ein Timer gleichzeitig aktiv sein.")
@RestController
@RequestMapping("/api/v1/timer")
public class TimerController {

    private final TimerService service;

    public TimerController(TimerService service) {
        this.service = service;
    }

    @Operation(
            summary = "Aktuellen Timer abrufen",
            description = "Gibt den laufenden Timer zurück. Ist kein Timer aktiv, wird null zurückgegeben."
    )
    @GetMapping("/current")
    public ResponseEntity<TimerResponse> current() {
        return ResponseEntity.ok(service.findCurrent().orElse(null));
    }

    @Operation(
            summary = "Neuen Timer starten",
            description = "Startet einen neuen Timer mit den angegebenen Metadaten. Schlägt mit 409 fehl, wenn bereits ein Timer läuft — der bestehende Timer muss zuerst gestoppt oder verworfen werden."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Timer erfolgreich gestartet"),
            @ApiResponse(responseCode = "400", description = "Ungültige Anfragedaten"),
            @ApiResponse(responseCode = "409", description = "Es läuft bereits ein Timer")
    })
    @PostMapping("/start")
    @ResponseStatus(HttpStatus.CREATED)
    public TimerResponse start(@Valid @RequestBody TimerStartRequest req) {
        return service.start(req);
    }

    @Operation(
            summary = "Laufenden Timer stoppen und Zeiteintrag erstellen",
            description = "Stoppt den aktiven Timer und speichert ihn als abgeschlossenen Zeiteintrag. Der Stundensatz-Snapshot wird anhand der Ratenpriorität (Task > Projekt > App-Default) ermittelt. Optional kann im Body eine abweichende Endzeit übergeben werden."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Timer gestoppt, Zeiteintrag angelegt"),
            @ApiResponse(responseCode = "400", description = "Angegebene Endzeit liegt vor der Startzeit oder ergibt eine Dauer ≤ 0"),
            @ApiResponse(responseCode = "404", description = "Kein laufender Timer vorhanden")
    })
    @PostMapping("/stop")
    @ResponseStatus(HttpStatus.CREATED)
    public TimeEntryResponse stop(@RequestBody(required = false) TimerStopRequest req) {
        return service.stop(req);
    }

    @Operation(
            summary = "Laufenden Timer verwerfen",
            description = "Bricht den aktiven Timer ab, ohne einen Zeiteintrag zu erstellen. Die aufgelaufene Zeit geht verloren."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Timer verworfen"),
            @ApiResponse(responseCode = "404", description = "Kein laufender Timer vorhanden")
    })
    @PostMapping("/discard")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void discard() {
        service.discard();
    }

    @Operation(
            summary = "Laufenden Timer aktualisieren",
            description = "Aktualisiert Metadaten (Beschreibung, Projekt, Task, Tags, Billable-Flag) des laufenden Timers ohne ihn zu stoppen."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Timer aktualisiert"),
            @ApiResponse(responseCode = "404", description = "Kein laufender Timer vorhanden")
    })
    @PatchMapping("/current")
    public ResponseEntity<TimerResponse> update(@RequestBody TimerUpdateRequest req) {
        return ResponseEntity.ok(service.update(req));
    }
}
