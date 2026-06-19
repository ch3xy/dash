package com.ch3xy.dash.dataio;

import com.ch3xy.dash.settings.AppSettingsRequest;
import com.ch3xy.dash.settings.AppSettingsResponse;
import com.ch3xy.dash.settings.AppSettingsService;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

/**
 * Restores a full {@link BackupDocument} produced by {@link BackupService}.
 *
 * <p>The restore preserves original primary keys and all snapshot values (hourly rate,
 * amount, rate history) so reports stay reproducible — using the domain create-services
 * would regenerate snapshots and rewrite rate-history valid_to ranges. It runs in a single
 * transaction: all existing data is wiped in FK-safe order, then re-inserted via raw JDBC
 * in dependency order. On any failure the whole operation rolls back.
 */
@Service
public class BackupRestoreService {

    private final NamedParameterJdbcTemplate jdbc;
    private final AppSettingsService settingsService;

    public BackupRestoreService(NamedParameterJdbcTemplate jdbc, AppSettingsService settingsService) {
        this.jdbc = jdbc;
        this.settingsService = settingsService;
    }

    @Transactional
    public RestoreResult restore(BackupDocument doc) {
        if (doc == null) {
            throw new IllegalArgumentException("backup document must not be null");
        }
        wipe();

        insertClients(doc);
        insertProjects(doc);
        insertProjectRates(doc);
        insertTasks(doc);
        insertTags(doc);
        insertTimeEntries(doc);
        insertTimeEntryTags(doc);
        restoreSettings(doc);

        return new RestoreResult(
                size(doc.clients()), size(doc.projects()), size(doc.projectRates()),
                size(doc.tasks()), size(doc.tags()), size(doc.timeEntries()));
    }

    private void wipe() {
        // Children before parents; running timers are transient and intentionally dropped.
        for (String table : List.of(
                "time_entry_tags", "running_timer_tags", "time_entries", "running_timers",
                "project_rates", "tasks", "projects", "tags", "clients")) {
            jdbc.getJdbcOperations().update("DELETE FROM " + table);
        }
    }

    private void insertClients(BackupDocument doc) {
        if (isEmpty(doc.clients())) {
            return;
        }
        var rows = doc.clients().stream().map(c -> new MapSqlParameterSource()
                .addValue("id", c.id())
                .addValue("name", c.name())
                .addValue("description", c.description())
                .addValue("email", c.email())
                .addValue("website", c.website())
                .addValue("currencyCode", c.currencyCode())
                .addValue("archived", c.archived())
                .addValue("createdAt", ts(c.createdAt()))
                .addValue("updatedAt", ts(c.updatedAt()))).toArray(SqlParameterSource[]::new);
        jdbc.batchUpdate("""
                INSERT INTO clients (id, name, description, email, website, currency_code,
                                     archived, created_at, updated_at)
                VALUES (:id, :name, :description, :email, :website, :currencyCode,
                        :archived, :createdAt, :updatedAt)
                """, rows);
    }

    private void insertProjects(BackupDocument doc) {
        if (isEmpty(doc.projects())) {
            return;
        }
        var rows = doc.projects().stream().map(p -> new MapSqlParameterSource()
                .addValue("id", p.id())
                .addValue("clientId", p.clientId())
                .addValue("name", p.name())
                .addValue("description", p.description())
                .addValue("color", p.color())
                .addValue("status", p.status().name())
                .addValue("billableByDefault", p.billableByDefault())
                .addValue("defaultHourlyRate", p.defaultHourlyRate())
                .addValue("currencyCode", p.currencyCode())
                .addValue("hourBudgetMinutes", p.hourBudgetMinutes())
                .addValue("moneyBudgetAmount", p.moneyBudgetAmount())
                .addValue("budgetReset", p.budgetReset().name())
                .addValue("createdAt", ts(p.createdAt()))
                .addValue("updatedAt", ts(p.updatedAt()))).toArray(SqlParameterSource[]::new);
        jdbc.batchUpdate("""
                INSERT INTO projects (id, client_id, name, description, color, status,
                                      billable_by_default, default_hourly_rate, currency_code,
                                      hour_budget_minutes, money_budget_amount, budget_reset,
                                      created_at, updated_at)
                VALUES (:id, :clientId, :name, :description, :color, :status,
                        :billableByDefault, :defaultHourlyRate, :currencyCode,
                        :hourBudgetMinutes, :moneyBudgetAmount, :budgetReset,
                        :createdAt, :updatedAt)
                """, rows);
    }

    private void insertProjectRates(BackupDocument doc) {
        if (isEmpty(doc.projectRates())) {
            return;
        }
        var rows = doc.projectRates().stream().map(r -> new MapSqlParameterSource()
                .addValue("id", r.id())
                .addValue("projectId", r.projectId())
                .addValue("hourlyRate", r.hourlyRate())
                .addValue("currencyCode", r.currencyCode())
                .addValue("validFrom", ts(r.validFrom()))
                .addValue("validTo", ts(r.validTo()))
                .addValue("note", r.note())).toArray(SqlParameterSource[]::new);
        jdbc.batchUpdate("""
                INSERT INTO project_rates (id, project_id, hourly_rate, currency_code,
                                           valid_from, valid_to, note)
                VALUES (:id, :projectId, :hourlyRate, :currencyCode, :validFrom, :validTo, :note)
                """, rows);
    }

