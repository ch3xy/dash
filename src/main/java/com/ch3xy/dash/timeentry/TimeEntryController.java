package com.ch3xy.dash.timeentry;

import com.ch3xy.dash.common.pagination.PageResponse;
import com.ch3xy.dash.timer.TimerResponse;
import com.ch3xy.dash.timer.TimerService;
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

@RestController
@RequestMapping("/api/v1/time-entries")
public class TimeEntryController {

    private final TimeEntryService service;
    private final TimerService timerService;

    public TimeEntryController(TimeEntryService service, TimerService timerService) {
        this.service = service;
        this.timerService = timerService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<TimeEntryResponse>> getAll(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) UUID clientId,
            @RequestParam(required = false) UUID projectId,
            @RequestParam(required = false) UUID taskId,
            @RequestParam(required = false) UUID tagId,
            @RequestParam(required = false) Boolean billable,
            @RequestParam(required = false) String q,
            Pageable pageable) {
        TimeEntryFilter filter = new TimeEntryFilter(from, to, clientId, projectId, taskId, tagId, billable, q);
        return ResponseEntity.ok(PageResponse.of(service.findAll(filter, pageable)));
    }

    @PostMapping
    public ResponseEntity<TimeEntryResponse> create(@Valid @RequestBody TimeEntryRequest req) {
        TimeEntryResponse created = service.create(req);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(created);
    }

    @PostMapping("/bulk")
    @ResponseStatus(HttpStatus.CREATED)
    public List<TimeEntryResponse> createBulk(
            @RequestBody @Valid List<@Valid TimeEntryRequest> requests) {
        return service.createAll(requests);
    }

    @GetMapping("/recent-combinations")
    public ResponseEntity<List<RecentCombination>> recentCombinations(
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(service.recentCombinations(limit));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TimeEntryResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TimeEntryResponse> update(
            @PathVariable UUID id, @Valid @RequestBody TimeEntryRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/continue")
    public ResponseEntity<TimerResponse> continueEntry(@PathVariable UUID id) {
        return ResponseEntity.status(201).body(timerService.continueFrom(id));
    }
}
