package com.ch3xy.dash.dataio;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class DataIoController {

    private final BackupService backupService;
    private final ClockifyImportService clockifyImportService;

    public DataIoController(BackupService backupService,
                           ClockifyImportService clockifyImportService) {
        this.backupService = backupService;
        this.clockifyImportService = clockifyImportService;
    }

    @GetMapping("/backup")
    public ResponseEntity<BackupDocument> backup() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"dash-backup.json\"")
                .body(backupService.export());
    }

    @PostMapping(value = "/import/clockify", consumes = {MediaType.TEXT_PLAIN_VALUE, "text/csv"})
    public ResponseEntity<ImportResult> importClockify(@RequestBody String csv) {
        return ResponseEntity.ok(clockifyImportService.importCsv(csv));
    }
}
