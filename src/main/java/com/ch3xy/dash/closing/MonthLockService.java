package com.ch3xy.dash.closing;

import com.ch3xy.dash.settings.AppSettingsService;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Monatsabschluss: a locked month makes all time entries whose entryDate falls into it
 * read-only until the month is released again. Only fully past months can be locked,
 * so a running timer (always in the current month) can never end up in a locked month.
 */
@Service
@Transactional(readOnly = true)
public class MonthLockService {

    private static final DateTimeFormatter LABEL = DateTimeFormatter.ofPattern("MM/yyyy");

    private final NamedParameterJdbcTemplate jdbc;
    private final AppSettingsService settingsService;
    private final Clock clock;

    public MonthLockService(NamedParameterJdbcTemplate jdbc, AppSettingsService settingsService, Clock clock) {
        this.jdbc = jdbc;
        this.settingsService = settingsService;
        this.clock = clock;
    }

    public List<MonthLockResponse> findLocks() {
        return jdbc.query("SELECT month, locked_at, note FROM month_locks ORDER BY month",
                (rs, rowNum) -> new MonthLockResponse(
                        YearMonth.from(rs.getDate("month").toLocalDate()).toString(),
                        rs.getTimestamp("locked_at").toInstant(),
                        rs.getString("note")));
    }

    public boolean isLocked(LocalDate date) {
        Boolean locked = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM month_locks WHERE month = :month)",
                new MapSqlParameterSource("month", YearMonth.from(date).atDay(1)), Boolean.class);
        return Boolean.TRUE.equals(locked);
    }

    /** Throws if the month of {@code date} is locked; the message is shown to the user. */
    public void requireOpen(LocalDate date) {
        if (isLocked(date)) {
            throw new IllegalStateException("Der Monat " + LABEL.format(date)
                    + " ist abgeschlossen – Einträge können nicht geändert werden");
        }
    }

    @Transactional
    public MonthLockResponse lock(YearMonth month, String note) {
        if (!month.isBefore(currentMonth())) {
            throw new IllegalArgumentException("Nur vergangene Monate können abgeschlossen werden");
        }
        if (isLocked(month.atDay(1))) {
            throw new IllegalStateException("Der Monat " + LABEL.format(month) + " ist bereits abgeschlossen");
        }
        MonthLockResponse lock = new MonthLockResponse(month.toString(), clock.instant(), blankToNull(note));
        jdbc.update("INSERT INTO month_locks (month, locked_at, note) VALUES (:month, :lockedAt, :note)",
                new MapSqlParameterSource()
                        .addValue("month", month.atDay(1))
                        .addValue("lockedAt", Timestamp.from(lock.lockedAt()))
                        .addValue("note", lock.note()));
        return lock;
    }

    @Transactional
    public void unlock(YearMonth month) {
        int deleted = jdbc.update("DELETE FROM month_locks WHERE month = :month",
                new MapSqlParameterSource("month", month.atDay(1)));
        if (deleted == 0) {
            throw new EntityNotFoundException("Der Monat " + LABEL.format(month) + " ist nicht abgeschlossen");
        }
    }

    /**
     * All months that have entries or a lock, plus the previous month (the usual one to
     * close next), newest first.
     */
    public List<MonthClosingResponse> overview() {
        Map<YearMonth, MonthLockResponse> locks = findLocks().stream()
                .collect(Collectors.toMap(l -> YearMonth.parse(l.month()), Function.identity()));
        Map<YearMonth, Stats> stats = new TreeMap<>();
        jdbc.query("""
                SELECT CAST(date_trunc('month', entry_date) AS date) AS month,
                       count(*) AS cnt,
                       COALESCE(SUM(duration_seconds), 0) AS total,
                       COALESCE(SUM(CASE WHEN billable THEN duration_seconds ELSE 0 END), 0) AS billable,
                       COALESCE(SUM(CASE WHEN billable THEN amount_snapshot ELSE 0 END), 0) AS revenue
                FROM time_entries
                GROUP BY 1
                """, rs -> {
            stats.put(YearMonth.from(rs.getDate("month").toLocalDate()), new Stats(
                    rs.getInt("cnt"), rs.getLong("total"), rs.getLong("billable"),
                    rs.getBigDecimal("revenue").setScale(2, RoundingMode.HALF_UP)));
        });

        YearMonth current = currentMonth();
        Set<YearMonth> months = new HashSet<>(stats.keySet());
        months.addAll(locks.keySet());
        months.add(current.minusMonths(1));
        String currency = settingsService.getCurrency();

        List<MonthClosingResponse> result = new ArrayList<>();
        for (YearMonth m : months) {
            MonthLockResponse lock = locks.get(m);
            Stats s = stats.getOrDefault(m, Stats.EMPTY);
            result.add(new MonthClosingResponse(
                    m.toString(), lock != null, lock != null ? lock.lockedAt() : null,
                    lock != null ? lock.note() : null,
                    lock == null && m.isBefore(current),
                    s.count(), s.totalSeconds(), s.billableSeconds(), s.revenue(), currency));
        }
        result.sort(Comparator.comparing(MonthClosingResponse::month).reversed());
        return result;
    }

    private YearMonth currentMonth() {
        return YearMonth.now(clock.withZone(settingsService.getTimezone()));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private record Stats(int count, long totalSeconds, long billableSeconds, BigDecimal revenue) {
        static final Stats EMPTY = new Stats(0, 0, 0, BigDecimal.ZERO.setScale(2));
    }
}
