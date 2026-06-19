package com.ch3xy.dash.report.dto;

import java.util.UUID;

public record BudgetReportEntry(
        UUID projectId,
        String projectName,
        String clientName,
        Integer hourBudgetMinutes,
        int usedMinutes,
        double usedPercent,
        String status
) {}
