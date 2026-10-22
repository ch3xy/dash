package com.ch3xy.dash.app;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.boot.info.GitProperties;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Tag(name = "Health", description = "Systemstatus-Endpunkt zur Verfügbarkeitsprüfung.")
@RestController
@RequestMapping("/api/v1")
public class HealthController {

    private final String version;
    /** Kurzer Git-Commit des Builds; {@code null} ohne git.properties. */
    private final String commit;
    /** Der Build enthielt nicht committete Änderungen. */
    private final boolean dirty;
    private final Instant builtAt;

    public HealthController(ObjectProvider<BuildProperties> buildProperties,
                            ObjectProvider<GitProperties> gitProperties) {
        BuildProperties props = buildProperties.getIfAvailable();
        GitProperties git = gitProperties.getIfAvailable();
        this.version = props != null ? props.getVersion() : "dev";
        this.builtAt = props != null ? props.getTime() : null;
        this.commit = git != null ? git.getShortCommitId() : null;
        this.dirty = git != null && Boolean.parseBoolean(git.get("dirty"));
    }

    @Operation(
            summary = "Health-Status prüfen",
            description = "Gibt den aktuellen Systemstatus, die Anwendungsversion und den Build (Git-Commit, Build-Zeit) zurück. Solange die Anwendung erreichbar ist und die Datenbankverbindung besteht, wird status=UP gemeldet. Geeignet für Monitoring-Checks und Load-Balancer Health-Probes."
    )
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        // LinkedHashMap: commit and builtAt may be null, which Map.of does not allow
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "UP");
        body.put("version", version);
        body.put("commit", commit);
        body.put("dirty", dirty);
        body.put("builtAt", builtAt != null ? builtAt.toString() : null);
        body.put("timestamp", Instant.now().toString());
        return ResponseEntity.ok(body);
    }
}
