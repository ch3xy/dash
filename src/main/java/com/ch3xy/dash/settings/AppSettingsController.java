package com.ch3xy.dash.settings;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/settings")
public class AppSettingsController {

    private final AppSettingsService service;

    public AppSettingsController(AppSettingsService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<AppSettingsResponse> get() {
        return ResponseEntity.ok(service.getAll());
    }

    @PutMapping
    public ResponseEntity<AppSettingsResponse> update(@Valid @RequestBody AppSettingsRequest req) {
        return ResponseEntity.ok(service.update(req));
    }
}
