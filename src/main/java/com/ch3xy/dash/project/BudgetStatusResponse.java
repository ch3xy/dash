package com.ch3xy.dash.project;

import java.math.BigDecimal;
import java.util.UUID;

public record BudgetStatusResponse(
        UUID projectId,
        Integer hourBudgetMinutes,
        int usedMinutes,
        int remainingMinutes,
        double usedPercent,
        BigDecimal moneyBudgetAmount,
        BigDecimal revenueAmount,
        String budgetPeriod,
        String status
) {}
