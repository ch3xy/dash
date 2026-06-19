package com.ch3xy.dash.timer;

import com.ch3xy.dash.timeentry.TimeEntryResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/timer")
public class TimerController {

    private final TimerService service;

    public TimerController(TimerService service) {
        this.service = service;
    }

    @GetMapping("/current")
    public ResponseEntity<TimerResponse> current() {
        return ResponseEntity.ok(service.getCurrent());
    }

    @PostMapping("/start")
    @ResponseStatus(HttpStatus.CREATED)
    public TimerResponse start(@Valid @RequestBody TimerStartRequest req) {
        return service.start(req);
    }

    @PostMapping("/stop")
    @ResponseStatus(HttpStatus.CREATED)
    public TimeEntryResponse stop(@RequestBody(required = false) TimerStopRequest req) {
        return service.stop(req);
    }

    @PostMapping("/discard")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void discard() {
        service.discard();
    }

    @PatchMapping("/current")
    public ResponseEntity<TimerResponse> update(@RequestBody TimerUpdateRequest req) {
        return ResponseEntity.ok(service.update(req));
    }
}
