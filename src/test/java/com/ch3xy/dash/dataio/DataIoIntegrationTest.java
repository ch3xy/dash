package com.ch3xy.dash.dataio;

import com.ch3xy.dash.AbstractIntegrationTest;
import com.ch3xy.dash.project.BudgetReset;
import com.ch3xy.dash.project.ProjectRateRequest;
import com.ch3xy.dash.project.ProjectRequest;
import com.ch3xy.dash.project.ProjectResponse;
import com.ch3xy.dash.project.ProjectService;
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

import static org.assertj.core.api.Assertions.assertThat;

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
