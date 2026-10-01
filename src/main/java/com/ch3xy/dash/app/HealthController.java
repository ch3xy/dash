package com.ch3xy.dash.app;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@Tag(name = "Health", description = "Systemstatus-Endpunkt zur Verfügbarkeitsprüfung.")
@RestController
@RequestMapping("/api/v1")
public class HealthController {

    private final String version;

    public HealthController(ObjectProvider<BuildProperties> buildProperties) {
        BuildProperties props = buildProperties.getIfAvailable();
        this.version = props != null ? props.getVersion() : "dev";
    }

    @Operation(
            summary = "Health-Status prüfen",
            description = "Gibt den aktuellen Systemstatus und die Anwendungsversion zurück. Solange die Anwendung erreichbar ist und die Datenbankverbindung besteht, wird status=UP gemeldet. Geeignet für Monitoring-Checks und Load-Balancer Health-Probes."
    )
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "version", version,
                "timestamp", Instant.now().toString()
        ));
    }
}
