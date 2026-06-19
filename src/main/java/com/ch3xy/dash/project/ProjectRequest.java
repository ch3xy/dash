package com.ch3xy.dash.project;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record ProjectRequest(
        UUID clientId,
        @NotBlank String name,
        String description,
        String color,
        boolean billableByDefault,
        BigDecimal defaultHourlyRate,
        @NotBlank String currencyCode,
        Integer hourBudgetMinutes,
        BigDecimal moneyBudgetAmount,
        @NotNull BudgetReset budgetReset
) {}
