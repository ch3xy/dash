package com.ch3xy.dash.dashboard;

import com.ch3xy.dash.timer.TimerResponse;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record DashboardResponse(
        PeriodStats today,
        PeriodStats thisWeek,
        PeriodStats thisMonth,
        TimerResponse runningTimer,
        List<BudgetAlert> budgetAlerts,
        List<TopProject> topProjects,
        List<TopClient> topClients
) {
    public record PeriodStats(
            long durationSeconds,
            BigDecimal revenueAmount,
            String currencyCode
    ) {}

    public record BudgetAlert(
            UUID projectId,
            String projectName,
            double usedPercent,
            String status
    ) {}

    public record TopProject(
            UUID projectId,
            String projectName,
            String color,
            long durationSeconds
    ) {}

    public record TopClient(
            UUID clientId,
            String clientName,
            BigDecimal revenueAmount,
            String currencyCode
    ) {}
}
