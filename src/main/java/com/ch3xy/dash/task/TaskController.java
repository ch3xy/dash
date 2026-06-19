package com.ch3xy.dash.task;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
public class TaskController {

    private final TaskService service;

    public TaskController(TaskService service) {
        this.service = service;
    }

    @GetMapping("/api/v1/projects/{projectId}/tasks")
    public ResponseEntity<List<TaskResponse>> getByProject(
            @PathVariable UUID projectId,
            @RequestParam(defaultValue = "false") boolean archived) {
        return ResponseEntity.ok(service.findByProject(projectId, archived));
    }

    @PostMapping("/api/v1/projects/{projectId}/tasks")
    public ResponseEntity<TaskResponse> create(
            @PathVariable UUID projectId, @Valid @RequestBody TaskRequest req) {
        TaskResponse created = service.create(projectId, req);
        URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/v1/tasks/{id}").buildAndExpand(created.id()).toUri();
        return ResponseEntity.created(location).body(created);
    }

    @GetMapping("/api/v1/tasks/{id}")
    public ResponseEntity<TaskResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PutMapping("/api/v1/tasks/{id}")
    public ResponseEntity<TaskResponse> update(
            @PathVariable UUID id, @Valid @RequestBody TaskRequest req) {
        return ResponseEntity.ok(service.update(id, req));
    }

    @PatchMapping("/api/v1/tasks/{id}/archive")
    public ResponseEntity<TaskResponse> archive(@PathVariable UUID id) {
        return ResponseEntity.ok(service.archive(id));
    }
}
