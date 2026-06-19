package com.ch3xy.dash.report;

import com.ch3xy.dash.report.dto.BudgetReportEntry;
import com.ch3xy.dash.report.dto.HeatmapResponse.HeatmapDay;
import com.ch3xy.dash.report.dto.SummaryReportResponse.SummaryGroup;
import com.ch3xy.dash.report.dto.TrendReportResponse.TrendPoint;
import com.ch3xy.dash.settings.RoundingRule;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

/**
 * Native SQL aggregations for reporting. Grouping/granularity expressions are
 * chosen from whitelisted enums, never from raw user input, so they are safe to
 * inline into the SQL string; all value filters are bound parameters.
 */
@Repository
public class ReportQueryRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public ReportQueryRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<SummaryGroup> summaryGrouped(ReportFilter filter, RoundingRule rule, int minutes) {
        String keyExpr = groupKeyExpr(filter.groupBy());
        String labelExpr = groupLabelExpr(filter.groupBy());
        String dur = durationExpr(rule, minutes);

        String sql = """
                SELECT %s AS group_key,
                       %s AS group_label,
                       SUM(%s) AS total_seconds,
                       SUM(CASE WHEN te.billable THEN %s ELSE 0 END) AS billable_seconds,
                       COALESCE(SUM(CASE WHEN te.billable THEN te.amount_snapshot ELSE 0 END), 0) AS revenue
                FROM time_entries te
                JOIN projects p ON p.id = te.project_id
                LEFT JOIN clients c ON c.id = p.client_id
                LEFT JOIN tasks t ON t.id = te.task_id
                WHERE %s
                GROUP BY group_key, group_label
                ORDER BY total_seconds DESC
                """.formatted(keyExpr, labelExpr, dur, dur, whereClause());

