package com.ch3xy.dash.dataio;

import com.ch3xy.dash.AbstractIntegrationTest;
import com.ch3xy.dash.project.BudgetReset;
import com.ch3xy.dash.project.ProjectRateRequest;
import com.ch3xy.dash.project.ProjectRequest;
import com.ch3xy.dash.project.ProjectResponse;
import com.ch3xy.dash.project.ProjectService;
import com.ch3xy.dash.settings.AppSettingsResponse;
import com.ch3xy.dash.timeentry.RecentCombination;
import com.ch3xy.dash.timeentry.TimeEntryFilter;
import com.ch3xy.dash.timeentry.TimeEntryRequest;
import com.ch3xy.dash.timeentry.TimeEntryResponse;
import com.ch3xy.dash.timeentry.TimeEntryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DataIoIntegrationTest extends AbstractIntegrationTest {

    @Autowired ClockifyImportService importService;
    @Autowired BackupService backupService;
    @Autowired BackupRestoreService backupRestoreService;
    @Autowired ProjectService projectService;
    @Autowired TimeEntryService timeEntryService;

    @Test
    void clockifyImportCreatesEntitiesAndDeduplicates() {
        String csv = """
                Project,Client,Description,Task,Tags,Billable,Start Date,Start Time,End Date,End Time
                ClkImport Project,ClkImport Client,Homepage,ClkImport Design,"ClkFrontend;ClkUI",Yes,2026-07-01,08:00:00,2026-07-01,10:00:00
                ClkImport Project,ClkImport Client,Bugfix,ClkImport Design,ClkFrontend,No,2026-07-02,09:00:00,2026-07-02,09:30:00
                """;

        ImportResult result = importService.importCsv(csv);

        assertThat(result.importedEntries()).isEqualTo(2);
        assertThat(result.createdClients()).isEqualTo(1);
        assertThat(result.createdProjects()).isEqualTo(1);
        assertThat(result.createdTasks()).isEqualTo(1);   // "Design" deduplicated across both rows
        assertThat(result.createdTags()).isEqualTo(2);    // Frontend + UI
        assertThat(result.warnings()).isEmpty();
    }

    @Test
    void clockifyReimportSkipsExistingEntriesAsDuplicates() {
        String csv = """
                Project,Client,Description,Task,Tags,Billable,Start Date,Start Time,End Date,End Time
                ClkDup Project,ClkDup Client,first,,,Yes,2026-07-10,08:00:00,2026-07-10,10:00:00
                ClkDup Project,ClkDup Client,second,,,Yes,2026-07-10,10:00:00,2026-07-10,11:00:00
                ClkDup Project,ClkDup Client,second again,,,Yes,2026-07-10,10:00:00,2026-07-10,11:00:00
                """;

        ImportResult first = importService.importCsv(csv);
        assertThat(first.importedEntries()).isEqualTo(2);
        assertThat(first.skippedDuplicates()).isEqualTo(1); // duplicate row within the same file

        String overlapping = csv + """
                ClkDup Project,ClkDup Client,new,,,Yes,2026-07-10,11:00:00,2026-07-10,12:00:00
                ClkDup Project,ClkDup Client,shorter,,,Yes,2026-07-10,08:00:00,2026-07-10,09:00:00
                """;
        ImportResult second = importService.importCsv(overlapping);

        assertThat(second.importedEntries()).isEqualTo(2);   // new slot + same start but different end
        assertThat(second.skippedDuplicates()).isEqualTo(3);
        assertThat(second.createdProjects()).isZero();
        assertThat(second.warnings()).isEmpty();
    }

    @Test
    void clockifyImportSkipsRowsWithInvalidInterval() {
        String csv = """
                Project,Client,Description,Task,Tags,Billable,Start Date,Start Time,End Date,End Time
                Bad Project,Bad Client,reversed,,,No,2026-07-05,10:00:00,2026-07-05,08:00:00
                """;

        ImportResult result = importService.importCsv(csv);

        assertThat(result.importedEntries()).isZero();
        assertThat(result.warnings()).hasSize(1);
    }

    @Test
    void clockifyImportDetectsDayFirstDatesPerFile() {
        String name = "ClkDate Project " + System.nanoTime();
        String csv = """
                Project,Client,Description,Task,Tags,Billable,Start Date,Start Time,End Date,End Time
                %1$s,,april third,,,No,03/04/2026,08:00:00,03/04/2026,09:00:00
                %1$s,,april thirteenth,,,No,13/04/2026,08:00:00,13/04/2026,09:00:00
                """.formatted(name);

        ImportResult result = importService.importCsv(csv);

        assertThat(result.importedEntries()).isEqualTo(2);
        assertThat(result.warnings()).isEmpty();
        UUID projectId = projectService.findAll(true).stream()
                .filter(p -> p.name().equals(name)).findFirst().orElseThrow().id();
        assertThat(timeEntryService.findAll(
                new TimeEntryFilter(null, null, null, projectId, null, null, null, null), Pageable.unpaged()))
                .extracting(e -> e.entryDate().toString())
                .containsExactlyInAnyOrder("2026-04-03", "2026-04-13");
    }

    @Test
    void clockifyImportWarnsAboutAmbiguousDates() {
        String csv = """
                Project,Client,Description,Task,Tags,Billable,Start Date,Start Time,End Date,End Time
                ClkAmbiguous %d,,x,,,No,03/04/2026,08:00:00,03/04/2026,09:00:00
                """.formatted(System.nanoTime());

        assertThat(importService.importCsv(csv).warnings()).singleElement()
                .asString().contains("ambiguous");
    }

    @Test
    void backupExportContainsCreatedData() {
        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Backup Project " + System.nanoTime(), null, null, true,
                new BigDecimal("60.00"), "EUR", null, null, BudgetReset.NONE));
        timeEntryService.create(new TimeEntryRequest(project.id(), null, "backup work",
                Instant.parse("2026-08-01T08:00:00Z"), Instant.parse("2026-08-01T09:00:00Z"), true, Set.of()));

        BackupDocument backup = backupService.export();

        assertThat(backup.exportedAt()).isNotBlank();
        assertThat(backup.settings()).isNotNull();
        assertThat(backup.projects()).anyMatch(p -> p.id().equals(project.id()));
        assertThat(backup.timeEntries()).anyMatch(e -> e.projectId().equals(project.id()));
    }

    @Test
    void restoreReplacesAllDataAndPreservesIdsAndSnapshots() {
        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Restore Project " + System.nanoTime(), null, null, true,
                new BigDecimal("60.00"), "EUR", null, null, BudgetReset.NONE));
        TimeEntryResponse entry = timeEntryService.create(new TimeEntryRequest(project.id(), null, "restore work",
                Instant.parse("2026-08-01T08:00:00Z"), Instant.parse("2026-08-01T09:00:00Z"), true, Set.of()));
        assertThat(entry.amountSnapshot()).isEqualByComparingTo("60.00"); // 1h * 60

        BackupDocument backup = backupService.export();

        // Mutate after the snapshot: a new project and a rate change that must NOT leak into the restore.
        ProjectResponse extraProject = projectService.create(new ProjectRequest(
                null, "Extra Project " + System.nanoTime(), null, null, true,
                new BigDecimal("999.00"), "EUR", null, null, BudgetReset.NONE));
        projectService.addRate(project.id(), new ProjectRateRequest(
                new BigDecimal("200.00"), "EUR", Instant.parse("2026-07-01T00:00:00Z"), null));

        RestoreResult result = backupRestoreService.restore(backup);

        assertThat(result.timeEntries()).isEqualTo(backup.timeEntries().size());

        // The project created after the backup is wiped.
        assertThat(projectService.findAll(true)).noneMatch(p -> p.id().equals(extraProject.id()));
        // The original entry returns with the same id and the original amount snapshot.
        TimeEntryResponse restored = timeEntryService.findById(entry.id());
        assertThat(restored.amountSnapshot()).isEqualByComparingTo("60.00");
        // The rate added after the backup must not survive the restore (snapshot/history stable).
        assertThat(projectService.getRates(project.id()))
                .noneMatch(r -> r.hourlyRate().compareTo(new BigDecimal("200.00")) == 0);
    }

    @Test
    void restoreKeepsOpenEndedRatesOpen() {
        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Open Rate Project " + System.nanoTime(), null, null, true,
                new BigDecimal("60.00"), "EUR", null, null, BudgetReset.NONE));
        projectService.addRate(project.id(), new ProjectRateRequest(
                new BigDecimal("100.00"), "EUR", Instant.parse("2026-01-01T00:00:00Z"), null));

        backupRestoreService.restore(backupService.export());

        assertThat(projectService.getRates(project.id()))
                .singleElement()
                .satisfies(r -> assertThat(r.validTo()).isNull());
    }

    @Test
    void restoreRejectsDocumentWithoutCollectionsAndKeepsData() {
        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Survivor Project " + System.nanoTime(), null, null, true,
                new BigDecimal("60.00"), "EUR", null, null, BudgetReset.NONE));
        BackupDocument empty = new BackupDocument(null, null, null, null, null, null, null, null, null);

        assertThatThrownBy(() -> backupRestoreService.restore(empty))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(projectService.findAll(true)).anyMatch(p -> p.id().equals(project.id()));
    }

    @Test
    void restoreRejectsInvalidSettingsBeforeWiping() {
        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Bad Settings Project " + System.nanoTime(), null, null, true,
                new BigDecimal("60.00"), "EUR", null, null, BudgetReset.NONE));
        BackupDocument backup = backupService.export();
        BackupDocument broken = new BackupDocument(backup.exportedAt(),
                new AppSettingsResponse("Europe/Viena", "EUR", BigDecimal.ZERO, "NONE", 15),
                backup.clients(), backup.projects(), backup.projectRates(), backup.tasks(),
                backup.tags(), backup.timeEntries(), backup.monthLocks());

        assertThatThrownBy(() -> backupRestoreService.restore(broken))
                .isInstanceOf(IllegalArgumentException.class);

        assertThat(projectService.findAll(true)).anyMatch(p -> p.id().equals(project.id()));
    }

    @Test
    void restoreRejectsProjectWithoutStatusBeforeWiping() {
        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Missing Status Project " + System.nanoTime(), null, null, true,
                new BigDecimal("60.00"), "EUR", null, null, BudgetReset.NONE));
        BackupDocument backup = backupService.export();
        var projects = new java.util.ArrayList<>(backup.projects());
        var p = projects.getFirst();
        projects.set(0, new ProjectResponse(p.id(), p.clientId(), p.clientName(), p.name(), p.description(),
                p.color(), null, p.billableByDefault(), p.defaultHourlyRate(), p.currencyCode(),
                p.hourBudgetMinutes(), p.moneyBudgetAmount(), p.budgetReset(), p.createdAt(), p.updatedAt()));
        BackupDocument broken = new BackupDocument(backup.exportedAt(), backup.settings(),
                backup.clients(), projects, backup.projectRates(), backup.tasks(),
                backup.tags(), backup.timeEntries(), backup.monthLocks());

        assertThatThrownBy(() -> backupRestoreService.restore(broken))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("projects[0].status is missing");

        assertThat(projectService.findAll(true)).anyMatch(p2 -> p2.id().equals(project.id()));
    }

    @Test
    void recentCombinationsSurfacesUsedPairing() {
        ProjectResponse project = projectService.create(new ProjectRequest(
                null, "Recent Project " + System.nanoTime(), null, null, true,
                new BigDecimal("60.00"), "EUR", null, null, BudgetReset.NONE));
        timeEntryService.create(new TimeEntryRequest(project.id(), null, "recent work",
                Instant.parse("2026-09-01T08:00:00Z"), Instant.parse("2026-09-01T09:00:00Z"), true, Set.of()));

        List<RecentCombination> combos = timeEntryService.recentCombinations(50);
        assertThat(combos).anyMatch(c -> c.projectId().equals(project.id()));

        // sanity: the entry is findable via the empty filter
        long count = timeEntryService.findAll(
                new TimeEntryFilter(null, null, null, project.id(), null, null, null, null),
                Pageable.unpaged()).getTotalElements();
        assertThat(count).isEqualTo(1);
    }
}
