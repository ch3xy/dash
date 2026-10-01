package com.ch3xy.dash.dataio;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Data I/O", description = "Backup, Restore und Import. Backup und Restore operieren auf dem gesamten Datenbestand und sind nicht reversibel.")
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

    @Operation(
            summary = "Vollständiges Daten-Backup herunterladen",
            description = "Exportiert den gesamten Datenbestand (Kunden, Projekte, Tasks, Tags, Stundensätze, Zeiteinträge, Einstellungen) als JSON-Dokument. Der Content-Disposition-Header triggert den Browser-Download."
    )
    @GetMapping("/backup")
    public ResponseEntity<BackupDocument> backup() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"dash-backup.json\"")
                .body(backupService.export());
    }

    @Operation(
            summary = "Daten aus Backup wiederherstellen",
            description = "Ersetzt ALLE vorhandenen Daten durch den Inhalt des übermittelten Backup-Dokuments. Diese Operation ist irreversibel — vorher ein aktuelles Backup erstellen."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Restore erfolgreich abgeschlossen"),
            @ApiResponse(responseCode = "400", description = "Backup-Dokument ist ungültig oder beschädigt")
    })
    @PostMapping("/backup/restore")
    public ResponseEntity<RestoreResult> restore(@RequestBody BackupDocument document) {
        return ResponseEntity.ok(backupRestoreService.restore(document));
    }

    @Operation(
            summary = "Clockify-CSV-Export importieren",
            description = "Importiert Zeiteinträge aus einem Clockify-CSV-Export. Projekte und Kunden werden bei Bedarf automatisch angelegt. Bereits vorhandene Einträge (gleiches Projekt, gleiche Start- und Endzeit) werden als Duplikate übersprungen. Erwartet Content-Type text/plain oder text/csv."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Import abgeschlossen, Ergebnis enthält Anzahl importierter und übersprungener Einträge"),
            @ApiResponse(responseCode = "400", description = "CSV-Datei hat ein unbekanntes Format oder ist leer")
    })
    @PostMapping(value = "/import/clockify", consumes = {MediaType.TEXT_PLAIN_VALUE, "text/csv"})
    public ResponseEntity<ImportResult> importClockify(@RequestBody String csv) {
        return ResponseEntity.ok(clockifyImportService.importCsv(csv));
    }
}