        return jdbc.query(sql, params(filter), (rs, rowNum) -> new SummaryGroup(
                rs.getString("group_key"),
                rs.getString("group_label"),
                rs.getLong("total_seconds"),
                rs.getLong("billable_seconds"),
                rs.getBigDecimal("revenue").setScale(2, RoundingMode.HALF_UP)
        ));
    }

    public List<TrendPoint> trend(ReportFilter filter, GroupBy granularity, RoundingRule rule, int minutes) {
        String periodExpr = switch (granularity) {
            case DAY -> "to_char(te.entry_date, 'YYYY-MM-DD')";
            case WEEK -> "to_char(date_trunc('week', te.entry_date), 'YYYY-MM-DD')";
            case MONTH -> "to_char(te.entry_date, 'YYYY-MM')";
            default -> throw new IllegalArgumentException("Trend granularity must be DAY, WEEK or MONTH");
        };
        String dur = durationExpr(rule, minutes);

        String sql = """
                SELECT %s AS period,
                       SUM(%s) AS total_seconds,
                       COALESCE(SUM(CASE WHEN te.billable THEN te.amount_snapshot ELSE 0 END), 0) AS revenue
                FROM time_entries te
                JOIN projects p ON p.id = te.project_id
                LEFT JOIN clients c ON c.id = p.client_id
                LEFT JOIN tasks t ON t.id = te.task_id
                WHERE %s
                GROUP BY period
                ORDER BY period ASC
                """.formatted(periodExpr, dur, whereClause());

        return jdbc.query(sql, params(filter), (rs, rowNum) -> new TrendPoint(
                rs.getString("period"),
                rs.getLong("total_seconds"),
                rs.getBigDecimal("revenue").setScale(2, RoundingMode.HALF_UP)
        ));
    }

    /**
     * Budget usage per project. The MONTHLY/YEARLY reset boundaries are passed in
     * (computed in the application timezone by the caller) rather than derived from
     * the database server clock.
     */
    public List<BudgetReportEntry> budget(java.time.LocalDate monthStart, java.time.LocalDate yearStart) {
        String sql = """
                SELECT p.id AS project_id,
                       p.name AS project_name,
                       c.name AS client_name,
                       p.hour_budget_minutes AS budget_minutes,
                       COALESCE(SUM(te.duration_seconds), 0) AS used_seconds
                FROM projects p
                LEFT JOIN clients c ON c.id = p.client_id
                LEFT JOIN time_entries te ON te.project_id = p.id
                    AND (p.budget_reset <> 'MONTHLY' OR te.entry_date >= CAST(:monthStart AS date))
                    AND (p.budget_reset <> 'YEARLY'  OR te.entry_date >= CAST(:yearStart AS date))
                WHERE p.hour_budget_minutes IS NOT NULL
                  AND p.status <> 'ARCHIVED'
                GROUP BY p.id, p.name, c.name, p.hour_budget_minutes
                ORDER BY (COALESCE(SUM(te.duration_seconds), 0) / 60.0 / p.hour_budget_minutes) DESC
                """;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("monthStart", monthStart)
                .addValue("yearStart", yearStart);

        return jdbc.query(sql, params, (rs, rowNum) -> {
            int budgetMinutes = rs.getInt("budget_minutes");
            int usedMinutes = (int) (rs.getLong("used_seconds") / 60);
            double usedPercent = budgetMinutes > 0 ? (double) usedMinutes / budgetMinutes * 100.0 : 0.0;
            String status = usedPercent > 100 ? "EXCEEDED" : usedPercent >= 80 ? "WARNING" : "ON_TRACK";
            return new BudgetReportEntry(
                    rs.getObject("project_id", java.util.UUID.class),
                    rs.getString("project_name"),
                    rs.getString("client_name"),
                    budgetMinutes,
                    usedMinutes,
                    usedPercent,
                    status
            );
        });
    }

    public List<HeatmapDay> heatmap(LocalDate from, LocalDate to) {
        String sql = """
                SELECT te.entry_date AS day, SUM(te.duration_seconds) AS total_seconds
                FROM time_entries te
                WHERE te.entry_date >= CAST(:from AS date) AND te.entry_date <= CAST(:to AS date)
                GROUP BY te.entry_date
                ORDER BY te.entry_date ASC
                """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("from", from)
                .addValue("to", to);
        return jdbc.query(sql, params, (rs, rowNum) -> {
            long seconds = rs.getLong("total_seconds");
            double intensity = Math.min(1.0, seconds / (8.0 * 3600.0));
            return new HeatmapDay(rs.getObject("day", LocalDate.class), seconds, intensity);
        });
    }

    /**
     * SQL expression producing the (optionally rounded) duration in seconds for an
     * entry. The rule is a whitelisted enum and {@code minutes} is a server-side
     * integer, so inlining them into the SQL is safe.
     */
    private String durationExpr(RoundingRule rule, int minutes) {
        if (rule == null || rule == RoundingRule.NONE || minutes <= 0) {
            return "te.duration_seconds";
        }
        int bucket = minutes * 60;
        return switch (rule) {
            case UP -> "CEIL(te.duration_seconds::numeric / %d) * %d".formatted(bucket, bucket);
            case DOWN -> "FLOOR(te.duration_seconds::numeric / %d) * %d".formatted(bucket, bucket);
            case NEAREST -> "ROUND(te.duration_seconds::numeric / %d) * %d".formatted(bucket, bucket);
            case NONE -> "te.duration_seconds";
        };
    }

    private String groupKeyExpr(GroupBy groupBy) {
        return switch (groupBy) {
            case PROJECT -> "CAST(p.id AS text)";
            case CLIENT -> "CAST(c.id AS text)";
            case TASK -> "CAST(t.id AS text)";
            case DAY -> "to_char(te.entry_date, 'YYYY-MM-DD')";
            case WEEK -> "to_char(date_trunc('week', te.entry_date), 'YYYY-MM-DD')";
            case MONTH -> "to_char(te.entry_date, 'YYYY-MM')";
        };
    }

    private String groupLabelExpr(GroupBy groupBy) {
        return switch (groupBy) {
            case PROJECT -> "p.name";
            case CLIENT -> "COALESCE(c.name, 'No client')";
            case TASK -> "COALESCE(t.name, 'No task')";
            case DAY -> "to_char(te.entry_date, 'YYYY-MM-DD')";
            case WEEK -> "to_char(date_trunc('week', te.entry_date), 'YYYY-MM-DD')";
            case MONTH -> "to_char(te.entry_date, 'YYYY-MM')";
        };
    }

    private String whereClause() {
        // Each nullable filter is wrapped in an explicit CAST so PostgreSQL can
        // determine the parameter type even when the bound value is NULL.
        return """
                (CAST(:from AS date) IS NULL OR te.entry_date >= CAST(:from AS date))
                AND (CAST(:to AS date) IS NULL OR te.entry_date <= CAST(:to AS date))
                AND (CAST(:projectId AS uuid) IS NULL OR te.project_id = CAST(:projectId AS uuid))
                AND (CAST(:clientId AS uuid) IS NULL OR p.client_id = CAST(:clientId AS uuid))
                AND (CAST(:taskId AS uuid) IS NULL OR te.task_id = CAST(:taskId AS uuid))
                AND (CAST(:billable AS boolean) IS NULL OR te.billable = CAST(:billable AS boolean))
                AND (CAST(:q AS text) IS NULL OR LOWER(te.description) LIKE LOWER('%' || CAST(:q AS text) || '%'))
                AND (CAST(:tagId AS uuid) IS NULL OR EXISTS (
                        SELECT 1 FROM time_entry_tags tt
                        WHERE tt.time_entry_id = te.id AND tt.tag_id = CAST(:tagId AS uuid)))
                """;
    }

    private MapSqlParameterSource params(ReportFilter f) {
        return new MapSqlParameterSource()
                .addValue("from", f.from())
                .addValue("to", f.to())
                .addValue("projectId", asString(f.projectId()))
                .addValue("clientId", asString(f.clientId()))
                .addValue("taskId", asString(f.taskId()))
                .addValue("billable", f.billable())
                .addValue("q", f.q())
                .addValue("tagId", asString(f.tagId()));
    }

    private static String asString(java.util.UUID id) {
        return id != null ? id.toString() : null;
    }
}
