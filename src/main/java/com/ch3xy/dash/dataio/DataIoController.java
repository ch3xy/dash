package com.ch3xy.dash.dataio;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class DataIoController {

    private final BackupService backupService;
    private final BackupRestoreService backupRestoreService;
    private final ClockifyImportService clockifyImportService;

    public DataIoController(BackupService backupService,
                           BackupRestoreService backupRestoreService,
                           ClockifyImportService clockifyImportService) {
        this.backupService = backupService;
        this.backupRestoreService = backupRestoreService;
        this.clockifyImportService = clockifyImportService;
    }

    @GetMapping("/backup")
    public ResponseEntity<BackupDocument> backup() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"dash-backup.json\"")
                .body(backupService.export());
    }

    /** Replaces ALL existing data with the contents of the backup. Irreversible. */
    @PostMapping("/backup/restore")
    public ResponseEntity<RestoreResult> restore(@RequestBody BackupDocument document) {
        return ResponseEntity.ok(backupRestoreService.restore(document));
    }

    @PostMapping(value = "/import/clockify", consumes = {MediaType.TEXT_PLAIN_VALUE, "text/csv"})
    public ResponseEntity<ImportResult> importClockify(@RequestBody String csv) {
        return ResponseEntity.ok(clockifyImportService.importCsv(csv));
    }
}
