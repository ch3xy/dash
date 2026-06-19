package com.ch3xy.dash.dashboard;

import com.ch3xy.dash.dashboard.DashboardResponse.BudgetAlert;
import com.ch3xy.dash.dashboard.DashboardResponse.PeriodStats;
import com.ch3xy.dash.dashboard.DashboardResponse.TopClient;
import com.ch3xy.dash.dashboard.DashboardResponse.TopProject;
import com.ch3xy.dash.report.ReportService;
import com.ch3xy.dash.report.dto.BudgetReportEntry;
import com.ch3xy.dash.settings.AppSettingsService;
import com.ch3xy.dash.timer.TimerService;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class DashboardService {

    private final NamedParameterJdbcTemplate jdbc;
    private final ReportService reportService;
    private final TimerService timerService;
    private final AppSettingsService settingsService;

    public DashboardService(NamedParameterJdbcTemplate jdbc,
                            ReportService reportService,
                            TimerService timerService,
                            AppSettingsService settingsService) {
        this.jdbc = jdbc;
        this.reportService = reportService;
        this.timerService = timerService;
        this.settingsService = settingsService;
    }

    public DashboardResponse getDashboard() {
        LocalDate today = LocalDate.now(settingsService.getTimezone());
        LocalDate weekStart = today.with(DayOfWeek.MONDAY);
        LocalDate monthStart = today.withDayOfMonth(1);
        String currency = settingsService.getCurrency();

        return new DashboardResponse(
                periodStats(today, today, currency),
                periodStats(weekStart, today, currency),
                periodStats(monthStart, today, currency),
                timerService.findCurrent().orElse(null),
                budgetAlerts(),
                topProjects(today.minusDays(30), today),
                topClients(today.minusDays(30), today, currency)
        );
    }

    private PeriodStats periodStats(LocalDate from, LocalDate to, String currency) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("from", from)
                .addValue("to", to);
        return jdbc.queryForObject("""
                SELECT COALESCE(SUM(duration_seconds), 0) AS seconds,
                       COALESCE(SUM(CASE WHEN billable THEN amount_snapshot ELSE 0 END), 0) AS revenue
                FROM time_entries
                WHERE entry_date >= CAST(:from AS date) AND entry_date <= CAST(:to AS date)
                """, params, (rs, rowNum) -> new PeriodStats(
                rs.getLong("seconds"),
                rs.getBigDecimal("revenue").setScale(2, RoundingMode.HALF_UP),
                currency));
    }

    private List<BudgetAlert> budgetAlerts() {
        return reportService.getBudgetReport().stream()
                .filter(b -> b.usedPercent() >= 80)
                .map(this::toAlert)
                .toList();
    }

    private BudgetAlert toAlert(BudgetReportEntry b) {
        return new BudgetAlert(b.projectId(), b.projectName(), b.usedPercent(), b.status());
    }

    private List<TopProject> topProjects(LocalDate from, LocalDate to) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("from", from)
                .addValue("to", to);
        return jdbc.query("""
                SELECT p.id AS project_id, p.name AS project_name, p.color AS color,
                       SUM(te.duration_seconds) AS seconds
                FROM time_entries te
                JOIN projects p ON p.id = te.project_id
                WHERE te.entry_date >= CAST(:from AS date) AND te.entry_date <= CAST(:to AS date)
                GROUP BY p.id, p.name, p.color
                ORDER BY seconds DESC
                LIMIT 5
                """, params, (rs, rowNum) -> new TopProject(
                rs.getObject("project_id", java.util.UUID.class),
                rs.getString("project_name"),
                rs.getString("color"),
                rs.getLong("seconds")));
    }

    private List<TopClient> topClients(LocalDate from, LocalDate to, String currency) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("from", from)
                .addValue("to", to);
        return jdbc.query("""
                SELECT c.id AS client_id, c.name AS client_name,
                       COALESCE(SUM(CASE WHEN te.billable THEN te.amount_snapshot ELSE 0 END), 0) AS revenue
                FROM time_entries te
                JOIN projects p ON p.id = te.project_id
                JOIN clients c ON c.id = p.client_id
                WHERE te.entry_date >= CAST(:from AS date) AND te.entry_date <= CAST(:to AS date)
                GROUP BY c.id, c.name
                ORDER BY revenue DESC
                LIMIT 5
                """, params, (rs, rowNum) -> new TopClient(
                rs.getObject("client_id", java.util.UUID.class),
                rs.getString("client_name"),
                rs.getBigDecimal("revenue").setScale(2, RoundingMode.HALF_UP),
                currency));
    }
}