    private void insertTasks(BackupDocument doc) {
        if (isEmpty(doc.tasks())) {
            return;
        }
        var rows = doc.tasks().stream().map(t -> new MapSqlParameterSource()
                .addValue("id", t.id())
                .addValue("projectId", t.projectId())
                .addValue("name", t.name())
                .addValue("description", t.description())
                .addValue("billableByDefault", t.billableByDefault())
                .addValue("hourlyRateOverride", t.hourlyRateOverride())
                .addValue("estimatedMinutes", t.estimatedMinutes())
                .addValue("archived", t.archived())
                .addValue("createdAt", ts(t.createdAt()))
                .addValue("updatedAt", ts(t.updatedAt()))).toArray(SqlParameterSource[]::new);
        jdbc.batchUpdate("""
                INSERT INTO tasks (id, project_id, name, description, billable_by_default,
                                   hourly_rate_override, estimated_minutes, archived,
                                   created_at, updated_at)
                VALUES (:id, :projectId, :name, :description, :billableByDefault,
                        :hourlyRateOverride, :estimatedMinutes, :archived, :createdAt, :updatedAt)
                """, rows);
    }

    private void insertTags(BackupDocument doc) {
        if (isEmpty(doc.tags())) {
            return;
        }
        var rows = doc.tags().stream().map(t -> new MapSqlParameterSource()
                .addValue("id", t.id())
                .addValue("name", t.name())
                .addValue("color", t.color())
                .addValue("archived", t.archived())
                .addValue("createdAt", ts(t.createdAt()))
                .addValue("updatedAt", ts(t.updatedAt()))).toArray(SqlParameterSource[]::new);
        jdbc.batchUpdate("""
                INSERT INTO tags (id, name, color, archived, created_at, updated_at)
                VALUES (:id, :name, :color, :archived, :createdAt, :updatedAt)
                """, rows);
    }

    private void insertTimeEntries(BackupDocument doc) {
        if (isEmpty(doc.timeEntries())) {
            return;
        }
        var rows = doc.timeEntries().stream().map(e -> new MapSqlParameterSource()
                .addValue("id", e.id())
                .addValue("projectId", e.projectId())
                .addValue("taskId", e.taskId())
                .addValue("description", e.description())
                .addValue("startTime", ts(e.startTime()))
                .addValue("endTime", ts(e.endTime()))
                .addValue("durationSeconds", e.durationSeconds())
                .addValue("entryDate", e.entryDate())
                .addValue("billable", e.billable())
                .addValue("hourlyRateSnapshot", e.hourlyRateSnapshot())
                .addValue("currencyCodeSnapshot", e.currencyCodeSnapshot())
                .addValue("amountSnapshot", e.amountSnapshot())
                .addValue("source", e.source().name())
                .addValue("createdAt", ts(e.createdAt()))
                .addValue("updatedAt", ts(e.updatedAt()))).toArray(SqlParameterSource[]::new);
        jdbc.batchUpdate("""
                INSERT INTO time_entries (id, project_id, task_id, description, start_time, end_time,
                                          duration_seconds, entry_date, billable, hourly_rate_snapshot,
                                          currency_code_snapshot, amount_snapshot, source,
                                          created_at, updated_at)
                VALUES (:id, :projectId, :taskId, :description, :startTime, :endTime,
                        :durationSeconds, :entryDate, :billable, :hourlyRateSnapshot,
                        :currencyCodeSnapshot, :amountSnapshot, :source, :createdAt, :updatedAt)
                """, rows);
    }

    private void insertTimeEntryTags(BackupDocument doc) {
        if (isEmpty(doc.timeEntries())) {
            return;
        }
        var rows = doc.timeEntries().stream()
                .filter(e -> e.tags() != null)
                .flatMap(e -> e.tags().stream().map(tag -> new MapSqlParameterSource()
                        .addValue("timeEntryId", e.id())
                        .addValue("tagId", tag.id())))
                .toArray(SqlParameterSource[]::new);
        if (rows.length == 0) {
            return;
        }
        jdbc.batchUpdate("""
                INSERT INTO time_entry_tags (time_entry_id, tag_id) VALUES (:timeEntryId, :tagId)
                """, rows);
    }

    private void restoreSettings(BackupDocument doc) {
        AppSettingsResponse s = doc.settings();
        if (s == null) {
            return;
        }
        settingsService.update(new AppSettingsRequest(
                s.timezone(), s.currency(), s.defaultRate(), s.roundingRule(), s.roundingMinutes()));
    }

    private static OffsetDateTime ts(Instant instant) {
        // Restored rows must satisfy NOT NULL created_at/updated_at even if the backup omitted them.
        return OffsetDateTime.ofInstant(instant != null ? instant : Instant.now(), ZoneOffset.UTC);
    }

    private static boolean isEmpty(List<?> list) {
        return list == null || list.isEmpty();
    }

    private static int size(List<?> list) {
        return list == null ? 0 : list.size();
    }
}
