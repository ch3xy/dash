package com.ch3xy.dash.timer;

import com.ch3xy.dash.AbstractIntegrationTest;
import com.ch3xy.dash.project.BudgetReset;
import com.ch3xy.dash.project.ProjectRequest;
import com.ch3xy.dash.project.ProjectResponse;
import com.ch3xy.dash.project.ProjectService;
import com.ch3xy.dash.timeentry.TimeEntryResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TimerServiceIntegrationTest extends AbstractIntegrationTest {

    /** Mutable clock so individual tests can advance time deterministically. */
    static final MutableClock CLOCK = new MutableClock(Instant.parse("2026-06-19T09:00:00Z"));

    @TestConfiguration
    static class ClockOverride {
        @Bean
        @Primary
        Clock testClock() {
            return CLOCK;
        }
    }

    @Autowired
    TimerService timerService;
    @Autowired
    ProjectService projectService;
    @Autowired
    RunningTimerRepository timerRepository;

    private ProjectResponse project;

    @BeforeEach
    void setUp() {
        timerRepository.deleteAll();
        CLOCK.set(Instant.parse("2026-06-19T09:00:00Z"));
        project = projectService.create(new ProjectRequest(
                null, "Timer Project " + System.nanoTime(), null, null, true,
                new BigDecimal("60.00"), "EUR", null, null, BudgetReset.NONE));
    }

    @Test
    void startThenStopCreatesBillableEntryWithComputedAmount() {
        timerService.start(new TimerStartRequest(project.id(), null, "work", true, Set.of()));
        CLOCK.set(Instant.parse("2026-06-19T11:00:00Z")); // 2 hours later

        TimeEntryResponse entry = timerService.stop(new TimerStopRequest(null));

        assertThat(entry.durationSeconds()).isEqualTo(7200);
        assertThat(entry.source().name()).isEqualTo("TIMER");
        assertThat(entry.hourlyRateSnapshot()).isEqualByComparingTo("60.00");
        assertThat(entry.amountSnapshot()).isEqualByComparingTo("120.00");
        assertThat(timerRepository.count()).isZero();
    }

    @Test
    void startingSecondTimerWhileOneRunsIsRejected() {
        timerService.start(new TimerStartRequest(project.id(), null, "first", true, Set.of()));

        assertThatThrownBy(() ->
                timerService.start(new TimerStartRequest(project.id(), null, "second", true, Set.of())))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already running");
    }

    @Test
    void discardRemovesTimerWithoutCreatingEntry() {
        timerService.start(new TimerStartRequest(project.id(), null, "throwaway", true, Set.of()));
        timerService.discard();
        assertThat(timerRepository.count()).isZero();
    }

    @Test
    void timerSpanningMidnightUsesEndDateAsEntryDate() {
        CLOCK.set(Instant.parse("2026-06-19T22:30:00Z"));
        timerService.start(new TimerStartRequest(project.id(), null, "late", false, Set.of()));
        CLOCK.set(Instant.parse("2026-06-20T01:15:00Z"));

        TimeEntryResponse entry = timerService.stop(new TimerStopRequest(null));

        // App zone Europe/Vienna: 2026-06-20T01:15Z = 03:15 local → entry date 2026-06-20
        assertThat(entry.entryDate().toString()).isEqualTo("2026-06-20");
        assertThat(entry.billable()).isFalse();
        assertThat(entry.amountSnapshot()).isEqualByComparingTo("0.00");
    }

    static class MutableClock extends Clock {
        private Instant instant;

        MutableClock(Instant instant) { this.instant = instant; }

        void set(Instant instant) { this.instant = instant; }

        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return instant; }
    }
}
