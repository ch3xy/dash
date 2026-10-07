package com.ch3xy.dash.closing;

import com.ch3xy.dash.AbstractIntegrationTest;
import com.ch3xy.dash.dataio.BackupRestoreService;
import com.ch3xy.dash.dataio.BackupService;
import com.ch3xy.dash.project.BudgetReset;
import com.ch3xy.dash.project.ProjectRequest;
import com.ch3xy.dash.project.ProjectResponse;
import com.ch3xy.dash.project.ProjectService;
import com.ch3xy.dash.settings.AppSettingsService;
import com.ch3xy.dash.timeentry.BulkUpdateRequest;
import com.ch3xy.dash.timeentry.DeleteCriteria;
import com.ch3xy.dash.timeentry.TimeEntryRequest;
import com.ch3xy.dash.timeentry.TimeEntryResponse;
import com.ch3xy.dash.timeentry.TimeEntryService;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MonthLockServiceIntegrationTest extends AbstractIntegrationTest {

    // A month no other test writes into, so a lock left here cannot leak into other tests.
    private static final YearMonth MONTH = YearMonth.of(2020, 2);
    private static final Instant START = Instant.parse("2020-02-10T08:00:00Z");
    private static final Instant END = Instant.parse("2020-02-10T10:00:00Z");
    private static final Instant MARCH_START = Instant.parse("2020-03-10T08:00:00Z");
    private static final Instant MARCH_END = Instant.parse("2020-03-10T10:00:00Z");

    @Autowired
    MonthLockService lockService;
    @Autowired
    TimeEntryService entryService;
    @Autowired
    ProjectService projectService;
    @Autowired
    BackupService backupService;
    @Autowired
    BackupRestoreService restoreService;
    @Autowired
    AppSettingsService settingsService;

    private ProjectResponse project;

    @BeforeEach
    void setUp() {
        project = projectService.create(new ProjectRequest(
                null, "Lock Project " + System.nanoTime(), null, null, true,
                new BigDecimal("50.00"), "EUR", null, null, BudgetReset.NONE));
    }

    @AfterEach
    void releaseLock() {
        if (lockService.isLocked(MONTH.atDay(1))) {
            lockService.unlock(MONTH);
        }
    }

    private TimeEntryRequest req(Instant start, Instant end) {
        return new TimeEntryRequest(project.id(), null, "x", start, end, true, Set.of());
    }

    @Test
    void lockAndUnlockToggleState() {
        MonthLockResponse lock = lockService.lock(MONTH, "  RE-2020-02  ");

        assertThat(lock.month()).isEqualTo("2020-02");
        assertThat(lock.note()).isEqualTo("RE-2020-02");
        assertThat(lockService.isLocked(LocalDate.of(2020, 2, 29))).isTrue();
        assertThat(lockService.isLocked(LocalDate.of(2020, 3, 1))).isFalse();
        assertThat(lockService.findLocks()).extracting(MonthLockResponse::month).contains("2020-02");

        lockService.unlock(MONTH);
        assertThat(lockService.isLocked(MONTH.atDay(1))).isFalse();
    }

    @Test
    void currentAndFutureMonthsCannotBeLocked() {
        YearMonth current = YearMonth.now(settingsService.getTimezone());
        assertThatThrownBy(() -> lockService.lock(current, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("vergangene Monate");
        assertThatThrownBy(() -> lockService.lock(current.plusMonths(1), null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void lockingTwiceAndUnlockingOpenMonthAreRejected() {
        lockService.lock(MONTH, null);
        assertThatThrownBy(() -> lockService.lock(MONTH, null)).isInstanceOf(IllegalStateException.class);
        lockService.unlock(MONTH);
        assertThatThrownBy(() -> lockService.unlock(MONTH)).isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    void lockedMonthRejectsCreateUpdateDeleteAndMoves() {
        TimeEntryResponse inLocked = entryService.create(req(START, END));
        TimeEntryResponse inOpen = entryService.create(req(MARCH_START, MARCH_END));
        lockService.lock(MONTH, null);

        assertThatThrownBy(() -> entryService.create(req(START, END)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("02/2020");
        assertThatThrownBy(() -> entryService.update(inLocked.id(), req(START, END.plusSeconds(60))))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> entryService.delete(inLocked.id()))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> entryService.deleteAll(List.of(inLocked.id(), inOpen.id())))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> entryService.bulkUpdate(new BulkUpdateRequest(List.of(inLocked.id()), false, null, null)))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> entryService.split(inLocked.id(), START.plusSeconds(3600)))
                .isInstanceOf(IllegalStateException.class);
        // Moving an open entry into the locked month is rejected as well.
        assertThatThrownBy(() -> entryService.update(inOpen.id(), req(START, END)))
                .isInstanceOf(IllegalStateException.class);

        assertThat(entryService.findById(inLocked.id()).endTime()).isEqualTo(END);
        assertThat(entryService.findById(inOpen.id()).startTime()).isEqualTo(MARCH_START);

        lockService.unlock(MONTH);
        entryService.delete(inLocked.id());
    }

    @Test
    void deleteByCriteriaReportsLockedEntriesAndDeletesNothing() {
        TimeEntryResponse inLocked = entryService.create(req(START, END));
        entryService.create(req(MARCH_START, MARCH_END));
        lockService.lock(MONTH, null);

        DeleteCriteria criteria = new DeleteCriteria(null, null, null, project.id());
        var preview = entryService.previewDelete(criteria);
        assertThat(preview.count()).isEqualTo(2);
        assertThat(preview.lockedCount()).isEqualTo(1);

        assertThatThrownBy(() -> entryService.deleteByCriteria(criteria, 2))
                .isInstanceOf(IllegalStateException.class);
        assertThat(entryService.findById(inLocked.id())).isNotNull();
    }

    @Test
    void overviewContainsMonthStatsAndLockState() {
        entryService.create(req(START, END));
        lockService.lock(MONTH, "note");

        MonthClosingResponse feb = lockService.overview().stream()
                .filter(m -> m.month().equals("2020-02")).findFirst().orElseThrow();
        assertThat(feb.locked()).isTrue();
        assertThat(feb.lockable()).isFalse();
        assertThat(feb.note()).isEqualTo("note");
        assertThat(feb.entryCount()).isPositive();
        assertThat(feb.totalSeconds()).isGreaterThanOrEqualTo(7200);

        MonthClosingResponse previous = lockService.overview().stream()
                .filter(m -> m.month().equals(YearMonth.now().minusMonths(1).toString())
                        || m.month().equals(YearMonth.now().minusMonths(2).toString()))
                .findFirst().orElseThrow();
        assertThat(previous.locked() || previous.lockable()).isTrue();
    }

    @Test
    void backupRoundTripKeepsMonthLocks() {
        lockService.lock(MONTH, "backup");
        var backup = backupService.export();
        assertThat(backup.monthLocks()).extracting(MonthLockResponse::month).contains("2020-02");

        restoreService.restore(backup);

        assertThat(lockService.findLocks())
                .filteredOn(l -> l.month().equals("2020-02"))
                .singleElement()
                .extracting(MonthLockResponse::note).isEqualTo("backup");
    }
}
