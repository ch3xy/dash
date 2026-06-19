package com.ch3xy.dash.project;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects")
public class ProjectController {

    private final ProjectService service;

    public ProjectController(ProjectService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<ProjectResponse>> getAll(
            @RequestParam(defaultValue = "false") boolean archived) {
        return ResponseEntity.ok(service.findAll(archived));
    }

    @PostMapping
    public ResponseEntity<ProjectResponse> create(@Valid @RequestBody ProjectRequest req) {
        ProjectResponse created = service.create(req);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(created);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProjectResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProjectResponse> update(
            @PathVariable UUID id, @Valid @RequestBody ProjectRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ProjectResponse> updateStatus(
            @PathVariable UUID id, @Valid @RequestBody ProjectStatusRequest req) {
        return ResponseEntity.ok(service.updateStatus(id, req.status()));
    }

    @GetMapping("/{id}/budget-status")
    public ResponseEntity<BudgetStatusResponse> getBudgetStatus(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getBudgetStatus(id));
    }

    @GetMapping("/{id}/rates")
    public ResponseEntity<List<ProjectRateResponse>> getRates(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getRates(id));
    }

    @PostMapping("/{id}/rates")
    public ResponseEntity<ProjectRateResponse> addRate(
            @PathVariable UUID id, @Valid @RequestBody ProjectRateRequest req) {
        return ResponseEntity.ok(service.addRate(id, req));
    }
}
